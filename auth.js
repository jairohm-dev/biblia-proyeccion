'use strict';
/* Seguridad de la consola: portada con PIN y llave del equipo.
   · La consola NO viene en index.html: el servidor la entrega (/api/app) solo a peticiones firmadas
     tras el PIN. Sin sesión no hay nada que desocultar desde el inspector del navegador.
   · El PIN se deriva con PBKDF2-SHA256 (210 000 vueltas) antes de salir del navegador; el servidor
     solo guarda un resumen de ese resultado.
   · Al entrar, el navegador crea una llave ECDSA P-256 NO exportable (IndexedDB): ningún script puede
     leerla ni copiarla. Cada orden al servidor va firmada con ella, la hora y un número de un solo uso.
   · Si la sesión termina con la consola abierta, la portada aparece encima y la consola queda inerte.
     Si alguien quita o esconde la portada desde el inspector, la consola se desmonta de la página.
   · La sesión caduca al reiniciar el servidor o tras un rato sin usarla (BIBLIA_SESION_MIN, 12 horas). Lo que está en vivo sigue en el
     proyector y en OBS mientras tanto: los dos leen del servidor, no de la consola.
   Usa utilidades de app.js ($, $$, idb, store, toast, hydrateIcons…), que se carga después. */

const PBKDF2_ROUNDS = 210000;
// Dentro del ejecutable (Tauri) no hay servidor: el PIN y lo que está en vivo los maneja la propia app.
const DESKTOP = !!window.__TAURI__?.core;
const tauri = (cmd, args, opts) => window.__TAURI__.core.invoke(cmd, args, opts);
const INSTALL_KEY = 'biblia.instalacion';
const auth = { mode: 'none', device: null, viewer: '', salt: '', configured: false, name: '', onUnlock: null };

const hexOf = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const b64Of = (bytes) => btoa(String.fromCharCode(...bytes));
const randHex = (n) => hexOf(crypto.getRandomValues(new Uint8Array(n)));
const textBytes = (s) => new TextEncoder().encode(s);
// El nombre de la iglesia viaja en base64url (UTF-8): así el JSON del servidor nunca lleva caracteres raros.
const nameToB64 = (s) => btoa(String.fromCharCode(...textBytes(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const nameFromB64 = (s) => {
  try { return new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))); } catch { return ''; }
};

const COMMON_PINS = ['123456', '654321', '000000', '111111', '121212', '123123', '112233', '159753', '147258', '258369',
  '789456', '456123', '147852', '102030', '010203', '098765', '696969', '131313', '202020', '101010', '123321', '112358',
  '1234567', '7654321', '12345678', '87654321', '11223344', '12121212', '00000000'];

// Explica por qué un PIN es débil, o devuelve '' si es aceptable.
function weakPinReason(pin) {
  if (!/^\d{6,8}$/.test(pin)) return 'Usa de 6 a 8 números.';
  if (/^(\d)\1+$/.test(pin)) return 'No repitas el mismo número.';
  const d = [...pin].map(Number);
  const step = d[1] - d[0];
  if (Math.abs(step) === 1 && d.every((x, i) => i === 0 || x - d[i - 1] === step)) return 'No uses números seguidos, como 123456.';
  if (/^(\d{2,4})\1+\d{0,3}$/.test(pin) && new Set(d).size <= 4) return 'No repitas un mismo grupo de números.';
  if (COMMON_PINS.includes(pin)) return 'Ese PIN es de los más usados; elige otro.';
  if (new Set(d).size <= 2) return 'Usa al menos tres números distintos.';
  return '';
}

async function pinVerifier(pin, saltHex) {
  const base = await crypto.subtle.importKey('raw', textBytes(pin), 'PBKDF2', false, ['deriveBits']);
  const salt = Uint8Array.from(saltHex.match(/../g), (h) => parseInt(h, 16));
  return hexOf(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ROUNDS }, base, 256));
}

// Nada de esperar para siempre: si el almacén del navegador no responde, se sigue sin él.
const withTimeout = (promise, ms) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('tiempo')), ms))]);

// La llave del equipo: se crea una vez y nunca sale del navegador. Si el almacén no responde (por
// ejemplo, otra pestaña con una versión vieja de la app lo tiene ocupado), vale solo en esta pestaña.
let memoryDevice = null;
let storeBroken = false;

async function deviceKey(create) {
  if (memoryDevice) return memoryDevice;
  if (!storeBroken) {
    try { memoryDevice = (await withTimeout(idb.get('device', 'auth'), 2500)) || null; } catch { storeBroken = true; }
  }
  if (memoryDevice || !create) return memoryDevice;
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey));
  memoryDevice = { pair, pub: b64Of(spki), id: hexOf(await crypto.subtle.digest('SHA-256', spki)).slice(0, 32) };
  if (!storeBroken) {
    try { await withTimeout(idb.put('device', memoryDevice, 'auth'), 2500); } catch { storeBroken = true; }
  }
  return memoryDevice;
}

// WebCrypto firma en formato r‖s; openssl y .NET Framework esperan DER.
function derSignature(raw) {
  const int = (b) => {
    let i = 0;
    while (i < b.length - 1 && b[i] === 0) i++;
    let v = [...b.slice(i)];
    if (v[0] & 0x80) v = [0, ...v];
    return [0x02, v.length, ...v];
  };
  const body = [...int(raw.slice(0, 32)), ...int(raw.slice(32))];
  return Uint8Array.from([0x30, body.length, ...body]);
}

async function signedFetch(url, { method = 'POST', body = '', headers = {} } = {}) {
  const d = auth.device;
  if (!d) throw new Error('sin-llave');
  const bytes = body instanceof Blob ? new Uint8Array(await body.arrayBuffer()) : textBytes(body);
  const u = new URL(url, location.href);
  const ts = String(Math.floor(Date.now() / 1000));
  const nonce = randHex(16);
  const msg = [method, u.pathname + u.search, ts, nonce, hexOf(await crypto.subtle.digest('SHA-256', bytes))].join('\n');
  const raw = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, d.pair.privateKey, textBytes(msg)));
  const res = await fetch(u, {
    method, body: bytes, cache: 'no-store',
    headers: { ...headers, 'X-Biblia-Device': d.id, 'X-Biblia-Time': ts, 'X-Biblia-Nonce': nonce, 'X-Biblia-Signature': b64Of(derSignature(raw)) },
  });
  // El servidor se reinició o la sesión caducó: hay que volver a poner el PIN.
  if (res.status === 401 && auth.mode === 'open') lockConsole();
  return res;
}

// Para el resto de la app: enviar solo con la consola desbloqueada. En la web va firmado al servidor;
// en el ejecutable va directo a la app (lo en vivo al proyector, y a OBS si se está transmitiendo).
async function apiSend(url, opts) {
  if (auth.mode !== 'open') throw new Error('bloqueada');
  if (!DESKTOP) return signedFetch(url, opts);
  try {
    if (url === 'api/live') {
      await tauri('set_live', { live: opts.body });
    } else {
      const id = new URL(url, location.href).searchParams.get('id');
      const bytes = new Uint8Array(await opts.body.arrayBuffer());
      await tauri('put_media', bytes, { headers: { 'x-media-id': id, 'x-media-type': opts.headers['Content-Type'] } });
    }
    return { ok: true, status: 200 };
  } catch (e) {
    if (String(e).includes('sesion')) lockConsole();
    return { ok: false, status: 401 };
  }
}

async function authStatus() {
  if (DESKTOP) return tauri('auth_status').catch(() => null);
  try {
    const res = await fetch('api/auth?accion=estado', { cache: 'no-store' });
    if (!res.ok || !(res.headers.get('content-type') || '').includes('json')) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// «keep»: además de comprobarla, la renueva (mientras se está en vivo la sesión no caduca por no tocar nada).
async function checkSession(keep = false) {
  if (DESKTOP) return tauri('auth_check', { keep }).catch(() => false);
  if (!auth.device) return false;
  try {
    const res = await signedFetch(`api/auth?accion=${keep ? 'mantener' : 'comprobar'}`);
    if (!res.ok) return false;
    auth.viewer = (await res.json()).viewer || '';
    return true;
  } catch {
    return false;
  }
}

async function postAuth(action, data) {
  const res = await fetch(`api/auth?accion=${action}`, { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' }, cache: 'no-store' });
  let json = {};
  try { json = await res.json(); } catch { /* sin cuerpo */ }
  return { status: res.status, ...json };
}

async function createPin(pin, name) {
  const salt = randHex(16);
  if (DESKTOP) {
    const r = await tauri('auth_create', { salt, verifier: await pinVerifier(pin, salt), name: nameToB64(name) });
    if (r.status === 200) Object.assign(auth, { salt, configured: true, name });
    return r;
  }
  const [verifier, device] = await Promise.all([pinVerifier(pin, salt), deviceKey(true)]);
  const r = await postAuth('crear', { salt, verifier, pub: device.pub, name: nameToB64(name) });
  if (r.status !== 200) return r;
  Object.assign(auth, { device, salt, configured: true, name });
  return (await checkSession()) ? { status: 200 } : { status: 500 };
}

async function loginPin(pin) {
  if (DESKTOP) return tauri('auth_login', { verifier: await pinVerifier(pin, auth.salt) });
  const [verifier, device] = await Promise.all([pinVerifier(pin, auth.salt), deviceKey(true)]);
  const r = await postAuth('entrar', { verifier, pub: device.pub });
  if (r.status !== 200) return r;
  auth.device = device;
  return (await checkSession()) ? { status: 200 } : { status: 500 };
}

async function changePin(current, next) {
  const salt = randHex(16);
  const [cur, verifier] = await Promise.all([pinVerifier(current, auth.salt), pinVerifier(next, salt)]);
  if (DESKTOP) {
    const r = await tauri('auth_change', { current: cur, salt, verifier });
    if (r.status === 200) auth.salt = salt;
    return r;
  }
  const res = await signedFetch('api/auth?accion=cambiar', { body: JSON.stringify({ current: cur, salt, verifier }), headers: { 'Content-Type': 'application/json' } });
  let json = {};
  try { json = await res.json(); } catch { /* sin cuerpo */ }
  if (res.ok) auth.salt = salt;
  return { status: res.status, ...json };
}

async function saveChurchName(name) {
  auth.name = name;
  if (DESKTOP) { tauri('auth_name', { name: nameToB64(name) }).catch(() => {}); return; }
  try { await signedFetch('api/auth?accion=nombre', { body: JSON.stringify({ name: nameToB64(name) }), headers: { 'Content-Type': 'application/json' } }); } catch { /* se guarda la próxima vez */ }
}

// Borra todo lo que esta app guardó en este navegador (o en el ejecutable).
async function wipeLocalData() {
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* nada que borrar */ }
  try { idb.db?.close(); } catch { /* ya cerrada */ }
  await withTimeout(new Promise((resolve) => {
    const req = indexedDB.deleteDatabase('easybiblia');
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  }), 3000).catch(() => {});
}

// Tras «serve.sh --reiniciar» la instalación cambia: se borra todo lo guardado en este navegador.
async function wipeIfReinstalled(install) {
  if (!install) return false;
  let previous = null;
  try { previous = localStorage.getItem(INSTALL_KEY); } catch { /* sin almacenamiento */ }
  if (previous === install) return false;
  if (previous) {
    try { localStorage.clear(); sessionStorage.clear(); } catch { /* nada que borrar */ }
    try { idb.db?.close(); } catch { /* ya cerrada */ }
    await withTimeout(new Promise((resolve) => {
      const req = indexedDB.deleteDatabase('easybiblia');
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    }), 3000).catch(() => {});
  }
  try { localStorage.setItem(INSTALL_KEY, install); } catch { /* sin almacenamiento */ }
  if (previous) { location.reload(); return true; }
  return false;
}

/* ───────────── Portada ─────────────
   Modos: 'checking' (comprobando), 'register' (primer uso), 'login' (entrar), 'change' (cambiar PIN),
   'noserver' (sin el servidor de la app), 'insecure' (abierta desde otra dirección). */
let gateMode = 'checking';
let gateTimer = 0;
let mounted = false;

const GATE_TEXT = {
  checking: ['Un momento…', 'Comprobando la seguridad de la consola.', ''],
  register: ['Registra tu iglesia', 'Crea un PIN de 6 a 8 números. Se pedirá al encender el servidor y tras 12 horas sin usar la consola, para que nadie más pueda controlar la proyección.', 'Registrar'],
  login: ['Entrar', 'Escribe el PIN de la consola para continuar.', 'Entrar'],
  change: ['Cambiar el PIN', 'Escribe el PIN de ahora y luego el nuevo. Los demás equipos tendrán que volver a entrar.', 'Guardar PIN'],
  noserver: ['Abre la app con su servidor', 'La consola está protegida con PIN y necesita su servidor. Ábrela con «serve.sh» (macOS o Linux) o con «iniciar-windows.cmd» (Windows) y entra en http://localhost:3737.', ''],
  insecure: ['Abre la consola en este equipo', '', ''],
};

// Retira la pantalla de arranque con un fundido corto.
function hideSplash() {
  $('#splash')?.classList.add('gone');
}

function showGate(mode) {
  gateMode = mode;
  hideSplash();
  const gate = $('#gate');
  const [title, lead, button] = GATE_TEXT[mode];
  gate.dataset.mode = mode;
  gate.classList.toggle('over-app', mounted && mode !== 'change');
  gate.classList.toggle('sheet-mode', mode === 'change');
  $('#gateTitle').textContent = title;
  $('#gateLead').textContent = mode === 'insecure'
    ? `Por seguridad, la consola solo se controla desde el equipo donde corre el servidor: http://localhost:${location.port || 80}`
    : lead;
  $('#gateHello').textContent = mode === 'register' ? 'Te damos la bienvenida a' : 'Consola de proyección';
  $('#gateName').textContent = auth.name || 'Biblia';
  const show = (id, on) => { $(id).hidden = !on; };
  const fields = mode === 'register' || mode === 'login' || mode === 'change';
  show('#gateFields', fields);
  show('#gateChurchRow', mode === 'register');
  show('#gateCurrentRow', mode === 'change');
  show('#gatePinRow', fields);
  show('#gateConfirmRow', mode === 'register' || mode === 'change');
  $('#gatePinLabel').textContent = mode === 'change' ? 'PIN nuevo' : 'PIN';
  show('#gateActions', fields);
  $('#gateSubmit').textContent = button;
  $('#gateSubmit').disabled = false;
  show('#gateCancel', mode === 'change');
  show('#gateForgot', mode === 'login');
  show('#gateWait', mode === 'checking');
  $('#gateNote').hidden = mode !== 'register' && mode !== 'change';
  $('#gateNote').textContent = 'Evita números fáciles como 123456, 000000 o 121212.';
  for (const id of ['#gateChurch', '#gateCurrent', '#gatePin', '#gateConfirm']) { $(id).value = ''; $(id).closest('.gate-field').classList.remove('ok'); }
  for (const id of ['#gateCurrent', '#gatePin', '#gateConfirm']) $(id).type = 'password';
  const eye = $('#gateEye');
  if (eye.getAttribute('aria-pressed') === 'true') eye.click();
  setGateMessage('');
  $('#gateLive').hidden = true;
  if (!gate.open) gate.showModal();
  if (mode === 'register') $('#gateChurch').focus();
  else if (mode === 'change') $('#gateCurrent').focus();
  else if (mode === 'login') $('#gatePin').focus();
  if (mode === 'login') refreshGateLive();
}

function setGateMessage(text, kind = 'error') {
  const el = $('#gateMsg');
  el.textContent = text;
  el.dataset.kind = kind;
  el.hidden = !text;
}

// En la entrada se ve lo que sigue proyectándose (lo sabe el servidor, no hace falta sesión).
async function refreshGateLive() {
  let ref = '';
  try {
    const res = await fetch('api/live?rev=-1', { cache: 'no-store' });
    const data = await res.json();
    ref = data.state?.slide?.ref || data.state?.slide?.label || '';
  } catch { /* sin servidor */ }
  if (gateMode !== 'login') return;
  $('#gateLive').hidden = !ref;
  $('#gateLiveRef').textContent = ref;
}

function waitMessage(secs) {
  clearInterval(gateTimer);
  const btn = $('#gateSubmit');
  let left = secs;
  const tick = () => {
    if (left <= 0) { clearInterval(gateTimer); btn.disabled = false; setGateMessage(''); return; }
    btn.disabled = true;
    setGateMessage(`Demasiados intentos. Espera ${left} s para volver a probar.`);
    left -= 1;
  };
  tick();
  gateTimer = setInterval(tick, 1000);
}

// Marca con ✓ los campos que ya están bien.
function validateGateFields() {
  const pin = $('#gatePin').value;
  const ok = (id, cond) => $(id).closest('.gate-field').classList.toggle('ok', !!cond);
  ok('#gateChurch', $('#gateChurch').value.trim().length >= 2);
  ok('#gateCurrent', /^\d{6,8}$/.test($('#gateCurrent').value));
  ok('#gatePin', gateMode === 'login' ? /^\d{6,8}$/.test(pin) : pin.length >= 6 && !weakPinReason(pin));
  ok('#gateConfirm', pin.length >= 6 && pin === $('#gateConfirm').value);
  if (gateMode === 'register' || gateMode === 'change') setGateMessage(pin.length >= 6 ? weakPinReason(pin) : '');
}

async function submitGate() {
  const name = $('#gateChurch').value.trim();
  const pin = $('#gatePin').value;
  const confirm = $('#gateConfirm').value;
  if (gateMode === 'register' && name.length < 2) { setGateMessage('Escribe el nombre de tu iglesia.'); $('#gateChurch').focus(); return; }
  if (gateMode === 'register' || gateMode === 'change') {
    const weak = weakPinReason(pin);
    if (weak) { setGateMessage(weak); $('#gatePin').focus(); return; }
    if (pin !== confirm) { setGateMessage('Los dos PIN no coinciden.'); $('#gateConfirm').focus(); return; }
  } else if (!/^\d{6,8}$/.test(pin)) { setGateMessage('El PIN tiene de 6 a 8 números.'); return; }

  const btn = $('#gateSubmit');
  btn.disabled = true;
  setGateMessage(gateMode === 'register' ? 'Protegiendo la consola…' : 'Comprobando…', 'info');
  let r;
  try {
    if (gateMode === 'register') r = await createPin(pin, name);
    else if (gateMode === 'login') r = await loginPin(pin);
    else r = await changePin($('#gateCurrent').value, pin);
  } catch {
    r = { status: 0 };
  }
  btn.disabled = false;
  if (r.status === 200) {
    if (gateMode === 'change') { $('#gate').close(); toast('PIN cambiado. Los demás equipos tendrán que volver a entrar.'); return; }
    if (gateMode === 'register') store.set('biblia.iglesia', { name });
    await openConsole();
    return;
  }
  if (r.status === 429 || r.wait > 0) { waitMessage(r.wait || 30); return; }
  if (r.status === 401) {
    setGateMessage(gateMode === 'change' ? 'El PIN actual no es correcto.' : 'PIN incorrecto.');
    $(gateMode === 'change' ? '#gateCurrent' : '#gatePin').select();
    return;
  }
  if (r.status === 409 && gateMode === 'register') {
    const st = await authStatus();
    auth.salt = st?.salt || '';
    auth.name = nameFromB64(st?.name || '');
    showGate('login');
    setGateMessage('Ya hay un PIN en este servidor. Escríbelo para entrar.', 'info');
    return;
  }
  setGateMessage('No se pudo hablar con el servidor. ¿Sigue abierta la ventana de serve.sh?');
}

/* ───────────── Consola: montar, bloquear y vigilar ───────────── */
// La consola se pide al servidor con la sesión ya abierta, y solo entonces se arranca.
async function openConsole() {
  if (!mounted) {
    // En la web la entrega el servidor solo con sesión; en el ejecutable viene dentro de la app.
    const res = DESKTOP ? await fetch('console.html') : await signedFetch('api/app');
    if (!res.ok) { showGate('login'); setGateMessage('No se pudo abrir la consola. Vuelve a intentarlo.'); return; }
    $('#appRoot').innerHTML = await res.text();
    mounted = true;
    if (auth.name) store.set('biblia.iglesia', { name: auth.name });
    startConsole();
  }
  unlockConsole();
}

let sessionWatch = 0;

function unlockConsole() {
  auth.mode = 'open';
  stopGuard();
  const root = $('#appRoot');
  root.inert = false;
  root.removeAttribute('aria-hidden');
  const gate = $('#gate');
  if (gate.open) gate.close();
  hideSplash();
  // Cada 20 s se comprueba que la sesión siga viva (servidor apagado, caducada o PIN cambiado). Mientras
  // se está en vivo se renueva: en una predicación pueden pasar muchos minutos sin tocar la consola y el
  // siguiente versículo tiene que llegar al proyector y a OBS sin pedir el PIN.
  clearInterval(sessionWatch);
  sessionWatch = setInterval(async () => {
    if (auth.mode === 'open' && !(await checkSession(!!auth.keepAlive?.()))) lockConsole();
  }, 20000);
  auth.onUnlock?.();
}

// La sesión terminó con la consola abierta: la portada aparece encima y la consola queda inerte.
function lockConsole() {
  auth.mode = 'locked';
  clearInterval(sessionWatch);
  const root = $('#appRoot');
  root.inert = true;
  root.setAttribute('aria-hidden', 'true');
  for (const d of $$('#appRoot dialog[open]')) d.close();
  showGate('login');
  startGuard();
}

async function lockNow() {
  try { await (DESKTOP ? tauri('auth_lock') : signedFetch('api/auth?accion=salir')); } catch { /* ya no había sesión */ }
  lockConsole();
}

// Con la consola bloqueada, si alguien quita o esconde la portada (o reactiva la consola) desde el
// inspector, la consola se desmonta de la página y se vuelve a la entrada: no queda nada que usar.
let guardObserver = null;
let guardTimer = 0;

function gateIntact() {
  const gate = $('#gate');
  if (!gate || !gate.isConnected || !gate.open || !gate.matches(':modal')) return false;
  const st = getComputedStyle(gate);
  if (st.display === 'none' || st.visibility !== 'visible' || Number(st.opacity) < 0.95 || st.pointerEvents === 'none') return false;
  const r = gate.getBoundingClientRect();
  if (r.width < innerWidth * 0.95 || r.height < innerHeight * 0.95) return false;
  const root = $('#appRoot');
  return !root || (root.inert && root.getAttribute('aria-hidden') === 'true');
}

function checkGuard() {
  if (auth.mode === 'locked' && mounted && !gateIntact()) unmountConsole();
}

function startGuard() {
  stopGuard();
  guardObserver = new MutationObserver(checkGuard);
  guardObserver.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['open', 'style', 'class', 'hidden', 'inert', 'aria-hidden', 'id'] });
  guardTimer = setInterval(checkGuard, 700);
}

function stopGuard() {
  guardObserver?.disconnect();
  guardObserver = null;
  clearInterval(guardTimer);
}

function unmountConsole() {
  stopGuard();
  mounted = false;
  auth.mode = 'locked';
  document.body.replaceChildren();
  location.reload();
}

function initGate() {
  hydrateIcons($('#gate'));
  const gate = $('#gate');
  // La portada no se cierra con Escape (salvo al cambiar el PIN, que es opcional).
  gate.addEventListener('cancel', (e) => { if (gateMode !== 'change') e.preventDefault(); });
  $('#gateForm').addEventListener('submit', (e) => { e.preventDefault(); submitGate(); });
  $('#gateCancel').addEventListener('click', () => gate.close());
  for (const id of ['#gateCurrent', '#gatePin', '#gateConfirm']) {
    $(id).addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 8); validateGateFields(); });
  }
  $('#gateChurch').addEventListener('input', () => { validateGateFields(); $('#gateName').textContent = $('#gateChurch').value.trim() || 'Biblia'; });
  // Ver u ocultar los PIN mientras se escriben.
  $('#gateEye').addEventListener('click', () => {
    const btn = $('#gateEye');
    const show = btn.getAttribute('aria-pressed') !== 'true';
    for (const id of ['#gateCurrent', '#gatePin', '#gateConfirm']) $(id).type = show ? 'text' : 'password';
    btn.setAttribute('aria-pressed', String(show));
    btn.setAttribute('aria-label', show ? 'Ocultar el PIN' : 'Mostrar el PIN');
    btn.title = show ? 'Ocultar el PIN' : 'Mostrar el PIN';
    btn.innerHTML = icon(show ? 'eyeOff' : 'eye');
  });
  $('#gateForgot').addEventListener('click', async () => {
    if (!DESKTOP) {
      setGateMessage('Cierra el servidor y ábrelo con «./serve.sh --restablecer-pin» (Windows: iniciar-windows.cmd -RestablecerPin). Tus canciones y presentaciones no se borran.', 'info');
      return;
    }
    // Sin el PIN solo queda empezar de cero: se borra todo lo de esta app en este equipo.
    const ok = prompt('Sin el PIN solo se puede empezar de cero: se borrarán el PIN, el nombre de la iglesia, las canciones, las presentaciones y la apariencia de este equipo.\n\nPara confirmar escribe BORRAR:');
    if (ok !== 'BORRAR') return;
    await tauri('app_forget').catch(() => {});
    await wipeLocalData();
    location.reload();
  });
}

// Arranque: la portada decide. Si algo falla, se queda en la portada: nunca abre la consola sin sesión.
// Mientras tanto se ve la pantalla de arranque (solo el ícono): ni la entrada ni la consola aparecen
// hasta saber cuál toca, así que con la sesión abierta nunca se ve el formulario de entrada.
async function startGate() {
  initGate();
  try {
    const secure = DESKTOP || (window.isSecureContext && !!crypto.subtle);
    // El estado del servidor y la llave del equipo se piden a la vez: arranque más rápido.
    const [st, device] = await Promise.all([authStatus(), secure && !DESKTOP ? deviceKey(false).catch(() => null) : null]);
    if (!st) { showGate('noserver'); return; }
    if (await wipeIfReinstalled(st.install)) return;
    if (!secure) { showGate('insecure'); return; }
    auth.configured = !!st.configured;
    auth.salt = st.salt || '';
    auth.name = nameFromB64(st.name || '');
    if (!st.configured) { showGate('register'); return; }
    auth.device = device;
    if ((DESKTOP || auth.device) && await checkSession()) { await openConsole(); return; }
    showGate('login');
  } catch {
    showGate('login');
  }
}
