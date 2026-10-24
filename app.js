'use strict';

/* ───────────── Utilidades ───────────── */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const plural = (n, one, many) => `${n.toLocaleString('es')} ${n === 1 ? one : many}`;
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const isCompact = () => matchMedia('(max-width: 1099px)').matches;

const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  },
};

const ICONS = {
  book: '<path d="M3.5 5.8c2.6-1 5.4-.8 8.5 1 3.1-1.8 5.9-2 8.5-1v12.4c-2.6-1-5.4-.8-8.5 1-3.1-1.8-5.9-2-8.5-1z"/><path d="M12 6.8v12.4"/>',
  music: '<path d="M9 17.5V6.2l10-2.2v11.3"/><circle cx="6.6" cy="17.6" r="2.4"/><circle cx="16.6" cy="15.4" r="2.4"/>',
  heart: '<path d="M12 19.5s-7.5-4.6-7.5-10.1A4.1 4.1 0 0 1 12 7.1a4.1 4.1 0 0 1 7.5 2.3c0 5.5-7.5 10.1-7.5 10.1z"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.3 2.4 3.5 5.2 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.2-3.5-8.5s1.2-6.1 3.5-8.5z"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.3"/><path d="m15.5 15.5 4.5 4.5"/>',
  chevronLeft: '<path d="m14.5 5.5-6.5 6.5 6.5 6.5"/>',
  chevronRight: '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
  display: '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M8.5 20h7M12 16.5V20"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  alignLeft: '<path d="M4 6.5h16M4 10.5h10M4 14.5h16M4 18.5h10"/>',
  alignCenter: '<path d="M4 6.5h16M7 10.5h10M4 14.5h16M7 18.5h10"/>',
  alignRight: '<path d="M4 6.5h16M10 10.5h10M4 14.5h16M10 18.5h10"/>',
  sliders: '<path d="M4 7.5h9M17 7.5h3M4 16.5h3M11 16.5h9"/><circle cx="15" cy="7.5" r="2"/><circle cx="9" cy="16.5" r="2"/>',
  live: '<circle cx="12" cy="12" r="2.2"/><path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.4 5.4a9.3 9.3 0 0 0 0 13.2M18.6 5.4a9.3 9.3 0 0 1 0 13.2"/>',
  image: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m20.5 15.5-4.8-4.8-8.7 8.3"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.8h5V7M6.8 7l.9 12.2h8.6l.9-12.2"/>',
  pencil: '<path d="M4.8 19.2l.9-4.1L15.9 4.9l3.2 3.2L8.9 18.3z"/>',
  save: '<path d="M12 4.5v10M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  folder: '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  folderPlus: '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M12 11v5M9.5 13.5h5"/>',
  upload: '<path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9M5 19.5h14"/>',
  camera: '<rect x="3" y="6.5" width="13" height="11" rx="2"/><path d="m16 10.5 5-3v9l-5-3z"/>',
  library: '<path d="M5 4.5v15M9.5 4.5v15M14 5.2l4.5 14.1"/>',
  text: '<path d="M5 6.5V5h14v1.5M12 5v14M9 19h6"/>',
  sparkles: '<path d="M10 4.5 11.6 9l4.4 1.6-4.4 1.6L10 16.7l-1.6-4.5L4 10.6 8.4 9z"/><path d="M17.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>',
  front: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 15.5V6a1 1 0 0 1 1-1h9.5"/>',
  back: '<rect x="5" y="5" width="11" height="11" rx="2"/><path d="M19 8.5V18a1 1 0 0 1-1 1H8.5"/>',
  pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
  layout: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><rect x="6.5" y="7.5" width="11" height="6" rx="1" stroke-dasharray="2 1.6"/><path d="M8.5 16.5h7"/>',
  restart: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v4h4"/>',
  repeat: '<path d="M5 10V8.5a2 2 0 0 1 2-2h11l-2.5-2.5M19 14v1.5a2 2 0 0 1-2 2H6l2.5 2.5"/>',
  sound: '<path d="M4.5 9.5h3l4-3.5v12l-4-3.5h-3z"/><path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11"/>',
  mute: '<path d="M4.5 9.5h3l4-3.5v12l-4-3.5h-3z"/><path d="m15.5 9.5 5 5M20.5 9.5l-5 5"/>',
  sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
  moon: '<path d="M19.5 14.6A7.5 7.5 0 0 1 9.4 4.5a7.5 7.5 0 1 0 10.1 10.1z"/>',
  halfCircle: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
  arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  eye: '<path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3.5 3.5l17 17M10.6 5.6c.46-.07.93-.1 1.4-.1 6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.6 6.7A17 17 0 0 0 2.5 12s3.5 6.5 9.5 6.5c1.6 0 3-.45 4.2-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2.2"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5"/>',
  palette: '<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.2 0 1.9-.8 1.9-1.8 0-.5-.2-.9-.5-1.3s-.5-.8-.5-1.3c0-1 .8-1.8 1.8-1.8h2.2a4.6 4.6 0 0 0 4.6-4.6c0-3.6-4.3-6.2-9.5-6.2z"/><g fill="currentColor" stroke="none"><circle cx="7.4" cy="11.6" r="1.3"/><circle cx="9.6" cy="7.6" r="1.3"/><circle cx="14.3" cy="7.3" r="1.3"/><circle cx="17.3" cy="10.6" r="1.3"/></g>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.7 9.7a2.4 2.4 0 0 1 4.7.7c0 1.6-2.4 2-2.4 3.5"/><circle cx="12" cy="17" r="0.4" fill="currentColor"/>',
  link: '<path d="M10.5 13.5a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1.2 1.2"/><path d="M13.5 10.5a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1.2-1.2"/>',
};
const icon = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
const hydrateIcons = (root) => $$('i[data-icon]', root).forEach((el) => { el.outerHTML = icon(el.dataset.icon); });

/* ───────────── Configuración ───────────── */
const KEY = {
  look: 'easybiblia.look', session: 'easybiblia.sesion', mine: 'easybiblia.canciones', folders: 'easybiblia.carpetas',
  media: 'easybiblia.medios', texts: 'easybiblia.textos', decks: 'easybiblia.presentaciones', ui: 'easybiblia.ui2',
  hymnEdits: 'easybiblia.himnos.cambios', hymnHidden: 'easybiblia.himnos.ocultos',
};

const SPANISH_BOOKS = ['Génesis', 'Éxodo', 'Levítico', 'Números', 'Deuteronomio', 'Josué', 'Jueces', 'Rut', '1 Samuel', '2 Samuel',
  '1 Reyes', '2 Reyes', '1 Crónicas', '2 Crónicas', 'Esdras', 'Nehemías', 'Ester', 'Job', 'Salmos', 'Proverbios', 'Eclesiastés',
  'Cantares', 'Isaías', 'Jeremías', 'Lamentaciones', 'Ezequiel', 'Daniel', 'Oseas', 'Joel', 'Amós', 'Abdías', 'Jonás', 'Miqueas',
  'Nahúm', 'Habacuc', 'Sofonías', 'Hageo', 'Zacarías', 'Malaquías', 'Mateo', 'Marcos', 'Lucas', 'Juan', 'Hechos', 'Romanos',
  '1 Corintios', '2 Corintios', 'Gálatas', 'Efesios', 'Filipenses', 'Colosenses', '1 Tesalonicenses', '2 Tesalonicenses',
  '1 Timoteo', '2 Timoteo', 'Tito', 'Filemón', 'Hebreos', 'Santiago', '1 Pedro', '2 Pedro', '1 Juan', '2 Juan', '3 Juan', 'Judas', 'Apocalipsis'];

// «books»: formato de scrollmapper/bible_databases; «array»: formato de thiagobodruk/bible (el de la RVR1960 incluida).
const SCROLLMAPPER = 'https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json';
const THIAGO = 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json';
const BIBLES = [
  { id: 'rvr1960', name: 'Reina-Valera 1960', abbr: 'RVR1960', lang: 'Español', note: 'Incluida', url: 'bible_rvr1960.json', format: 'array', bytes: 4290405, bundled: true },
  { id: 'rv1909', name: 'Reina-Valera 1909', abbr: 'RV1909', lang: 'Español', note: 'Dominio público', url: `${SCROLLMAPPER}/SpaRV.json`, format: 'books', bytes: 8188479 },
  { id: 'rv1865', name: 'Reina-Valera 1865', abbr: 'RV1865', lang: 'Español', note: 'Dominio público', url: `${SCROLLMAPPER}/SpaRV1865.json`, format: 'books', bytes: 8177598 },
  { id: 'kjv', name: 'King James Version', abbr: 'KJV', lang: 'Inglés', note: 'Dominio público', url: `${THIAGO}/en_kjv.json`, format: 'array', bytes: 4247556, keepNames: true },
  { id: 'web', name: 'World English Bible', abbr: 'WEB', lang: 'Inglés', note: 'Dominio público', url: `${THIAGO}/en_web.json`, format: 'array', bytes: 4220624, keepNames: true },
];
const bibleMeta = (id) => BIBLES.find((b) => b.id === id);
const fmtBytes = (n) => `${(n / 1048576).toLocaleString('es', { maximumFractionDigits: 1 })} MB`;

// Las Biblias descargadas se guardan en IndexedDB: ocupan varios MB y no caben en localStorage.
const idb = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('easybiblia', 3);
      req.onupgradeneeded = () => {
        for (const name of ['bibles', 'media', 'auth']) if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name);
      };
      req.onsuccess = () => {
        this.db = req.result;
        // Si otra pestaña necesita una versión nueva, esta cierra la suya para no bloquearla.
        this.db.onversionchange = () => { this.db.close(); this.db = null; };
        resolve(this.db);
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('bloqueada'));
    });
  },
  async run(store, mode, fn) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
    });
  },
  get(key, store = 'bibles') { return this.run(store, 'readonly', (st) => st.get(key)); },
  put(key, value, store = 'bibles') { return this.run(store, 'readwrite', (st) => st.put(value, key)); },
  del(key, store = 'bibles') { return this.run(store, 'readwrite', (st) => st.delete(key)); },
  keys(store = 'bibles') { return this.run(store, 'readonly', (st) => st.getAllKeys()); },
};

const FONTS = [
  { id: 'system', name: 'SF Pro', stack: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif' },
  { id: 'garamond', name: 'Garamond', stack: '"EB Garamond", Garamond, Georgia, serif' },
  { id: 'lora', name: 'Lora', stack: 'Lora, Georgia, serif' },
  { id: 'fraunces', name: 'Fraunces', stack: 'Fraunces, Georgia, serif' },
  { id: 'nunito', name: 'Nunito', stack: 'Nunito, "SF Pro Rounded", system-ui, sans-serif' },
  { id: 'oswald', name: 'Oswald', stack: 'Oswald, "Arial Narrow", sans-serif' },
];
const PALETTES = {
  color: [
    { name: 'Blanco', value: '#ffffff' }, { name: 'Marfil', value: '#f3e9d2' },
    { name: 'Oro', value: '#ffd479' }, { name: 'Tinta', value: '#1d1d1f' },
  ],
  stroke: [
    { name: 'Negro', value: '#000000' }, { name: 'Azul noche', value: '#0b2447' },
    { name: 'Blanco', value: '#ffffff' }, { name: 'Oro oscuro', value: '#8a6a12' },
  ],
  refColor: [
    { name: 'Blanco', value: '#ffffff' }, { name: 'Marfil', value: '#f3e9d2' },
    { name: 'Oro', value: '#ffd479' }, { name: 'Celeste', value: '#9fd3ff' },
  ],
  bg: [
    { name: 'Noche', value: '#0b0d12' }, { name: 'Grafito', value: '#1c1c1e' },
    { name: 'Azul profundo', value: '#0b2447' }, { name: 'Bosque', value: '#10291f' },
    { name: 'Vino', value: '#2b0e18' }, { name: 'Papel', value: '#f4efe6' },
  ],
  dimColor: [
    { name: 'Negro', value: '#000000' }, { name: 'Blanco', value: '#ffffff' },
    { name: 'Azul noche', value: '#0b2447' }, { name: 'Vino', value: '#4a0f22' }, { name: 'Dorado', value: '#6b4e00' },
  ],
  frameColor: [
    { name: 'Blanco', value: '#ffffff' }, { name: 'Oro', value: '#d4af37' },
    { name: 'Negro', value: '#000000' }, { name: 'Azul', value: '#0a84ff' },
  ],
};
const DEFAULT_LOOK = {
  font: 'system', size: 72, weight: 500, leading: 1.3, align: 'center', color: '#ffffff', fit: true, upper: false,
  stroke: 0, strokeColor: '#000000', shadow: true,
  refShow: true, refPos: 'bottom', refAlign: 'center', refFont: 'same', refSize: 30, refWeight: 500,
  refColor: 'same', refOpacity: 0.8, refUpper: true, refItalic: false, refVersion: false,
  bg: '#0b0d12', bgImage: null, bgAspect: 0, bgFit: 'cover', bgZoom: 100, bgX: 0, bgY: 0, bgBlur: 0,
  dim: 0.45, dimColor: '#000000', frame: 0, frameColor: '#ffffff',
  ratio: '16/9', valign: 'center', pad: 7,
  transition: 'fade', trDir: 'left', trIntensity: 'medium', trEase: 'smooth', trSpeed: 0.6,
  textAnim: 'slide', txDir: 'up', txIntensity: 'subtle', txEase: 'smooth', txSpeed: 0.6, txDelay: 0,
};
const TRANSITIONS = [['cut', 'Corte'], ['fade', 'Fundido'], ['black', 'Pasar por negro'], ['slide', 'Empujar'], ['zoom', 'Zoom'], ['blur', 'Desenfoque']];
const TEXT_ANIMS = [['none', 'Ninguna'], ['fade', 'Aparecer'], ['slide', 'Deslizar'], ['zoom', 'Acercar'], ['blur', 'Enfocar'], ['words', 'Palabra a palabra'], ['letters', 'Letra a letra']];
// Sutil / Media / Fuerte para cada efecto (en unidades del escenario: cqh = 1 % del alto).
const INTENSITY = { subtle: 0, medium: 1, strong: 2 };
// Curvas: las transiciones aceleran y frenan (como en Keynote); el texto frena al llegar. Una curva de
// salida demasiado fuerte termina casi al instante y hace que todos los efectos parezcan iguales.
const TR_EASES = { smooth: 'cubic-bezier(0.65, 0, 0.35, 1)', linear: 'linear', spring: 'cubic-bezier(0.34, 1.45, 0.64, 1)' };
const TX_EASES = { smooth: 'cubic-bezier(0.33, 1, 0.68, 1)', linear: 'linear', spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)' };
const FORMAT = {
  size: (v) => `${v} px`,
  refSize: (v) => `${v} px`,
  leading: (v) => Number(v).toFixed(2),
  stroke: (v) => (v ? `${v} px` : 'Sin borde'),
  frame: (v) => (v ? `${v} px` : 'Sin marco'),
  dim: (v) => `${Math.round(v * 100)} %`,
  refOpacity: (v) => `${Math.round(v * 100)} %`,
  pad: (v) => `${v} %`,
  bgZoom: (v) => `${v} %`,
  bgX: (v) => (v > 0 ? `${v} % →` : v < 0 ? `← ${-v} %` : 'Centro'),
  bgY: (v) => (v > 0 ? `${v} % ↓` : v < 0 ? `↑ ${-v} %` : 'Centro'),
  bgBlur: (v) => (v ? `${v} px` : 'Nítida'),
  trSpeed: (v) => `${Number(v).toFixed(2).replace('.', ',')} s`,
  txSpeed: (v) => `${Number(v).toFixed(2).replace('.', ',')} s`,
  txDelay: (v) => (Number(v) ? `${Number(v).toFixed(2).replace('.', ',')} s` : 'Sin retraso'),
};

// Abreviaturas en español que no se resuelven solo por prefijo del nombre.
const ABBR = {
  gn: 'genesis', ex: 'exodo', lv: 'levitico', nm: 'numeros', dt: 'deuteronomio', jue: 'jueces', rt: 'rut',
  sl: 'salmos', pr: 'proverbios', pv: 'proverbios', ec: 'eclesiastes', ct: 'cantares', cnt: 'cantares',
  lm: 'lamentaciones', dn: 'daniel', jl: 'joel', mq: 'miqueas', zc: 'zacarias', ml: 'malaquias',
  mt: 'mateo', mr: 'marcos', mc: 'marcos', lc: 'lucas', jn: 'juan', hch: 'hechos', ro: 'romanos', rm: 'romanos',
  gl: 'galatas', ga: 'galatas', ef: 'efesios', flp: 'filipenses', fil: 'filipenses', cl: 'colosenses',
  tt: 'tito', flm: 'filemon', he: 'hebreos', hb: 'hebreos', stg: 'santiago', ap: 'apocalipsis',
  '1jn': '1 juan', '2jn': '2 juan', '3jn': '3 juan', '1s': '1 samuel', '2s': '2 samuel', '1r': '1 reyes', '2r': '2 reyes',
};

const ratioNumber = (r) => { const [w, h] = String(r).split('/').map(Number); return w / h || 16 / 9; };
// La ventana del proyector: en la web, index.html?salida; en el ejecutable la marca la propia app.
const IS_OUTPUT = new URLSearchParams(location.search).has('salida') || !!window.__BIBLIA_SALIDA__;

/* Cajas del texto y de la cita, como en el editor de temas de EasyWorship: cada una con su posición
   (x, y) y su tamaño (w, h) en % de la pantalla. El texto se ajusta dentro de la suya; la cita, igual. */
const DEFAULT_LAYOUT = { text: { x: 7, y: 7, w: 86, h: 72 }, ref: { x: 7, y: 81, w: 86, h: 12 } };
const cloneLayout = (l) => ({ text: { ...l.text }, ref: { ...l.ref } });

// Los diseños guardados antes de las cajas se convierten desde sus «márgenes» y «cita arriba/abajo».
function layoutOf(look) {
  const l = look.layout;
  if (l?.text && l?.ref) return l;
  const p = clamp(Number(look.pad) || 7, 2, 20);
  const w = 100 - 2 * p;
  return look.refPos === 'top'
    ? { text: { x: p, y: p + 14, w, h: 100 - 2 * p - 14 }, ref: { x: p, y: p, w, h: 12 } }
    : { text: { x: p, y: p, w, h: 100 - 2 * p - 14 }, ref: { x: p, y: 100 - p - 12, w, h: 12 } };
}

function loadLook() {
  const stored = store.get(KEY.look, {}) || {};
  if ('showRef' in stored) { stored.refShow = stored.showRef; delete stored.showRef; }
  // Animaciones de la versión anterior: una sola velocidad y «Subir».
  if ('animSpeed' in stored) { stored.trSpeed ??= stored.animSpeed; stored.txSpeed ??= stored.animSpeed; delete stored.animSpeed; }
  if (stored.textAnim === 'rise') { stored.textAnim = 'slide'; stored.txDir = 'up'; }
  return { ...DEFAULT_LOOK, ...stored };
}

/* ───────────── Escenario compartido (vista previa, en vivo y proyector) ───────────── */
function createStage() {
  const stage = document.createElement('div');
  stage.className = 'stage';
  stage.innerHTML = '<div class="stage-bg"><div class="stage-bg-fill"></div><div class="stage-bg-img"></div></div><div class="stage-frame"></div><div class="stage-media"></div><div class="stage-design"></div><div class="stage-content"><div class="stage-inner"><div class="stage-box text-box"><p class="stage-text"></p></div><div class="stage-box ref-box"><p class="stage-ref"></p></div></div></div>';
  return stage;
}

function fontStack(id) {
  return (FONTS.find((f) => f.id === id) || FONTS[0]).stack;
}

/* Animación: una presentación puede traer su propia transición y velocidad; lo demás sale de Apariencia. */
const level = (v) => INTENSITY[v] ?? 1;
const MOVES = { left: ['1', '0'], right: ['-1', '0'], up: ['0', '1'], down: ['0', '-1'] };

function stageAnim(look, slide) {
  const transition = slide?.anim?.transition || look.transition || 'fade';
  const trSpeed = slide?.anim?.speed || look.trSpeed || 0.5;
  const textAnim = look.textAnim || 'slide';
  // Al pasar por negro, el texto espera a que se aclare la pantalla.
  const txDelay = (look.txDelay || 0) + (transition === 'black' ? trSpeed / 2 : 0);
  return { transition, trSpeed, textAnim, txSpeed: look.txSpeed || 0.5, txDelay };
}

function setAnimVars(stage, look, anim) {
  const set = (k, v) => stage.style.setProperty(k, v);
  const t = level(look.trIntensity);
  const x = level(look.txIntensity);
  const [mx, my] = MOVES[look.trDir] || MOVES.left;
  const [tx, ty] = MOVES[look.txDir] || MOVES.up;
  const dist = [2, 6, 14][x];
  set('--tr-dur', `${anim.trSpeed}s`);
  set('--tr-ease', TR_EASES[look.trEase] || TR_EASES.smooth);
  set('--tr-dx', `${mx * 100}cqw`);
  set('--tr-dy', `${my * 100}cqh`);
  set('--tr-zin', [0.9, 0.72, 0.5][t]);
  set('--tr-zout', [1.1, 1.35, 1.8][t]);
  set('--tr-blur', `${[1.2, 3.5, 8][t]}cqh`);
  set('--tx-dur', `${anim.txSpeed}s`);
  set('--tx-ease', TX_EASES[look.txEase] || TX_EASES.smooth);
  set('--tx-delay', `${anim.txDelay}s`);
  set('--tx-dx', `${tx * dist}cqh`);
  set('--tx-dy', `${ty * dist}cqh`);
  set('--tx-scale', [0.92, 0.72, 0.35][x]);
  set('--tx-blur', `${[0.8, 2.5, 6][x]}cqh`);
  set('--tx-word-y', `${[0.5, 1.5, 4][x]}cqh`);
  set('--tx-word-blur', `${[0, 0.5, 1.5][x]}cqh`);
}

// Identifica la diapositiva por su contenido: al proyector le llegan copias, no el mismo objeto.
const slideKey = (s) => (s ? [s.ref, s.label, s.text, s.media?.id || '', s.design?.id || ''].join('␟') : '');

const restartClass = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

// La diapositiva que se va: una copia congelada encima que sale con la transición mientras la nueva entra
// debajo. «Pasar por negro» añade un velo que oscurece todo y se aclara ya con la nueva.
function leaveStage(stage, transition, speed) {
  stage.querySelectorAll(':scope > :is(.stage-leaving, .stage-dip)').forEach((n) => n.remove());
  const later = (el) => setTimeout(() => el.remove(), speed * 1000 + 200);
  const src = stage.classList.contains('has-design') ? $(':scope > .stage-design', stage)
    : stage.classList.contains('has-media') ? null : $(':scope > .stage-content', stage);
  if (src) {
    const wrap = document.createElement('div');
    wrap.className = `stage-leaving t-${transition}`;
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.setProperty('--st-fit', stage.style.getPropertyValue('--st-fit') || '1');
    wrap.append(src.cloneNode(true));
    wrap.querySelectorAll('.enter').forEach((n) => n.classList.remove('enter'));
    stage.append(wrap);
    later(wrap);
  }
  if (transition === 'black') {
    const dip = document.createElement('div');
    dip.className = 'stage-dip';
    stage.append(dip);
    later(dip);
  }
}

// «Palabra a palabra» y «Letra a letra»: cada pieza en su span; la duración elegida es lo que tarda
// en aparecer todo el texto.
function setStageText(el, text, mode, duration) {
  if (mode !== 'words' && mode !== 'letters') { el.textContent = text; return; }
  el.replaceChildren();
  let n = 0;
  const piece = (cls, str) => {
    const sp = document.createElement('span');
    sp.className = cls;
    sp.style.setProperty('--i', n++);
    sp.textContent = str;
    return sp;
  };
  for (const part of text.split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) el.append(part);
    else if (mode === 'words') el.append(piece('w', part));
    else el.append(...[...part].map((ch) => piece('c', ch)));
  }
  const cap = mode === 'words' ? 0.18 : 0.08;
  el.style.setProperty('--step', `${Math.min(cap, duration / Math.max(n, 1)).toFixed(4)}s`);
  el.style.setProperty('--pieces', n);
}

function paintStage(stage, view, animate) {
  const { look, slide } = view;
  const s = stage.style;
  const set = (k, v) => s.setProperty(k, v);
  const anim = stageAnim(look, slide);
  const key = slideKey(slide);
  const changed = stage.dataset.key !== key;
  const play = changed && !!animate && !reducedMotion();
  setAnimVars(stage, look, anim);
  stage.dataset.txt = anim.textAnim;
  if (play && anim.transition !== 'cut' && stage.dataset.key) leaveStage(stage, anim.transition, anim.trSpeed);
  stage.dataset.key = key;
  set('--st-font', fontStack(look.font));
  set('--st-size', look.size);
  set('--st-weight', look.weight);
  set('--st-leading', look.leading);
  set('--st-color', look.color);
  set('--st-align', look.align);
  set('--st-upper', look.upper ? 'uppercase' : 'none');
  set('--st-stroke', look.stroke);
  set('--st-stroke-color', look.strokeColor);
  set('--st-bg', look.bg);
  set('--st-dim', look.bgImage ? look.dim : 0);
  set('--st-dim-color', look.dimColor || '#000000');
  // Mover y acercar el fondo nunca deja huecos: se desplaza la imagen dentro de su marco (posición del
  // fondo) y se acerca desde ese mismo punto. Al llenar, la imagen sobra y se mueve en sentido contrario
  // a la posición; al verla completa, sobra hueco y se mueve en el mismo sentido.
  const cover = (look.bgFit || 'cover') === 'cover';
  const dir = cover ? -1 : 1;
  set('--st-bg-fit', cover ? 'cover' : 'contain');
  set('--st-bg-zoom', cover ? Math.max(100, look.bgZoom ?? 100) : look.bgZoom ?? 100);
  set('--st-bg-px', `${clamp(50 + dir * (look.bgX ?? 0), 0, 100)}%`);
  set('--st-bg-py', `${clamp(50 + dir * (look.bgY ?? 0), 0, 100)}%`);
  set('--st-bg-blur', look.bgBlur ?? 0);
  set('--st-frame', look.frame);
  set('--st-frame-color', look.frameColor);
  set('--st-valign', look.valign);
  // Cajas del texto y de la cita (posición y tamaño en % de la pantalla).
  const lay = layoutOf(look);
  for (const [k, box] of [['tb', lay.text], ['rb', lay.ref]]) {
    set(`--${k}-x`, box.x); set(`--${k}-y`, box.y); set(`--${k}-w`, box.w); set(`--${k}-h`, box.h);
  }
  set('--ratio', look.ratio.replace('/', ' / '));
  set('--ratio-n', ratioNumber(look.ratio));
  set('--rf-font', look.refFont === 'same' ? fontStack(look.font) : fontStack(look.refFont));
  set('--rf-size', look.refSize);
  set('--rf-weight', look.refWeight);
  set('--rf-color', look.refColor === 'same' ? look.color : look.refColor);
  set('--rf-opacity', look.refOpacity);
  set('--rf-align', look.refAlign);
  set('--rf-upper', look.refUpper ? 'uppercase' : 'none');
  set('--rf-tracking', look.refUpper ? '0.1em' : '0');
  set('--rf-italic', look.refItalic ? 'italic' : 'normal');
  $('.stage-bg-img', stage).style.backgroundImage = look.bgImage ? `url("${look.bgImage}")` : 'none';
  $('.stage-bg-fill', stage).style.backgroundImage = look.bgImage && look.bgFit === 'blur' ? `url("${look.bgImage}")` : 'none';
  $('.stage-frame', stage).hidden = !look.frame;
  renderStageMedia(stage, slide?.media || null, view.playback || null, !!view.silent);
  renderStageDesign(stage, slide?.design || null);
  stage.classList.toggle('shadow', !!look.shadow);
  stage.classList.toggle('blank', !!view.blank);
  stage.classList.toggle('hide-text', !!view.hideText);

  const text = $('.stage-text', stage);
  const ref = $('.stage-ref', stage);
  if (changed) setStageText(text, slide ? slide.text : '', play ? anim.textAnim : 'plain', anim.txSpeed);
  ref.textContent = slide && look.refShow ? slide.ref + (look.refVersion && slide.version ? ` · ${slide.version}` : '') : '';
  ref.hidden = !ref.textContent;
  if (play) {
    restartClass($('.stage-inner', stage), 'enter');
    restartClass($('.stage-design', stage), 'enter');
    stage.dataset.tr = anim.transition;
    if (anim.transition === 'cut') stage.classList.remove('tr-in');
    else restartClass(stage, 'tr-in');
  }
  fitStage(stage, look);
}

/* Imágenes y videos en el escenario. Cada contexto (consola, proyector, OBS) decide de dónde sale el archivo. */
let resolveMedia = () => null;

// Captura el puntero para seguir el arrastre aunque salga del elemento (no todos los punteros lo permiten).
const capture = (el, id) => { try { el.setPointerCapture(id); } catch { /* puntero sin captura */ } };

// Lo define la consola: avisa si el navegador bloquea el sonido de un video.
let soundBlocked = () => {};

const playbackPosition = (pb) => pb.position + (pb.playing ? (Date.now() - pb.at) / 1000 : 0);

function renderStageMedia(stage, media, playback, silent) {
  const layer = $('.stage-media', stage);
  stage.classList.toggle('has-media', !!media);
  if (!media) {
    if (layer.dataset.id) { layer.replaceChildren(); layer.dataset.id = ''; }
    return;
  }
  const url = resolveMedia(media.id);
  let el = layer.firstElementChild;
  if (layer.dataset.id !== media.id || !el || (url && el.dataset.src !== url)) {
    layer.replaceChildren();
    layer.dataset.id = media.id;
    el = document.createElement(media.kind === 'video' ? 'video' : 'img');
    if (media.kind === 'video') {
      el.playsInline = true;
      el.preload = 'auto';
      el.addEventListener('loadedmetadata', () => {
        // Algunos .webm (grabaciones de pantalla) no traen su duración: se obliga al navegador a calcularla.
        if (el.duration === Infinity) {
          el.dataset.fixing = '1';
          const fix = () => {
            if (!Number.isFinite(el.duration)) return;
            el.removeEventListener('durationchange', fix);
            delete el.dataset.fixing;
            syncVideo(el);
          };
          el.addEventListener('durationchange', fix);
          el.currentTime = 1e7;
          return;
        }
        syncVideo(el);
      });
    } else {
      el.alt = '';
    }
    let tries = 0;
    el.addEventListener('error', () => {
      // En OBS el archivo puede tardar en subirse al servidor: se reintenta durante medio minuto.
      if (!el.dataset.src || ++tries > 30) return;
      setTimeout(() => { el.src = `${el.dataset.src}${el.dataset.src.includes('?') ? '&' : '?'}r=${Date.now()}`; }, 1000);
    });
    if (url) { el.src = url; el.dataset.src = url; }
    layer.append(el);
  }
  el.style.objectFit = media.fit || 'contain';
  if (media.kind === 'video') {
    el.loop = !!media.loop;
    el.muted = silent || !!media.muted;
    el.volume = clamp(media.volume ?? 1, 0, 1);
    el.pb = playback && playback.id === media.id ? playback : null;
    syncVideo(el);
  }
}

function syncVideo(el) {
  if (el.dataset.fixing) return;
  const pb = el.pb;
  if (!pb) { if (!el.paused) el.pause(); return; }
  let t = playbackPosition(pb);
  if (el.loop && el.duration) t %= el.duration;
  if (el.readyState >= 1 && Number.isFinite(t) && Math.abs(el.currentTime - t) > 0.4) el.currentTime = t;
  if (pb.playing && el.paused) {
    el.play().catch(() => {
      // El navegador puede bloquear el sonido hasta que alguien toque la ventana: se reproduce en silencio y se avisa.
      if (!el.muted) { el.muted = true; el.play().catch(() => {}); soundBlocked(el); }
    });
  } else if (!pb.playing && !el.paused) {
    el.pause();
  }
}

// Reduce la letra paso a paso hasta que el texto quepa dentro de los márgenes del escenario.
// Si el texto no cabe, se achica solo el texto (la cita conserva su tamaño) hasta el mayor tamaño que
// entra, buscándolo por mitades: unas pocas mediciones, sin saltos visibles.
function fitStage(stage, look) {
  const box = $('.text-box', stage);
  const text = $('.stage-text', stage);
  const set = (f) => stage.style.setProperty('--st-fit', f.toFixed(3));
  set(1);
  const max = box.clientHeight;
  const maxW = box.clientWidth;
  const fits = () => text.offsetHeight <= max && text.scrollWidth <= maxW + 1;
  if (!look.fit || !max || fits()) return;
  let lo = 0.15;
  let hi = 1;
  for (let i = 0; i < 9; i++) {
    const mid = (lo + hi) / 2;
    set(mid);
    if (fits()) lo = mid; else hi = mid;
  }
  set(lo);
}

/* ───────────── Ventana del proyector (index.html?salida) ───────────── */
function bootOutput() {
  const params = new URLSearchParams(location.search);
  const obs = params.has('obs');
  const transparent = params.has('transparente');
  // Llave de visor: OBS en otro equipo de la red solo puede leer con ella.
  const key = /^[0-9a-f]{32}$/.test(params.get('k') || '') ? `&k=${params.get('k')}` : '';
  const name = store.get(CHURCH_KEY, null)?.name || DEFAULT_NAME;
  document.title = `${name} · ${obs ? 'OBS' : 'Proyector'}`;
  document.body.className = `output${transparent ? ' transparent' : ''}`;
  document.body.replaceChildren();
  const stage = createStage();
  const hint = Object.assign(document.createElement('div'), { className: 'output-hint', textContent: DESKTOP && !obs ? '← →: pasar · B: oscurecer · Esc: cerrar el proyector' : 'Clic: pantalla completa · ← →: pasar · B: oscurecer' });
  document.body.append(stage);
  if (!obs) document.body.append(hint);

  const desktop = DESKTOP && !obs;
  let view = { look: loadLook(), slide: obs ? null : store.get(KEY.session, null)?.liveSlide ?? null, blank: false, hideText: false };
  const paint = (animate) => {
    const look = transparent ? { ...view.look, bg: 'transparent', bgImage: null } : view.look;
    // La ventana del proyector no puede reproducir sonido sin que alguien la toque; el sonido sale de la consola.
    paintStage(stage, { ...view, look, silent: !obs }, animate);
  };

  if (desktop) {
    // Ejecutable: la consola le pasa lo en vivo por eventos internos de la app (nada pasa por la red), y
    // las imágenes y videos se leen del mismo almacén que usa la consola.
    const files = new Map();
    resolveMedia = (id) => {
      if (files.has(id)) return files.get(id);
      files.set(id, null);
      idb.get(id, 'media').then((blob) => { if (blob) { files.set(id, URL.createObjectURL(blob)); paint(false); } }).catch(() => {});
      return null;
    };
    paint(false);
    tauri('get_live').then((json) => { const st = JSON.parse(json); if (st) { view = st; paint(false); } }).catch(() => {});
    window.__TAURI__.event.listen('live', (e) => { const st = JSON.parse(e.payload); if (st) { view = st; paint(true); } });
  } else {
    // El proyector y OBS leen lo que está en vivo del servidor, que solo acepta cambios firmados por la
    // consola con sesión: nadie puede mandarles diapositivas desde otra pestaña ni desde el inspector.
    resolveMedia = (id) => `api/media?id=${encodeURIComponent(id)}${key}`;
    paint(false);
    (async () => {
      let rev = -1;
      for (;;) {
        try {
          const res = await fetch(`api/live?rev=${rev}${key}`, { cache: 'no-store' });
          const data = await res.json();
          if (data.rev !== rev) { rev = data.rev; if (data.state) { view = data.state; paint(true); } }
        } catch {
          await sleep(1500);
        }
      }
    })();
  }

  // La ventana del proyector avisa a la consola que la abrió (y le pasa las teclas) directamente, no
  // por un canal que cualquier pestaña pueda escuchar o usar. En el ejecutable, por un evento de la app.
  const tell = (msg) => {
    if (desktop) { if (msg.type === 'output-key') window.__TAURI__.event.emitTo('consola', 'salida-tecla', msg.key); return; }
    try { window.opener?.postMessage(msg, location.origin); } catch { /* sin consola */ }
  };
  if (!obs && !desktop) {
    tell({ type: 'hello' });
    setInterval(() => tell({ type: 'hello' }), 5000);
    addEventListener('pagehide', () => tell({ type: 'bye' }));
  }

  const goFullscreen = () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}); };
  addEventListener('click', goFullscreen);
  addEventListener('keydown', (e) => {
    if (e.key === 'f' || e.key === 'F') { goFullscreen(); return; }
    if (desktop && e.key === 'Escape') { tauri('close_projector'); return; }
    const forwarded = ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'ArrowLeft', 'ArrowUp', 'PageUp', 'Enter', 'b', 'B', '.'];
    if (forwarded.includes(e.key) && !obs) { e.preventDefault(); tell({ type: 'output-key', key: e.key }); }
  });

  let idleTimer;
  const wake = () => { document.body.classList.remove('idle'); clearTimeout(idleTimer); idleTimer = setTimeout(() => document.body.classList.add('idle'), 2000); };
  addEventListener('mousemove', wake);
  wake();
  setTimeout(() => hint.classList.add('gone'), 4000);
  document.addEventListener('fullscreenchange', () => hint.classList.add('gone'));

  new ResizeObserver(() => fitStage(stage, view.look)).observe(stage);
  document.fonts?.addEventListener?.('loadingdone', () => fitStage(stage, view.look));
}

/* Estado «En vivo» para OBS: la consola lo envía al servidor si este lo admite (./serve.sh). */
let serverLive = false;

async function detectServer() {
  // En el ejecutable no hay servidor: lo en vivo va directo a la ventana del proyector.
  if (DESKTOP) { serverLive = true; postLive(); return; }
  try {
    const res = await fetch('api/live?rev=-1', { cache: 'no-store' });
    serverLive = res.ok && (res.headers.get('content-type') || '').includes('json');
  } catch {
    serverLive = false;
  }
  if (serverLive) postLive();
}

// Envía al momento, sin temporizadores (el navegador los frena hasta 1 s en ventanas tapadas, como la
// consola detrás del proyector a pantalla completa). Si hay un envío en camino, se manda el último después.
let postBusy = false;
let postDirty = false;

function postLive() {
  if (!serverLive || auth.mode !== 'open') return;
  postDirty = true;
  if (postBusy) return;
  postBusy = true;
  (async () => {
    while (postDirty && auth.mode === 'open') {
      postDirty = false;
      try { await apiSend('api/live', { body: JSON.stringify(state.live), headers: { 'Content-Type': 'application/json' } }); } catch { /* el siguiente cambio lo reintenta */ }
    }
    postBusy = false;
  })();
}

/* ───────────── Consola: estado ───────────── */
const state = {
  bible: [],
  bookIndex: [],
  verseIndex: null,
  verseCount: 0,
  hymnals: [],
  mine: [],
  loadError: null,

  bibleId: 'rvr1960',
  bundledBible: null,
  installed: new Set(['rvr1960']),
  downloads: {},
  bibleManage: false,
  folders: [],
  media: [],
  texts: [],
  decks: [],
  playback: { id: null, playing: false, position: 0, at: 0 },

  tab: 'bible',
  songLib: null,
  openBook: null,
  query: { bible: '', songs: '', media: '', web: '' },
  web: { status: 'idle', results: [], artists: [], token: 0, q: '', artist: null, loadingTrack: null },
  webSong: null,

  item: null,
  previewIndex: 0,
  onAir: false,
  live: { slide: null, blank: false, hideText: false, look: { ...DEFAULT_LOOK } },

  inspTab: 'text',
  pane: 'library',
  outputConnected: false,
  outWin: null,
  editingId: null,
};
let stage;
const webCache = new Map();

/* Elementos que se pueden proyectar: un capítulo de la Biblia o una canción. */
// Textos propios de versículos, por versión de la Biblia: «rvr1960|42|2|15» → texto.
const VERSE_EDITS_KEY = 'easybiblia.versiculos';
const verseKey = (b, ch, v) => `${state.bibleId}|${b}|${ch}|${v}`;
let verseEditsCache = null;
function verseEdits() {
  if (!verseEditsCache) verseEditsCache = store.get(VERSE_EDITS_KEY, {}) || {};
  return verseEditsCache;
}

// Editar el versículo de la vista previa: el texto propio se proyecta en lugar del de la versión.
function openVerseEditor() {
  const it = state.item;
  const slide = it?.slides[state.previewIndex];
  if (!slide) return;
  const dlg = $('#verseDialog');
  dlg.dataset.b = it.b;
  dlg.dataset.ch = it.ch;
  dlg.dataset.v = slide.v;
  $('#verseRef').textContent = `${slide.ref} · ${bibleMeta(state.bibleId).name}`;
  $('#verseText').value = slide.text;
  $('#verseRestore').hidden = !slide.edited;
  dlg.returnValue = '';
  dlg.showModal();
  $('#verseText').focus();
}

function saveVerseEdit(b, ch, v, text) {
  const edits = verseEdits();
  const original = state.bible[b].chapters[ch][v];
  const key = verseKey(b, ch, v);
  if (!text.trim() || text.trim() === original.trim()) delete edits[key]; else edits[key] = text.trim();
  store.set(VERSE_EDITS_KEY, edits);
  // Se rehace lo abierto y lo que está en vivo (si es ese capítulo) para que se vea al momento.
  const rebuild = (item) => (item?.kind === 'bible' && item.b === b && item.ch === ch ? makeBibleItem(item.b, item.ch, item.from, item.to) : null);
  const before = state.item;
  const fresh = rebuild(before);
  if (fresh) state.item = fresh;
  if (state.liveAt) {
    const live = state.liveAt.item === before ? fresh : rebuild(state.liveAt.item);
    if (live) state.liveAt = { item: live, i: state.liveAt.i };
  }
  renderStrip();
  update(false);
}

/* ---------- Editor de diseño: las cajas del texto y de la cita ---------- */
const LAYOUT_SAMPLE = { text: 'Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.', ref: 'Juan 3:16' };
const LAYOUT_NAMES = { text: 'Texto', ref: 'Cita' };
const layoutEd = { sel: 'text', lay: null, stage: null, drag: null, frame: 0 };

function layoutSlide() {
  const s = currentSlide();
  return s?.text ? s : LAYOUT_SAMPLE;
}

function openLayoutEditor(which) {
  const dlg = $('#layoutDialog');
  layoutEd.sel = which === 'ref' ? 'ref' : 'text';
  layoutEd.lay = cloneLayout(layoutOf(state.live.look));
  if (!layoutEd.stage) {
    layoutEd.stage = createStage();
    $('#layoutCanvas').prepend(layoutEd.stage);
    new ResizeObserver(() => layoutEd.stage && dlg.open && paintLayoutStage()).observe(layoutEd.stage);
  }
  dlg.showModal();
  renderLayoutEditor();
}

function paintLayoutStage() {
  paintStage(layoutEd.stage, { look: { ...state.live.look, layout: layoutEd.lay }, slide: layoutSlide(), silent: true }, false);
}

function renderLayoutEditor() {
  paintLayoutStage();
  const ov = $('#layoutOverlay');
  const hiddenRef = !state.live.look.refShow;
  ov.innerHTML = ['text', 'ref'].map((k) => {
    const sel = k === layoutEd.sel;
    return `<div class="ov-box lay-box${sel ? ' sel' : ''}" data-lay="${k}" tabindex="-1">
      <span class="lay-tag">${LAYOUT_NAMES[k]}${k === 'ref' && hiddenRef ? ' (oculta)' : ''}</span>
      ${sel ? ['nw', 'ne', 'sw', 'se'].map((h) => `<span class="ov-handle ${h}" data-handle="${h}"></span>`).join('') : ''}
    </div>`;
  }).join('');
  placeLayoutBoxes();
  renderLayoutInspector();
}

function placeLayoutBoxes() {
  for (const k of ['text', 'ref']) {
    const b = layoutEd.lay[k];
    const el = $(`#layoutOverlay [data-lay="${k}"]`);
    if (el) Object.assign(el.style, { left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` });
  }
}

const fmtPct = (v) => `${Math.round(v * 10) / 10} %`;
function renderLayoutInspector() {
  const k = layoutEd.sel;
  const b = layoutEd.lay[k];
  const range = (prop, label, max) => `
    <div class="ctl"><div class="ctl-label"><label for="lay-${prop}">${label}</label><span class="val" data-lay-val="${prop}">${fmtPct(b[prop])}</span></div>
      <input type="range" id="lay-${prop}" data-lay-prop="${prop}" min="${prop === 'w' || prop === 'h' ? 5 : 0}" max="${max}" step="0.5" value="${b[prop]}">
    </div>`;
  $('#layoutInspector').innerHTML = `
    <div class="segmented" role="group" aria-label="Caja">
      ${['text', 'ref'].map((c) => `<button type="button" data-lay-pick="${c}" aria-pressed="${c === k}">${LAYOUT_NAMES[c]}</button>`).join('')}
    </div>
    <p class="si-title">Caja de${k === 'text' ? 'l texto' : ' la cita'}</p>
    ${range('x', 'Horizontal (X)', 100 - b.w)}
    ${range('y', 'Vertical (Y)', 100 - b.h)}
    ${range('w', 'Ancho', 100)}
    ${range('h', 'Alto', 100)}
    <div class="btn-grid">
      <button class="btn" type="button" data-layout="center-x">Centrar horizontal</button>
      <button class="btn" type="button" data-layout="center-y">Centrar vertical</button>
      <button class="btn" type="button" data-layout="match">Mismo ancho que ${k === 'text' ? 'la cita' : 'el texto'}</button>
      <button class="btn" type="button" data-layout="full">Todo el ancho</button>
    </div>
    ${k === 'text' ? `<div class="ctl"><div class="ctl-label">Texto dentro de su caja</div>
      <div class="segmented">${[['flex-start', 'Arriba'], ['center', 'Centro'], ['flex-end', 'Abajo']].map(([v, n]) => `<button type="button" data-lay-valign="${v}" aria-pressed="${state.live.look.valign === v}">${n}</button>`).join('')}</div>
    </div>
    <p class="studio-hint">Si el texto no cabe, la letra se reduce sola para que entre en la caja.</p>`
    : `<p class="studio-hint">La cita conserva su tamaño de letra. Para separarla del texto, muévela: no hace falta tocar márgenes.</p>`}
    <p class="studio-hint">Flechas del teclado: mover poco a poco (con Mayús, más rápido).</p>`;
}

function syncLayoutInspector() {
  const b = layoutEd.lay[layoutEd.sel];
  for (const p of ['x', 'y', 'w', 'h']) {
    const input = $(`#layoutInspector [data-lay-prop="${p}"]`);
    if (!input) continue;
    if (p === 'x') input.max = 100 - b.w;
    if (p === 'y') input.max = 100 - b.h;
    if (document.activeElement !== input) input.value = b[p];
    $(`#layoutInspector [data-lay-val="${p}"]`).textContent = fmtPct(b[p]);
  }
}

// Mantiene la caja dentro de la pantalla.
function clampBox(b) {
  b.w = clamp(b.w, 5, 100);
  b.h = clamp(b.h, 5, 100);
  b.x = clamp(b.x, 0, 100 - b.w);
  b.y = clamp(b.y, 0, 100 - b.h);
  for (const p of ['x', 'y', 'w', 'h']) b[p] = Math.round(b[p] * 10) / 10;
}

// Cada cambio se ve al momento en el editor, en las vistas y en la salida (proyector y OBS).
function commitLayout(guides = {}) {
  scheduleLook({ layout: cloneLayout(layoutEd.lay) });
  if (layoutEd.frame) return;
  layoutEd.frame = requestAnimationFrame(() => {
    layoutEd.frame = 0;
    paintLayoutStage();
    placeLayoutBoxes();
    syncLayoutInspector();
    const ov = $('#layoutOverlay');
    $$('.ov-guide', ov).forEach((g) => g.remove());
    if (guides.v) ov.insertAdjacentHTML('beforeend', '<div class="ov-guide v"></div>');
    if (guides.h) ov.insertAdjacentHTML('beforeend', '<div class="ov-guide h"></div>');
  });
}

function initLayoutEditor() {
  const dlg = $('#layoutDialog');
  const ov = $('#layoutOverlay');
  document.addEventListener('click', (e) => {
    const open = e.target.closest('[data-open-layout]');
    if (open) openLayoutEditor(open.dataset.openLayout);
  });

  ov.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const boxEl = e.target.closest('[data-lay]');
    if (!boxEl) return;
    e.preventDefault();
    const k = boxEl.dataset.lay;
    if (layoutEd.sel !== k) { layoutEd.sel = k; renderLayoutEditor(); }
    const r = ov.getBoundingClientRect();
    layoutEd.drag = {
      mode: e.target.closest('[data-handle]')?.dataset.handle || 'move',
      x0: e.clientX, y0: e.clientY, start: { ...layoutEd.lay[k] }, W: r.width, H: r.height, moved: false,
    };
    capture(ov, e.pointerId);
  });
  ov.addEventListener('pointermove', (e) => {
    const d = layoutEd.drag;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 3) return;
    d.moved = true;
    const dx = ((e.clientX - d.x0) / d.W) * 100;
    const dy = ((e.clientY - d.y0) / d.H) * 100;
    const b = layoutEd.lay[layoutEd.sel];
    const { start } = d;
    const guides = {};
    if (d.mode === 'move') {
      b.x = start.x + dx;
      b.y = start.y + dy;
      clampBox(b);
      if (Math.abs(b.x + b.w / 2 - 50) < 1.2) { b.x = 50 - b.w / 2; guides.v = true; }
      if (Math.abs(b.y + b.h / 2 - 50) < 1.6) { b.y = 50 - b.h / 2; guides.h = true; }
    } else {
      const left = d.mode.includes('w');
      const top = d.mode.includes('n');
      const w = clamp(start.w + (left ? -dx : dx), 5, left ? start.x + start.w : 100 - start.x);
      const h = clamp(start.h + (top ? -dy : dy), 5, top ? start.y + start.h : 100 - start.y);
      Object.assign(b, { w, h, x: left ? start.x + start.w - w : start.x, y: top ? start.y + start.h - h : start.y });
      clampBox(b);
    }
    commitLayout(guides);
  });
  const end = () => {
    if (!layoutEd.drag) return;
    layoutEd.drag = null;
    $$('.ov-guide', ov).forEach((g) => g.remove());
  };
  ov.addEventListener('pointerup', end);
  ov.addEventListener('pointercancel', end);

  // Flechas: mover la caja elegida 0,5 % (o 2 % con Mayús).
  dlg.addEventListener('keydown', (e) => {
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!dir || e.target.matches('input, select, textarea')) return;
    e.preventDefault();
    const step = e.shiftKey ? 2 : 0.5;
    const b = layoutEd.lay[layoutEd.sel];
    b.x += dir[0] * step;
    b.y += dir[1] * step;
    clampBox(b);
    commitLayout();
  });

  $('#layoutInspector').addEventListener('input', (e) => {
    const p = e.target.dataset.layProp;
    if (!p) return;
    const b = layoutEd.lay[layoutEd.sel];
    b[p] = Number(e.target.value);
    clampBox(b);
    commitLayout();
  });

  dlg.addEventListener('click', (e) => {
    const pick = e.target.closest('[data-lay-pick]');
    if (pick) { layoutEd.sel = pick.dataset.layPick; renderLayoutEditor(); return; }
    const va = e.target.closest('[data-lay-valign]');
    if (va) { setLook({ valign: va.dataset.layValign }); renderLayoutEditor(); return; }
    const act = e.target.closest('[data-layout]')?.dataset.layout;
    if (!act) return;
    const b = layoutEd.lay[layoutEd.sel];
    const other = layoutEd.lay[layoutEd.sel === 'text' ? 'ref' : 'text'];
    if (act === 'close') return dlg.close();
    if (act === 'reset') {
      layoutEd.lay = cloneLayout(DEFAULT_LAYOUT);
      setLook({ layout: cloneLayout(DEFAULT_LAYOUT), valign: 'center' });
      renderLayoutEditor();
      return toast('Diseño restablecido.');
    }
    if (act === 'center-x') b.x = (100 - b.w) / 2;
    if (act === 'center-y') b.y = (100 - b.h) / 2;
    if (act === 'match') { b.x = other.x; b.w = other.w; }
    if (act === 'full') { b.x = DEFAULT_LAYOUT.text.x; b.w = DEFAULT_LAYOUT.text.w; }
    clampBox(b);
    commitLayout();
  });
}

function initVerseEditor() {
  const dlg = $('#verseDialog');
  dlg.addEventListener('close', () => {
    if (dlg.returnValue !== 'save') return;
    saveVerseEdit(Number(dlg.dataset.b), Number(dlg.dataset.ch), Number(dlg.dataset.v), $('#verseText').value);
    toast('Versículo guardado');
  });
  $('#verseRestore').addEventListener('click', () => {
    const original = state.bible[Number(dlg.dataset.b)].chapters[Number(dlg.dataset.ch)][Number(dlg.dataset.v)];
    $('#verseText').value = original;
    $('#verseRestore').hidden = true;
  });
}

function makeBibleItem(b, ch, from = 0, to = null) {
  const bk = state.bible[b];
  const verses = bk.chapters[ch];
  const start = clamp(from, 0, verses.length - 1);
  const end = to == null ? verses.length - 1 : clamp(to, start, verses.length - 1);
  const full = start === 0 && end === verses.length - 1;
  const count = end - start + 1;
  return {
    kind: 'bible', b, ch, from: start, to: end, full,
    title: full ? `${bk.name} ${ch + 1}` : `${bk.name} ${ch + 1}:${start + 1}${end > start ? `–${end + 1}` : ''}`,
    sub: `${bibleMeta(state.bibleId).name} · ${plural(count, 'versículo', 'versículos')}${full ? '' : ` de ${verses.length}`}`,
    slides: verses.slice(start, end + 1).map((t, k) => {
      const v = start + k;
      const own = verseEdits()[verseKey(b, ch, v)];
      return { label: `v. ${v + 1}`, v, text: own ?? t, original: t, edited: own != null, ref: `${bk.name} ${ch + 1}:${v + 1}`, version: bibleMeta(state.bibleId).abbr };
    }),
  };
}

function makeSongItem(song) {
  return {
    kind: 'song', song,
    title: song.title,
    sub: [song.number ? `N.º ${song.number}` : '', song.author, plural(song.slides.length, 'diapositiva', 'diapositivas')].filter(Boolean).join(' · '),
    slides: song.slides.map((s) => ({ label: s.label, text: s.text, ref: song.title, coro: !!s.coro })),
  };
}

function makeTextItem(t) {
  return {
    kind: 'text', text: t,
    title: t.title,
    sub: `Texto · ${plural(t.slides.length, 'diapositiva', 'diapositivas')}`,
    slides: t.slides.map((s) => ({ label: s.label, text: s.text, ref: '' })),
  };
}

function makeMediaItem(m) {
  return {
    kind: 'media', media: m,
    title: m.name,
    sub: `${m.kind === 'video' ? 'Video' : 'Imagen'} · ${fmtBytes(m.size)}`,
    slides: [{ label: m.kind === 'video' ? 'Video' : 'Imagen', text: '', ref: '', media: m }],
  };
}

const itemKey = (it) => it.song || it.text || it.media || it.deck;
const sameItem = (a, b) => !!a && !!b && a.kind === b.kind
  && (a.kind === 'bible' ? a.b === b.b && a.ch === b.ch && a.from === b.from && a.to === b.to : itemKey(a) === itemKey(b));
const slideLabel = (item, i) => (item.kind === 'bible' ? item.slides[i].ref : `${item.title} · ${item.slides[i].label}`);
const describe = (item) => (!item ? null
  : item.kind === 'bible' ? { kind: 'bible', b: item.b, ch: item.ch, from: item.from, to: item.to }
  : item.kind === 'text' ? { kind: 'text', id: item.text.id }
  : item.kind === 'media' ? { kind: 'media', id: item.media.id }
  : item.kind === 'deck' ? { kind: 'deck', id: item.deck.id }
  : { kind: 'song', source: item.song.source, id: item.song.id });

function itemFrom(desc) {
  if (!desc) return null;
  if (desc.kind === 'bible') return state.bible[desc.b]?.chapters[desc.ch] ? makeBibleItem(desc.b, desc.ch, desc.from ?? 0, desc.to ?? null) : null;
  if (desc.kind === 'text') { const t = state.texts.find((x) => x.id === desc.id); return t ? makeTextItem(t) : null; }
  if (desc.kind === 'media') { const m = state.media.find((x) => x.id === desc.id); return m ? makeMediaItem(m) : null; }
  if (desc.kind === 'deck') { const d = state.decks.find((x) => x.id === desc.id); return d?.slides.length ? makeDeckItem(d) : null; }
  const song = findSong(desc.source, desc.id);
  return song ? makeSongItem(song) : null;
}

/* ───────────── Consola: arranque ───────────── */
async function bootConsole() {
  hydrateIcons(document);
  state.live.look = loadLook();
  state.mine = store.get(KEY.mine, []);
  state.folders = store.get(KEY.folders, []);
  state.media = store.get(KEY.media, []);
  state.texts = store.get(KEY.texts, []);
  state.decks = store.get(KEY.decks, []);
  state.hymnEdits = store.get(KEY.hymnEdits, {}) || {};
  state.hymnHidden = new Set(store.get(KEY.hymnHidden, []));
  resolveMedia = consoleMediaUrl;
  soundBlocked = (el) => {
    if (el.dataset.warned) return;
    el.dataset.warned = '1';
    toast('El navegador silenció el video.', { label: 'Activar sonido', fn: () => { el.muted = false; el.play().catch(() => {}); } });
  };
  const ui = store.get(KEY.ui, {});
  state.tab = ['bible', 'songs', 'media', 'web'].includes(ui.tab) ? ui.tab : 'bible';
  state.songLib = ui.songLib || null;
  state.openBook = Number.isInteger(ui.openBook) ? ui.openBook : null;

  stage = createStage();
  $('#monitor').prepend(stage);
  new ResizeObserver(() => fitStage(stage, state.live.look)).observe(stage);
  document.fonts?.addEventListener?.('loadingdone', refitStages);

  buildLookPanel();
  bindEvents();
  bindGoto();
  bindStudio();
  bindInspectorDrag(ui.inspPos);
  setupGlassSegments();
  setInspector(false);
  matchMedia('(max-width: 1099px)').addEventListener('change', () => setInspector(inspectorOpen()));
  setInspTab(ui.inspTab || 'text');
  setPane(ui.pane || 'library');
  syncLookControls();
  applyRootRatio();
  renderLibrary();
  renderStrip();
  update(false);
  detectServer();

  if (location.protocol === 'file:') {
    state.loadError = 'file';
    sessionReady = true;
    renderLibrary();
    return;
  }
  try {
    const [bible, hymnals] = await Promise.all([fetchJSON('bible_rvr1960.json'), fetchJSON('himnarios.json').catch(() => [])]);
    state.bundledBible = bible;
    state.hymnals = hymnals.map(hymnalToLibrary);
    try { (await idb.keys()).forEach((k) => state.installed.add(k)); } catch { /* sin IndexedDB: solo la Biblia incluida */ }
    let loaded = false;
    if (ui.bibleId && ui.bibleId !== 'rvr1960' && state.installed.has(ui.bibleId)) {
      const data = await idb.get(ui.bibleId).catch(() => null);
      if (data) { setBible(data, ui.bibleId); loaded = true; }
    }
    if (!loaded) setBible(bible, 'rvr1960');
  } catch (err) {
    state.loadError = String(err.message || err);
    sessionReady = true;
    renderLibrary();
    return;
  }
  if (!library(state.songLib)) state.songLib = null;
  if (state.openBook != null && !state.bible[state.openBook]) state.openBook = null;
  restoreSession(store.get(KEY.session, null));
  renderLibrary();
  syncGotoFromItem();
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} respondió ${res.status}`);
  return res.json();
}

function setBible(data, id) {
  state.bibleId = id;
  state.bible = data;
  state.verseIndex = null;
  state.bookIndex = data.map((b) => { const n = norm(b.name); return { n, bare: n.replace(/^[1-3] /, '') }; });
  state.verseCount = data.reduce((sum, b) => sum + b.chapters.reduce((s, c) => s + c.length, 0), 0);
}

function hymnalToLibrary(h) {
  return {
    id: `hymnal:${h.id}`,
    name: h.nombre,
    songs: (h.himnos || []).map((x) => {
      let n = 0;
      return withHymnEdit({
        id: String(x.numero),
        number: x.numero,
        title: x.titulo,
        author: x.autor || '',
        source: `hymnal:${h.id}`,
        slides: (x.estrofas || []).map((e) => {
          const coro = e.tipo === 'coro';
          return { label: coro ? 'Coro' : `Estrofa ${++n}`, text: String(e.texto).trim(), coro };
        }),
      });
    }),
  };
}

/* Los himnos vienen del archivo incluido, que no se toca: los cambios y los eliminados se guardan aparte. */
const songKey = (s) => `${s.source}|${s.id}`;
const isHidden = (s) => !!state.hymnHidden?.has(songKey(s));

function withHymnEdit(song) {
  song.original = { title: song.title, author: song.author, slides: song.slides };
  const edit = state.hymnEdits?.[songKey(song)];
  if (edit) Object.assign(song, edit, { edited: true });
  return song;
}

function saveHymnEdit(song, data) {
  const o = song.original;
  const same = o && o.title === data.title && (o.author || '') === (data.author || '') && slidesToText(o.slides) === slidesToText(data.slides);
  if (same) { delete state.hymnEdits[songKey(song)]; Object.assign(song, o, { edited: false }); }
  else { state.hymnEdits[songKey(song)] = data; Object.assign(song, data, { edited: true }); }
  store.set(KEY.hymnEdits, state.hymnEdits);
}

function library(id) {
  if (id === 'mine') return { id: 'mine', name: 'Todas mis canciones', songs: state.mine, editable: true };
  if (id === 'folder:none') return { id, name: 'Sin carpeta', songs: state.mine.filter((s) => !folderOf(s)), editable: true };
  if (String(id).startsWith('folder:')) {
    const folder = state.folders.find((f) => f.id === id.slice(7));
    return folder ? { id, name: folder.name, songs: state.mine.filter((s) => s.folderId === folder.id), editable: true, folder } : null;
  }
  const h = state.hymnals.find((x) => x.id === id);
  if (!h) return null;
  const hiddenCount = h.songs.filter(isHidden).length;
  return hiddenCount ? { ...h, songs: h.songs.filter((x) => !isHidden(x)), hiddenCount } : h;
}

const folderOf = (song) => state.folders.find((f) => f.id === song.folderId) || null;

function findSong(source, id) {
  if (source === 'web') return state.webSong?.id === id ? state.webSong : null;
  return library(source)?.songs.find((s) => s.id === id) || null;
}

// Hasta restaurar la sesión, la consola no guarda ni avisa al proyector: si no, al recargar se
// guardaría una sesión vacía y el proyector se apagaría aunque estuviera en vivo.
let sessionReady = false;

function restoreSession(s) {
  const item = itemFrom(s?.item);
  if (item) {
    state.item = item;
    state.previewIndex = clamp(s.previewIndex || 0, 0, item.slides.length - 1);
    if (item.kind === 'media') state.playback = { id: item.media.id, playing: false, position: 0, at: Date.now() };
  } else if (state.bible[42]) {
    state.item = makeBibleItem(42, 2);
    state.previewIndex = 15;
    if (state.openBook == null) state.openBook = 42;
  }
  // Lo que estaba en vivo sigue en vivo tras recargar.
  const wasLive = s?.onAir ? itemFrom(s.liveAt?.item) : null;
  if (wasLive) {
    const liveItem = sameItem(wasLive, state.item) ? state.item : wasLive;
    state.liveAt = { item: liveItem, i: clamp(s.liveAt.i ?? 0, 0, liveItem.slides.length - 1) };
    state.onAir = true;
    if (!studioOn()) { state.item = liveItem; state.previewIndex = state.liveAt.i; }
  }
  sessionReady = true;
  renderStrip();
  update(false);
}

function saveSession() {
  if (!sessionReady) return;
  store.set(KEY.session, {
    item: describe(state.item), previewIndex: state.previewIndex, liveSlide: state.live.slide,
    onAir: state.onAir, liveAt: state.onAir && state.liveAt ? { item: describe(state.liveAt.item), i: state.liveAt.i } : null,
  });
}

function saveUI() {
  store.set(KEY.ui, {
    pane: state.pane, tab: state.tab, songLib: state.songLib, openBook: state.openBook,
    inspTab: state.inspTab, bibleId: state.bibleId, inspPos: state.inspPos || null,
  });
}

/* ───────────── Biblioteca (panel izquierdo) ───────────── */
const PLACEHOLDER = { bible: 'Buscar cita o palabra', songs: 'Buscar en todas tus canciones', media: 'Buscar presentaciones e imágenes', web: 'Canción, cantante u orquesta' };

function setTab(tab) {
  state.tab = tab;
  renderLibrary();
  saveUI();
}

function renderLibrary() {
  $$('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === state.tab)));
  const input = $('#search');
  input.placeholder = PLACEHOLDER[state.tab];
  if (input.value !== state.query[state.tab]) input.value = state.query[state.tab];
  renderLibTools();
  renderLibBody();
}

function renderLibTools() {
  const tools = $('#libTools');
  if (state.tab === 'web' || !state.bible.length) { tools.hidden = true; tools.innerHTML = ''; return; }
  tools.hidden = false;
  tools.dataset.tab = state.tab;
  if (state.tab === 'bible') {
    const installed = BIBLES.filter((b) => state.installed.has(b.id));
    tools.innerHTML = `
      <div class="select-wrap">
        <select id="bibleSelect" aria-label="Versión de la Biblia">
          ${installed.map((b) => `<option value="${b.id}"${b.id === state.bibleId ? ' selected' : ''}>${esc(b.name)}</option>`).join('')}
        </select>
        ${icon('chevronRight')}
      </div>
      <button class="btn" type="button" data-action="bibles-open" aria-pressed="${state.bibleManage}">${icon('library')}Más Biblias</button>`;
    return;
  }
  if (state.tab === 'media') {
    tools.innerHTML = `
      <button class="btn accent" type="button" data-action="new-deck">${icon('sparkles')}Presentación</button>
      <button class="btn" type="button" data-action="pick-image">${icon('image')}Imagen</button>
      <button class="btn" type="button" data-action="pick-video">${icon('play')}Video</button>
      <button class="btn" type="button" data-action="pick-audio">${icon('music')}Audio</button>
      <button class="btn" type="button" data-action="add-text">${icon('text')}Texto</button>`;
    return;
  }
  tools.innerHTML = `
    <button class="btn accent" type="button" data-action="upload-lyrics">${icon('upload')}Subir letra</button>
    <button class="btn" type="button" data-action="new-folder">${icon('folderPlus')}Nueva carpeta</button>`;
}

function renderLibBody() {
  $('#gotoForm').hidden = state.tab !== 'bible' || !state.bible.length || !!state.query.bible.trim() || state.bibleManage;
  const body = $('#libBody');
  if (state.loadError) body.innerHTML = libErrorHtml();
  else if (!state.bible.length) body.innerHTML = '<div class="loading-row"><span class="spinner"></span>Cargando la Biblia…</div>';
  else if (state.tab === 'bible') body.innerHTML = state.bibleManage ? biblesHtml() : state.query.bible.trim() ? bibleSearchHtml() : bookListHtml();
  else if (state.tab === 'songs') body.innerHTML = state.query.songs.trim() ? songSearchHtml() : state.songLib ? songListHtml() : collectionsHtml();
  else if (state.tab === 'media') { body.innerHTML = studioHtml(); hydrateDeckThumbs(); }
  else body.innerHTML = webListHtml();
}

function emptyHtml(ic, title, text, actions = '') {
  return `<div class="lib-empty">${icon(ic)}<h3>${esc(title)}</h3><p>${esc(text)}</p>${actions ? `<div class="stack">${actions}</div>` : ''}</div>`;
}

function libErrorHtml() {
  if (state.loadError === 'file') {
    return emptyHtml('book', 'Abre la app con el servidor', 'El navegador no deja leer la Biblia desde un archivo abierto con doble clic. Ejecuta ./serve.sh y entra en http://localhost:3737.');
  }
  return emptyHtml('book', 'No se pudo cargar la Biblia', `Comprueba que bible_rvr1960.json esté junto a index.html y recarga la página. Detalle: ${state.loadError}`);
}

function bookListHtml() {
  const cur = state.item?.kind === 'bible' ? state.item : null;
  const liveItem = state.onAir ? state.liveAt?.item : null;
  const live = liveItem?.kind === 'bible' ? liveItem : null;
  const row = (bk, i) => {
    const open = state.openBook === i;
    let html = `
      <button class="row${cur?.b === i ? ' is-current' : ''}" type="button" data-book="${i}" aria-expanded="${open}">
        <span class="row-title">${esc(bk.name)}</span><span class="row-meta">${bk.chapters.length}</span>${icon('chevronRight', 'chev')}
      </button>`;
    if (open) {
      html += `<div class="chapters">${bk.chapters.map((_, c) => {
        const cls = `${cur?.b === i && cur.ch === c ? ' is-current' : ''}${live?.b === i && live.ch === c ? ' is-live' : ''}`;
        return `<button class="ch${cls}" type="button" data-chapter="${c}" data-book-of="${i}" aria-label="${esc(bk.name)} ${c + 1}">${c + 1}</button>`;
      }).join('')}</div>`;
    }
    return html;
  };
  return `
    <div class="lib-group">Antiguo Testamento<span>39 libros</span></div>
    ${state.bible.slice(0, 39).map((b, i) => row(b, i)).join('')}
    <div class="lib-group">Nuevo Testamento<span>27 libros</span></div>
    ${state.bible.slice(39).map((b, i) => row(b, i + 39)).join('')}`;
}

function toggleBook(i, { forceOpen = false } = {}) {
  state.openBook = forceOpen || state.openBook !== i ? i : null;
  if (forceOpen) state.query.bible = '';
  if (state.openBook === i && !$('#gotoForm').contains(document.activeElement)) {
    goto.b = i;
    $('#gotoBook').value = state.bible[i].name;
    $('#gotoCh').value = '';
    $('#gotoV').value = '';
    updateGotoHints();
  }
  renderLibrary();
  saveUI();
  $(`#libBody [data-book="${i}"]`)?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
}

/* Búsqueda bíblica: citas («jn 3 16», «1 Co 13») y texto completo */
function matchBooks(q) {
  if (!q) return [];
  const target = ABBR[q] ?? ABBR[q.replace(' ', '')];
  const scored = [];
  state.bookIndex.forEach((bk, i) => {
    let score = -1;
    if (target && bk.n === target) score = 110;
    else if (bk.n === q) score = 100;
    else if (bk.n.startsWith(q)) score = 80;
    else if (bk.bare.startsWith(q)) score = 60;
    if (score >= 0) scored.push({ i, score });
  });
  return scored.sort((a, b) => b.score - a.score || a.i - b.i).map((x) => x.i);
}

const normBookQuery = (raw) => norm(raw).replace(/[–—]/g, '-').replace(/^([1-3])\s*(?=[a-z])/, '$1 ');

// Entiende «Juan 3:16», «jn 3 16», «1 Co 13:4-7», «Sal 23», «Mt. 5,3».
function parseRef(raw) {
  const q = normBookQuery(raw);
  const m = q.match(/^((?:[1-3] )?[a-z][a-z ]*?)\.?\s*(?:(\d+)(?:\s*[:.,\s]\s*(\d+)(?:\s*-\s*(\d+))?)?)?$/);
  if (!m) return null;
  const books = matchBooks(m[1].trim());
  if (!books.length) return null;
  return { books, ch: m[2] ? Number(m[2]) : null, v: m[3] ? Number(m[3]) : null, to: m[4] ? Number(m[4]) : null };
}

function refEntry(p) {
  const b = p.books[0];
  const bk = state.bible[b];
  if (p.ch == null) return { kind: 'book', b, books: p.books };
  if (p.ch < 1 || p.ch > bk.chapters.length) return { kind: 'error', text: `${bk.name} tiene ${plural(bk.chapters.length, 'capítulo', 'capítulos')}.` };
  const ch = p.ch - 1;
  const n = bk.chapters[ch].length;
  if (p.v == null) return { kind: 'chapter', b, ch };
  if (p.v < 1 || p.v > n) return { kind: 'error', text: `${bk.name} ${p.ch} tiene ${plural(n, 'versículo', 'versículos')}.` };
  const from = p.v - 1;
  const to = p.to != null && p.to > p.v ? Math.min(p.to, n) - 1 : null;
  return { kind: 'verse', b, ch, from, to };
}

function textSearch(q, limit = 60) {
  if (!state.verseIndex) {
    const idx = [];
    state.bible.forEach((bk, b) => bk.chapters.forEach((ch, c) => ch.forEach((t, v) => idx.push({ b, c, v, n: norm(t) }))));
    state.verseIndex = idx;
  }
  const nq = norm(q);
  const hits = [];
  let total = 0;
  for (const item of state.verseIndex) {
    if (item.n.includes(nq)) { total++; if (hits.length < limit) hits.push(item); }
  }
  return { hits, total };
}

const ACCENT_CLASS = { a: '[aáàäâ]', e: '[eéèëê]', i: '[iíìïî]', o: '[oóòöô]', u: '[uúùüû]', n: '[nñ]' };
function highlight(text, q) {
  const pattern = [...norm(q)].map((ch) => (ch === ' ' ? '\\s+' : ACCENT_CLASS[ch] || ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('');
  let out = '';
  let last = 0;
  for (const m of text.matchAll(new RegExp(pattern, 'gi'))) {
    if (!m[0]) break;
    out += `${esc(text.slice(last, m.index))}<mark>${esc(m[0])}</mark>`;
    last = m.index + m[0].length;
  }
  return out + esc(text.slice(last));
}

function bibleSearchHtml() {
  const q = state.query.bible.trim();
  const parts = q.split(';').map((x) => x.trim()).filter(Boolean);
  let html = '';
  let first = true;
  const kbd = () => { const k = first ? '<kbd>Intro</kbd>' : ''; first = false; return k; };
  const entries = parts.map(parseRef).filter(Boolean).map(refEntry);
  if (parts.length > 1 && entries.length) html += `<div class="lib-group">Citas<span>${entries.length}</span></div>`;
  for (const e of entries) {
    if (e.kind === 'error') { html += `<p class="lib-note">${esc(e.text)}</p>`; continue; }
    if (e.kind === 'book') {
      html += `<div class="chip-row">${(parts.length > 1 ? [e.b] : e.books.slice(0, 8)).map((i) => `<button class="chip" type="button" data-book-chip="${i}">${esc(state.bible[i].name)}</button>`).join('')}</div>`;
      continue;
    }
    const bk = state.bible[e.b];
    const verses = bk.chapters[e.ch];
    if (e.kind === 'chapter') {
      html += `
        <button class="jump-row" type="button" data-jump="${e.b},${e.ch},,">
          <span class="jump-main"><span class="jump-ref">${esc(bk.name)} ${e.ch + 1}</span><span class="jump-text">Capítulo completo · ${plural(verses.length, 'versículo', 'versículos')}</span></span>${kbd()}
        </button>`;
    } else {
      const range = e.to != null ? `–${e.to + 1}` : '';
      html += `
        <button class="jump-row" type="button" data-jump="${e.b},${e.ch},${e.from},${e.to ?? ''}">
          <span class="jump-main"><span class="jump-ref">${esc(bk.name)} ${e.ch + 1}:${e.from + 1}${range}</span><span class="jump-text">${esc(verses[e.from])}${e.to != null ? ' …' : ''}</span></span>${kbd()}
        </button>`;
    }
  }
  if (parts.length === 1 && q.length >= 3 && !/\d/.test(q)) {
    const { hits, total } = textSearch(q);
    if (total) {
      html += `<div class="lib-group">Versículos<span>${plural(total, 'resultado', 'resultados')}${total > hits.length ? ` · ${hits.length} primeros` : ''}</span></div>
        ${hits.map((h) => `
          <button class="result" type="button" data-jump="${h.b},${h.c},${h.v}">
            <span class="result-ref">${esc(state.bible[h.b].name)} ${h.c + 1}:${h.v + 1}</span>
            <span class="result-text">${highlight(state.bible[h.b].chapters[h.c][h.v], q)}</span>
          </button>`).join('')}`;
    }
  }
  return html || emptyHtml('search', `Sin resultados para «${q}»`, 'Prueba con una cita como Juan 3:16-18, varias separadas por «;» o una palabra de al menos tres letras.');
}

/* Ir a pasaje: libro con autocompletado, capítulo y versículo */
const goto = { b: null, active: -1, options: [] };

function bookOptions(text) {
  const q = normBookQuery(text);
  return q ? matchBooks(q).slice(0, 12) : state.bible.map((_, i) => i);
}

function openCombo() {
  goto.options = bookOptions($('#gotoBook').value);
  goto.active = goto.options.length ? 0 : -1;
  renderCombo();
}

function renderCombo() {
  const pop = $('#bookPopup');
  const input = $('#gotoBook');
  pop.innerHTML = goto.options.length
    ? goto.options.map((i, k) => `
        <button type="button" class="combo-opt" role="option" id="bookOpt${k}" data-opt="${i}" aria-selected="${k === goto.active}" tabindex="-1">
          ${esc(state.bible[i].name)}<span>${plural(state.bible[i].chapters.length, 'cap.', 'cap.')}</span>
        </button>`).join('')
    : '<div class="combo-empty">Ningún libro coincide</div>';
  pop.hidden = false;
  input.setAttribute('aria-expanded', 'true');
  input.setAttribute('aria-activedescendant', goto.active >= 0 ? `bookOpt${goto.active}` : '');
  $('[aria-selected="true"]', pop)?.scrollIntoView({ block: 'nearest' });
}

function closeCombo() {
  $('#bookPopup').hidden = true;
  $('#gotoBook').setAttribute('aria-expanded', 'false');
}

function chooseBook(i, { focusNext = true } = {}) {
  goto.b = i;
  $('#gotoBook').value = state.bible[i].name;
  closeCombo();
  updateGotoHints();
  if (focusNext) { const ch = $('#gotoCh'); ch.focus(); ch.select(); }
}

function updateGotoHints() {
  const bk = goto.b != null ? state.bible[goto.b] : null;
  const ch = Number($('#gotoCh').value);
  $('#gotoChMax').textContent = bk ? `de ${bk.chapters.length}` : '';
  $('#gotoVMax').textContent = bk && ch >= 1 && ch <= bk.chapters.length ? `de ${bk.chapters[ch - 1].length}` : '';
  $('#gotoError').hidden = true;
}

function gotoError(message, field) {
  const el = $('#gotoError');
  el.textContent = message;
  el.hidden = false;
  const input = $(field);
  input.focus();
  input.select?.();
}

function submitGoto(live) {
  const typed = $('#gotoBook').value.trim();
  let b = goto.b;
  if (b == null || state.bible[b].name !== typed) b = typed ? bookOptions(typed)[0] ?? null : null;
  if (b == null) return gotoError(typed ? `No hay ningún libro llamado «${typed}».` : 'Escribe el nombre de un libro.', '#gotoBook');
  chooseBook(b, { focusNext: false });
  const bk = state.bible[b];
  const ch = Number($('#gotoCh').value || 1);
  if (!Number.isInteger(ch) || ch < 1 || ch > bk.chapters.length) {
    return gotoError(`${bk.name} tiene ${plural(bk.chapters.length, 'capítulo', 'capítulos')}.`, '#gotoCh');
  }
  const n = bk.chapters[ch - 1].length;
  const v = Number($('#gotoV').value || 1);
  if (!Number.isInteger(v) || v < 1 || v > n) return gotoError(`${bk.name} ${ch} tiene ${plural(n, 'versículo', 'versículos')}.`, '#gotoV');
  $('#gotoCh').value = ch;
  $('#gotoV').value = v;
  updateGotoHints();
  state.openBook = b;
  loadItem(makeBibleItem(b, ch - 1), v - 1);
  if (live) setOnAir(true);
}

function syncGotoFromItem() {
  const it = state.item;
  if (!it || it.kind !== 'bible' || $('#gotoForm').contains(document.activeElement)) return;
  goto.b = it.b;
  $('#gotoBook').value = state.bible[it.b].name;
  $('#gotoCh').value = it.ch + 1;
  $('#gotoV').value = it.slides[state.previewIndex].v + 1;
  updateGotoHints();
}

function bindGoto() {
  const form = $('#gotoForm');
  const book = $('#gotoBook');
  book.addEventListener('focus', () => { book.select(); openCombo(); });
  book.addEventListener('input', () => { goto.b = null; openCombo(); updateGotoHints(); });
  book.addEventListener('blur', () => setTimeout(closeCombo, 120));
  book.addEventListener('keydown', (e) => {
    const open = !$('#bookPopup').hidden;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) openCombo();
      else { goto.active = Math.min(goto.active + 1, goto.options.length - 1); renderCombo(); }
    } else if (e.key === 'ArrowUp' && open) {
      e.preventDefault();
      goto.active = Math.max(goto.active - 1, 0);
      renderCombo();
    } else if (e.key === 'Enter' && open && goto.active >= 0 && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      chooseBook(goto.options[goto.active]);
    } else if (e.key === 'Tab' && open && goto.active >= 0 && book.value.trim()) {
      chooseBook(goto.options[goto.active], { focusNext: false });
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation();
      closeCombo();
    }
  });
  // pointerdown evita que el campo pierda el foco antes de elegir.
  $('#bookPopup').addEventListener('pointerdown', (e) => {
    const opt = e.target.closest('[data-opt]');
    if (!opt) return;
    e.preventDefault();
    chooseBook(Number(opt.dataset.opt));
  });
  $('#gotoCh').addEventListener('input', updateGotoHints);
  $('#gotoV').addEventListener('input', () => { $('#gotoError').hidden = true; });
  form.addEventListener('submit', (e) => { e.preventDefault(); submitGoto(false); });
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submitGoto(true); }
  });
}

/* Más Biblias: descarga, uso y borrado de versiones */
function biblesHtml() {
  const rows = BIBLES.map((b) => {
    const installed = state.installed.has(b.id);
    const progress = state.downloads[b.id];
    let action;
    if (b.id === state.bibleId) action = '<span class="pill">En uso</span>';
    else if (installed) action = `<button class="btn" type="button" data-bible-use="${b.id}">Usar</button>`;
    else if (progress != null) action = `<span class="dl" role="progressbar" aria-valuenow="${Math.round(progress * 100)}" aria-label="Descargando ${esc(b.name)}"><span class="bar"><i style="width:${progress * 100}%"></i></span><span class="pct">${Math.round(progress * 100)} %</span></span>`;
    else action = `<button class="btn accent" type="button" data-bible-get="${b.id}">${icon('save')}Descargar</button>`;
    const remove = installed && !b.bundled ? `<button class="icon-btn" type="button" data-bible-del="${b.id}" aria-label="Eliminar ${esc(b.name)}" title="Eliminar">${icon('trash')}</button>` : '';
    return `
      <div class="bible-row${b.id === state.bibleId ? ' is-current' : ''}" data-bible-row="${b.id}">
        <span class="bible-badge">${esc(b.abbr)}</span>
        <span class="row-main"><span class="row-title">${esc(b.name)}</span><span class="row-sub">${esc(b.lang)} · ${fmtBytes(b.bytes)} · ${esc(b.note)}</span></span>
        <span class="bible-actions">${action}${remove}</span>
      </div>`;
  }).join('');
  return `
    <button class="row back-row" type="button" data-action="bibles-back">${icon('chevronLeft')}<span class="row-title">Volver a los libros</span></button>
    <div class="lib-group">Biblias<span>${state.installed.size} de ${BIBLES.length} instaladas</span></div>
    ${rows}
    <p class="lib-hint">Las Biblias descargadas se guardan en este navegador y funcionan sin internet.</p>`;
}

function convertBible(meta, raw) {
  const books = meta.format === 'books'
    ? raw.books.slice(0, 66).map((b) => ({ name: b.name, chapters: b.chapters.map((c) => c.verses.map((v) => String(v.text || '').trim())) }))
    : raw.slice(0, 66).map((b) => ({ name: b.name, chapters: b.chapters.map((c) => c.map((t) => String(t).trim())) }));
  if (books.length !== 66) throw new Error('formato inesperado');
  return books.map((b, i) => ({ name: meta.keepNames ? b.name : SPANISH_BOOKS[i], chapters: b.chapters }));
}

function paintDownload(id) {
  const row = $(`[data-bible-row="${id}"]`);
  const p = state.downloads[id];
  if (!row || p == null) return;
  const bar = $('.bar i', row);
  if (bar) { bar.style.width = `${p * 100}%`; $('.pct', row).textContent = `${Math.round(p * 100)} %`; }
  else renderLibBody();
}

async function downloadBible(id) {
  const meta = bibleMeta(id);
  if (!meta || state.downloads[id] != null) return;
  state.downloads[id] = 0;
  renderLibBody();
  try {
    const res = await fetch(meta.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const reader = res.body.getReader();
    const chunks = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      const p = Math.min(received / meta.bytes, 0.99);
      if (p - state.downloads[id] >= 0.01) { state.downloads[id] = p; paintDownload(id); }
    }
    const text = new TextDecoder().decode(await new Blob(chunks).arrayBuffer()).replace(/^﻿/, '');
    await idb.put(id, convertBible(meta, JSON.parse(text)));
    state.installed.add(id);
    toast(`${meta.name} descargada`, { label: 'Usar', fn: () => switchBible(id) });
  } catch {
    toast(`No se pudo descargar ${meta.name}. Revisa la conexión e inténtalo de nuevo.`);
  }
  delete state.downloads[id];
  renderLibrary();
}

async function switchBible(id) {
  if (id === state.bibleId) return;
  const data = id === 'rvr1960' ? state.bundledBible : await idb.get(id).catch(() => null);
  if (!data) { toast('No se encontró esa Biblia en este navegador. Descárgala de nuevo.'); return; }
  setBible(data, id);
  if (state.item?.kind === 'bible') {
    const it = state.item;
    state.item = makeBibleItem(it.b, it.ch, it.from, it.full ? null : it.to);
    state.previewIndex = clamp(state.previewIndex, 0, state.item.slides.length - 1);
    renderStrip();
    update(false);
  }
  syncGotoFromItem();
  renderLibrary();
  saveUI();
  toast(`Usando ${bibleMeta(id).name}`);
}

async function deleteBible(id) {
  const meta = bibleMeta(id);
  if (!meta || meta.bundled) return;
  if (state.bibleId === id) await switchBible('rvr1960');
  try { await idb.del(id); } catch { /* ya no estaba */ }
  state.installed.delete(id);
  renderLibrary();
  toast(`${meta.name} eliminada de este navegador`);
}

/* Carpetas para Mis canciones */
function persistFolders() {
  store.set(KEY.folders, state.folders);
}

function askText({ title, label, value = '', confirm = 'Crear', placeholder = '' }) {
  return new Promise((resolve) => {
    const dlg = $('#askDialog');
    const input = $('#askInput');
    $('#askTitle').textContent = title;
    $('#askLabel').textContent = label;
    $('#askOk').textContent = confirm;
    input.value = value;
    input.placeholder = placeholder;
    dlg.returnValue = '';
    dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok' ? input.value.trim() || null : null), { once: true });
    dlg.showModal();
    input.select();
  });
}

async function createFolder() {
  const name = await askText({ title: 'Nueva carpeta', label: 'Nombre', placeholder: 'Adoración, Júbilo, Navidad…' });
  if (!name) return null;
  const existing = state.folders.find((f) => norm(f.name) === norm(name));
  if (existing) return existing;
  const folder = { id: uid(), name };
  state.folders.push(folder);
  state.folders.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  persistFolders();
  if (state.item?.kind === 'song') renderStrip();
  if (state.tab === 'songs') renderLibBody();
  return folder;
}

async function renameFolder(folder) {
  const name = await askText({ title: 'Renombrar carpeta', label: 'Nombre', value: folder.name, confirm: 'Guardar' });
  if (!name) return;
  folder.name = name;
  state.folders.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  persistFolders();
  renderLibrary();
  if (state.item?.kind === 'song') renderStrip();
}

function deleteFolder(folder) {
  const idx = state.folders.indexOf(folder);
  if (idx < 0) return;
  const moved = state.mine.filter((s) => s.folderId === folder.id);
  moved.forEach((s) => { s.folderId = null; });
  state.folders.splice(idx, 1);
  persistFolders();
  persistMine();
  state.songLib = null;
  renderLibrary();
  if (state.item?.kind === 'song') renderStrip();
  saveUI();
  toast(`Carpeta «${folder.name}» eliminada${moved.length ? `; sus ${plural(moved.length, 'canción', 'canciones')} siguen en Mis canciones` : ''}`, {
    label: 'Deshacer',
    fn: () => {
      state.folders.splice(idx, 0, folder);
      moved.forEach((s) => { s.folderId = folder.id; });
      persistFolders();
      persistMine();
      state.songLib = `folder:${folder.id}`;
      renderLibrary();
    },
  });
}

function folderOptionsHtml(selectedId) {
  return `<option value="">Sin carpeta</option>
    ${state.folders.map((f) => `<option value="${esc(f.id)}"${f.id === selectedId ? ' selected' : ''}>${esc(f.name)}</option>`).join('')}
    <option value="__new">Nueva carpeta…</option>`;
}

/* Canciones: himnarios, mis canciones y carpetas */
const firstLine = (song) => song.slides[0]?.text.split('\n')[0] ?? '';

function collectionsHtml() {
  const row = (id, ic, name, count, cls = '') => `
    <button class="row coll-row ${cls}" type="button" data-lib="${esc(id)}">
      <span class="coll-icon">${icon(ic)}</span><span class="row-title">${esc(name)}</span><span class="row-meta">${count}</span>${icon('chevronRight', 'chev')}
    </button>`;
  const loose = state.mine.filter((s) => !folderOf(s)).length;
  return `
    ${state.hymnals.length ? `<div class="lib-group">Himnarios</div>${state.hymnals.map((h) => row(h.id, 'book', h.name, h.songs.filter((x) => !isHidden(x)).length, 'hymnal')).join('')}` : ''}
    <div class="lib-group">Mis canciones<span>${plural(state.mine.length, 'canción', 'canciones')}</span></div>
    ${row('mine', 'heart', 'Todas mis canciones', state.mine.length, 'all')}
    ${state.folders.map((f) => row(`folder:${f.id}`, 'folder', f.name, state.mine.filter((s) => s.folderId === f.id).length, 'folder')).join('')}
    ${loose && state.folders.length ? row('folder:none', 'folder', 'Sin carpeta', loose, 'loose') : ''}
    <button class="row add-row" type="button" data-action="new-folder"><span class="coll-icon">${icon('folderPlus')}</span><span class="row-title">Nueva carpeta</span></button>`;
}

function songSearchHtml() {
  const raw = state.query.songs.trim();
  const q = norm(raw);
  const all = [
    ...state.hymnals.flatMap((h) => h.songs.filter((s) => !isHidden(s)).map((s) => ({ s, where: h.name }))),
    ...state.mine.map((s) => ({ s, where: folderOf(s)?.name || 'Mis canciones' })),
  ];
  const hits = all.filter(({ s }) => norm(`${s.number ?? ''} ${s.title} ${s.author} ${s.slides.map((x) => x.text).join(' ')}`).includes(q)).slice(0, 80);
  if (!hits.length) {
    return emptyHtml('search', `Nada coincide con «${raw}»`, '¿No la tienes? Búscala en internet.',
      `<button class="btn accent block" type="button" data-action="web-from-query">${icon('globe')}Buscar «${esc(raw)}» en internet</button>`);
  }
  const current = state.item?.kind === 'song' ? state.item.song : null;
  return `<div class="lib-group">Resultados<span>${hits.length}</span></div>
    ${hits.map(({ s, where }) => songRowHtml(s, `${where} · ${firstLine(s)}`, current === s)).join('')}`;
}

function songRowHtml(s, sub, isCurrent) {
  return `
    <div class="song-item">
      <button class="row song-row${isCurrent ? ' is-current' : ''}" type="button" data-song="${esc(s.id)}" data-src="${esc(s.source)}">
        <span class="row-num">${s.number ?? icon('music')}</span>
        <span class="row-main"><span class="row-title">${esc(s.title)}${s.edited ? '<span class="edited-tag">Editado</span>' : ''}</span><span class="row-sub">${esc(sub)}</span></span>
      </button>
      <span class="row-tools">
        <button class="icon-btn" type="button" data-edit-song="${esc(s.id)}" data-src="${esc(s.source)}" title="Editar la letra" aria-label="Editar la letra de ${esc(s.title)}">${icon('pencil')}</button>
        <button class="icon-btn danger" type="button" data-del-song="${esc(s.id)}" data-src="${esc(s.source)}" title="Eliminar" aria-label="Eliminar ${esc(s.title)}">${icon('trash')}</button>
      </span>
    </div>`;
}

function songListHtml() {
  const lib = library(state.songLib);
  if (!lib) return collectionsHtml();
  return `<button class="row back-row" type="button" data-action="songs-home">${icon('chevronLeft')}<span class="row-title">Canciones</span></button>${songListBody(lib)}`;
}

function songListBody(lib) {
  const q = norm(state.query.songs);
  const songs = lib.songs.filter((s) => !q || norm(`${s.number ?? ''} ${s.title} ${s.author} ${s.slides.map((x) => x.text).join(' ')}`).includes(q));
  if (!lib.songs.length) {
    const folderActions = lib.folder
      ? `<button class="btn block" type="button" data-action="rename-folder">Renombrar carpeta</button>
         <button class="btn block danger" type="button" data-action="delete-folder">Eliminar carpeta</button>` : '';
    return emptyHtml(lib.folder ? 'folder' : 'heart', lib.folder ? `«${lib.name}» está vacía` : 'Aún no tienes canciones',
      'Sube la letra de una canción o búscala en internet y guárdala aquí.',
      `<button class="btn accent block" type="button" data-action="upload-lyrics">${icon('upload')}Subir letra</button>
       <button class="btn block" type="button" data-tab-go="web">${icon('globe')}Buscar en internet</button>${folderActions}`);
  }
  if (!songs.length) {
    return emptyHtml('search', `Nada coincide con «${state.query.songs.trim()}»`, '¿No está en este himnario? Búscala en internet.',
      `<button class="btn accent block" type="button" data-action="web-from-query">${icon('globe')}Buscar en internet</button>`);
  }
  const current = state.item?.kind === 'song' ? state.item.song : null;
  const folderActions = lib.folder ? `
    <div class="folder-actions">
      <button class="link-inline" type="button" data-action="rename-folder">Renombrar</button>
      <button class="link-inline danger" type="button" data-action="delete-folder">Eliminar carpeta</button>
    </div>` : '';
  return `<div class="lib-group">${esc(lib.name)}<span>${plural(lib.songs.length, 'canción', 'canciones')}</span></div>${folderActions}
    ${songs.map((s) => {
      const sub = lib.id === 'mine' && folderOf(s) ? `${folderOf(s).name} · ${firstLine(s)}` : firstLine(s);
      return songRowHtml(s, sub, current === s);
    }).join('')}${lib.hiddenCount ? `
    <button class="restore-hidden" type="button" data-action="restore-hymns">${icon('restart')}Recuperar ${plural(lib.hiddenCount, 'himno eliminado', 'himnos eliminados')}</button>` : ''}`;
}

/* Internet (LRCLIB, base de datos abierta de letras) */
/* Internet: artistas y catálogos (API de búsqueda de Apple) y letras (LRCLIB) */
const STORE_COUNTRY = 'MX';
const WEB_TRIES = 6;
const MONO_COLORS = ['#ff9f0a', '#30d158', '#40c8e0', '#bf5af2', '#ff375f', '#0a84ff', '#e0a800', '#5e5ce6'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let artistToken = 0;
let lyricsToken = 0;
let pendingTrack = null;

function fmtDuration(sec) {
  if (!sec) return '';
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function monogram(name, size = '') {
  const initials = String(name).split(/\s+/).filter((w) => /^[\p{L}\d]/u.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return `<span class="mono ${size}" style="--mono:${MONO_COLORS[h % MONO_COLORS.length]}" aria-hidden="true">${esc(initials || '♪')}</span>`;
}

// LRCLIB rechaza muchas peticiones con 503 «server is busy» cuando está saturado y pide reintentar
// en un segundo; se reintenta solo, con esperas crecientes. Un 404 significa «no existe» y devuelve null.
async function fetchRetry(url, { isStale = () => false, onRetry = () => {} } = {}) {
  let wait = 0;
  let lastError = null;
  for (let attempt = 1; attempt <= WEB_TRIES; attempt++) {
    if (wait) { onRetry(attempt); await sleep(wait); }
    if (isStale()) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (res.ok) return await res.json();
      if (res.status === 404) return null;
      lastError = new Error(`HTTP ${res.status}`);
      if (res.status < 500 && res.status !== 429) throw lastError;
      wait = Math.max(Number(res.headers.get('retry-after')) * 1000 || 0, 700 * attempt);
    } catch (err) {
      if (err === lastError && !/HTTP (5|429)/.test(err.message)) throw err;
      lastError = err;
      wait = 700 * attempt;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error('sin respuesta');
}

function webListHtml() {
  const w = state.web;
  if (w.artist) return artistHtml(w.artist);
  const q = state.query.web.trim();
  const links = q ? `
    <div class="web-links">
      <span>¿No aparece?</span>
      <a class="btn block" href="https://www.youtube.com/results?search_query=${encodeURIComponent(q)}" target="_blank" rel="noopener">${icon('play')}Buscar en YouTube</a>
      <a class="btn block" href="https://www.google.com/search?q=${encodeURIComponent(`${q} letra`)}" target="_blank" rel="noopener">${icon('globe')}Buscar la letra en Google</a>
      <button class="btn block" type="button" data-action="new-song">${icon('pencil')}Escribirla a mano</button>
    </div>` : '';
  if (w.status === 'loading') {
    const busy = w.attempt > 1 ? `<p class="loading-sub">El servidor de letras está ocupado. Reintentando (${w.attempt} de ${WEB_TRIES})…</p>` : '';
    return `<div class="loading-row"><span class="spinner"></span><span>Buscando «${esc(w.q)}»…${busy}</span></div>`;
  }
  if (w.status === 'error') {
    const [title, text] = w.error === 'offline'
      ? ['Sin conexión a internet', 'Conéctate y vuelve a intentarlo.']
      : ['Los servidores no responden', `No hubo respuesta tras ${WEB_TRIES} intentos. Vuelve a intentarlo en un momento o busca en YouTube o Google.`];
    return emptyHtml('globe', title, text, `<button class="btn accent block" type="button" data-action="web-retry">Reintentar</button>`) + links;
  }
  if (w.status === 'done') {
    let html = '';
    if (w.artists.length) {
      html += `<div class="lib-group">Artistas<span>${w.artists.length}</span></div>
        ${w.artists.map((a, i) => `
          <button class="row artist-row" type="button" data-artist="${i}">
            ${monogram(a.name)}
            <span class="row-main"><span class="row-title">${esc(a.name)}</span><span class="row-sub">${esc(a.genre || 'Artista')} · ver canciones</span></span>
            ${icon('chevronRight', 'chev')}
          </button>`).join('')}`;
    }
    if (w.results.length) {
      const current = state.item?.kind === 'song' && state.item.song.source === 'web' ? state.item.song.id : null;
      html += `<div class="lib-group">Canciones con letra<span>${w.results.length}</span></div>
        ${w.results.map((r, i) => `
          <button class="row song-row${current === `lrclib:${r.id}` ? ' is-current' : ''}" type="button" data-web="${i}">
            <span class="row-num">${icon('music')}</span>
            <span class="row-main"><span class="row-title">${esc(r.trackName)}</span><span class="row-sub">${esc([r.artistName, r.albumName].filter(Boolean).join(' · '))}</span></span>
          </button>`).join('')}`;
    } else if (w.lyricsFailed) {
      html += `<p class="lib-hint">El servidor de letras está saturado. Abre un artista para ver sus canciones o <button class="link-inline" type="button" data-action="web-retry">vuelve a buscar</button>.</p>`;
    }
    return (html || emptyHtml('search', `Sin resultados para «${w.q}»`, 'Prueba con otro título, cantante u orquesta.')) + links;
  }
  const ideas = ['Marcos Witt', 'Hillsong en Español', 'Way Maker'];
  return emptyHtml('globe', 'Busca canciones o artistas',
    'Escribe una canción, un cantante o una orquesta y pulsa Intro. Abre un artista para ver todas sus canciones.',
    ideas.map((x) => `<button class="btn block" type="button" data-web-idea="${esc(x)}">${esc(x)}</button>`).join(''));
}

function cleanLyricResults(list) {
  const seen = new Set();
  return list.filter((r) => {
    if (!r.plainLyrics || r.instrumental) return false;
    const k = norm(`${r.trackName}|${r.artistName}`);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 30);
}

function cleanArtists(list) {
  const seen = new Set();
  return list.filter((a) => {
    const k = norm(a.artistName);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).map((a) => ({ id: a.artistId, name: a.artistName, genre: a.primaryGenreName || '' })).slice(0, 6);
}

async function searchWeb(raw) {
  const q = String(raw).trim();
  if (!q) return;
  const token = ++state.web.token;
  const key = norm(q);
  state.query.web = q;
  const cached = webCache.get(key);
  Object.assign(state.web, {
    q, status: cached ? 'done' : 'loading', results: cached?.songs || [], artists: cached?.artists || [],
    attempt: 1, error: null, lyricsFailed: false, artist: null,
  });
  if (state.tab !== 'web') setTab('web'); else renderLibrary();
  if (cached) return;
  const stale = () => token !== state.web.token;
  const [songs, artists] = await Promise.allSettled([
    fetchRetry(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`, {
      isStale: stale,
      onRetry: (n) => { state.web.attempt = n; if (state.tab === 'web' && !stale()) renderLibBody(); },
    }),
    fetchRetry(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=musicArtist&limit=10&country=${STORE_COUNTRY}`, { isStale: stale }),
  ]);
  if (stale()) return;
  state.web.results = songs.status === 'fulfilled' ? cleanLyricResults(songs.value || []) : [];
  state.web.artists = artists.status === 'fulfilled' ? cleanArtists(artists.value?.results || []) : [];
  if (songs.status === 'rejected' && !state.web.artists.length) {
    state.web.status = 'error';
    state.web.error = navigator.onLine === false ? 'offline' : 'busy';
  } else {
    state.web.status = 'done';
    state.web.lyricsFailed = songs.status === 'rejected';
    if (!state.web.lyricsFailed) webCache.set(key, { songs: state.web.results, artists: state.web.artists });
  }
  if (state.tab === 'web') renderLibBody();
}

function openWebResult(i) {
  const r = state.web.results[i];
  if (!r) return;
  state.webSong = { id: `lrclib:${r.id}`, title: r.trackName, author: r.artistName || '', source: 'web', slides: splitLyrics(r.plainLyrics, true) };
  loadItem(makeSongItem(state.webSong));
}

/* Catálogo de un artista u orquesta */
async function openArtist(a) {
  const token = ++artistToken;
  state.web.artist = { ...a, status: 'loading', songs: [], filter: '' };
  renderLibBody();
  $('#libBody').scrollTop = 0;
  try {
    const data = await fetchRetry(`https://itunes.apple.com/lookup?id=${a.id}&entity=song&limit=200&country=${STORE_COUNTRY}`, { isStale: () => token !== artistToken });
    if (token !== artistToken) return;
    const seen = new Set();
    state.web.artist.songs = (data?.results || [])
      .filter((t) => t.wrapperType === 'track' && t.kind === 'song')
      .filter((t) => { const k = norm(t.trackName); if (seen.has(k)) return false; seen.add(k); return true; })
      .map((t) => ({
        id: t.trackId,
        title: t.trackName,
        artist: t.artistName,
        album: t.collectionName || '',
        year: t.releaseDate ? t.releaseDate.slice(0, 4) : '',
        duration: Math.round((t.trackTimeMillis || 0) / 1000),
        art: t.artworkUrl100 ? t.artworkUrl100.replace('100x100bb', '80x80bb') : '',
      }));
    state.web.artist.status = 'done';
  } catch {
    if (token !== artistToken) return;
    state.web.artist.status = 'error';
  }
  if (state.tab === 'web' && state.web.artist) renderLibBody();
}

function artistHtml(a) {
  const back = `<button class="row back-row" type="button" data-action="web-back">${icon('chevronLeft')}<span class="row-title">Resultados de «${esc(state.web.q)}»</span></button>`;
  const count = a.status === 'done' ? plural(a.songs.length, 'canción', 'canciones') : '';
  const head = `
    <div class="artist-head">
      ${monogram(a.name, 'lg')}
      <div class="artist-meta"><div class="artist-name">${esc(a.name)}</div><div class="row-sub">${esc([a.genre, count].filter(Boolean).join(' · '))}</div></div>
    </div>`;
  if (a.status === 'loading') return `${back}${head}<div class="loading-row"><span class="spinner"></span>Cargando sus canciones…</div>`;
  if (a.status === 'error') {
    return back + head + emptyHtml('globe', 'No se pudieron cargar las canciones', 'Revisa la conexión e inténtalo de nuevo.',
      `<button class="btn accent block" type="button" data-action="artist-retry">Reintentar</button>`);
  }
  if (!a.songs.length) return back + head + emptyHtml('music', 'Sin canciones en el catálogo', 'Prueba con otro resultado o busca por el nombre de la canción.');
  return `${back}${head}
    <label class="searchfield artist-filter">
      ${icon('search')}
      <input id="artistFilter" type="search" autocomplete="off" spellcheck="false" placeholder="Filtrar canciones" value="${esc(a.filter)}" aria-label="Filtrar las canciones de ${esc(a.name)}">
    </label>
    <div id="artistSongs">${artistSongsHtml(a)}</div>`;
}

function artistSongsHtml(a) {
  const q = norm(a.filter || '');
  const list = q ? a.songs.filter((s) => norm(`${s.title} ${s.album}`).includes(q)) : a.songs;
  if (!list.length) return `<p class="lib-hint">Nada coincide con «${esc(a.filter)}».</p>`;
  const current = state.item?.kind === 'song' ? state.item.song.id : null;
  return list.map((s) => {
    const loading = state.web.loadingTrack === s.id;
    return `
      <button class="row song-row track-row${current === `itunes:${s.id}` ? ' is-current' : ''}${loading ? ' is-loading' : ''}" type="button" data-track="${s.id}">
        ${s.art ? `<img class="track-art" src="${esc(s.art)}" alt="" loading="lazy" width="36" height="36">` : `<span class="track-art">${icon('music')}</span>`}
        <span class="row-main"><span class="row-title">${esc(s.title)}</span><span class="row-sub">${esc([s.album, s.year].filter(Boolean).join(' · '))}</span></span>
        ${loading ? '<span class="spinner"></span>' : `<span class="row-meta">${fmtDuration(s.duration)}</span>`}
      </button>`;
  }).join('');
}

function refreshArtistSongs() {
  const el = $('#artistSongs');
  if (el && state.web.artist) el.innerHTML = artistSongsHtml(state.web.artist);
}

// Busca la letra de una canción del catálogo: primero coincidencia exacta y luego por título y artista.
async function findLyrics(t, isStale, onRetry) {
  const opts = { isStale, onRetry };
  const api = 'https://lrclib.net/api';
  if (t.album && t.duration) {
    const params = new URLSearchParams({ artist_name: t.artist, track_name: t.title, album_name: t.album, duration: String(t.duration) });
    try {
      const exact = await fetchRetry(`${api}/get?${params}`, opts);
      if (exact?.plainLyrics) return exact.plainLyrics;
    } catch (err) {
      if (!/HTTP 4/.test(err.message)) throw err;
    }
  }
  const title = t.title.replace(/\s*[([][^)\]]*[)\]]/g, '').trim() || t.title;
  const searches = [new URLSearchParams({ track_name: title, artist_name: t.artist }), new URLSearchParams({ q: `${title} ${t.artist}` })];
  for (const params of searches) {
    if (isStale()) return null;
    const list = await fetchRetry(`${api}/search?${params}`, opts);
    const hit = (list || []).find((r) => r.plainLyrics && !r.instrumental);
    if (hit) return hit.plainLyrics;
  }
  return null;
}

function showStripMessage(title, sub, html) {
  $('#stripTitle').textContent = title;
  $('#stripSub').textContent = sub;
  $('#stripActions').innerHTML = '';
  $('#slides').classList.remove('on-air');
  $('#slides').innerHTML = html;
}

async function openTrack(id) {
  const t = state.web.artist?.songs.find((s) => s.id === id);
  if (!t) return;
  const token = ++lyricsToken;
  state.web.loadingTrack = id;
  refreshArtistSongs();
  showStripMessage(t.title, `${t.artist} · buscando la letra…`, '<div class="strip-empty"><span class="spinner"></span>Buscando la letra…</div>');
  if (isCompact()) setPane('live');
  let lyrics = null;
  let failed = false;
  try {
    lyrics = await findLyrics(t, () => token !== lyricsToken, (n) => {
      if (token === lyricsToken) $('#stripSub').textContent = `${t.artist} · el servidor de letras está ocupado, reintentando (${n} de ${WEB_TRIES})…`;
    });
  } catch {
    failed = true;
  }
  if (token !== lyricsToken) return;
  state.web.loadingTrack = null;
  refreshArtistSongs();
  if (lyrics) {
    state.webSong = { id: `itunes:${t.id}`, title: t.title, author: t.artist, source: 'web', slides: splitLyrics(lyrics, true) };
    loadItem(makeSongItem(state.webSong));
    return;
  }
  pendingTrack = t;
  const google = `https://www.google.com/search?q=${encodeURIComponent(`${t.title} ${t.artist} letra`)}`;
  showStripMessage(t.title, t.artist, `
    <div class="strip-empty">
      <p>${failed ? 'El servidor de letras no respondió.' : `No encontramos la letra de «${esc(t.title)}».`}</p>
      <div class="strip-empty-actions">
        ${failed ? `<button class="btn accent" type="button" data-strip="track-retry">Reintentar</button>` : ''}
        <a class="btn" href="${google}" target="_blank" rel="noopener">${icon('globe')}Buscar la letra en Google</a>
        <button class="btn" type="button" data-strip="track-manual">${icon('pencil')}Escribirla a mano</button>
        <button class="btn" type="button" data-strip="restore">Volver</button>
      </div>
    </div>`);
}

function splitLyrics(text, splitLong) {
  const slides = [];
  let n = 0;
  for (const block of String(text).replace(/\r\n?/g, '\n').split(/\n[ \t]*\n+/)) {
    let lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    let coro = false;
    if (/^(coro|estribillo|chorus)\s*:?$/i.test(lines[0])) {
      coro = true;
      lines = lines.slice(1);
      if (!lines.length) continue;
    }
    const label = coro ? 'Coro' : `Estrofa ${++n}`;
    const parts = [];
    if (splitLong && lines.length > 6) {
      const size = Math.ceil(lines.length / Math.ceil(lines.length / 5));
      for (let i = 0; i < lines.length; i += size) parts.push(lines.slice(i, i + size));
    } else parts.push(lines);
    parts.forEach((p, j) => slides.push({ label: parts.length > 1 ? `${label} · ${j + 1}/${parts.length}` : label, text: p.join('\n'), coro }));
  }
  return slides;
}

/* ───────────── Pantalla (vista previa / en vivo) y diapositivas ───────────── */
// Una sola pantalla: muestra la diapositiva elegida. Con «En vivo» encendido, el proyector la muestra
// también y cada cambio se proyecta al momento; apagado, el proyector queda solo con el fondo.
function loadItem(item, index = 0) {
  if (!item || !item.slides.length) return;
  if (item.kind === 'media') {
    if (state.playback.id !== item.media.id) state.playback = { id: item.media.id, playing: false, position: 0, at: Date.now() };
    uploadMedia(item.media.id);
  }
  if (item.kind === 'deck') deckMediaIds(item.deck).forEach(uploadMedia);
  state.item = item;
  state.previewIndex = clamp(index, 0, item.slides.length - 1);
  renderStrip();
  renderLibBody();
  syncGotoFromItem();
  update(true);
  if (isCompact()) setPane('live');
  $('#slides .is-current')?.scrollIntoView({ block: 'nearest' });
}

function select(i) {
  if (!state.item) return;
  state.previewIndex = clamp(i, 0, state.item.slides.length - 1);
  syncGotoFromItem();
  update(true);
  $('#slides .is-current')?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
}

// En un capítulo completo, al pasar del último versículo se continúa en el capítulo vecino.
function target(delta, item = state.item, index = state.previewIndex) {
  if (!item) return null;
  const i = index + delta;
  if (i >= 0 && i < item.slides.length) return { item, i };
  if (item.kind !== 'bible' || !item.full) return null;
  const ch = item.ch + Math.sign(delta);
  if (ch < 0 || ch >= state.bible[item.b].chapters.length) return null;
  item = makeBibleItem(item.b, ch);
  return { item, i: delta > 0 ? 0 : item.slides.length - 1 };
}

function step(delta) {
  const t = target(delta);
  if (!t) return;
  if (t.item === state.item) select(t.i);
  else loadItem(t.item, t.i);
}

// Modo estudio: la vista previa y lo que está en vivo van por separado (como en OBS).
// state.liveAt señala lo que se proyecta; en modo normal sigue siempre a la vista previa.
const studioOn = () => !!state.studio && !isCompact();
const slideAt = (at) => (at ? at.item.slides[at.i] : null);
let liveStage = null;

// Modo de dos pantallas: pone en vivo esa diapositiva y deja preparada la siguiente a la izquierda.
function sendToLive(item, i) {
  state.liveAt = { item, i };
  const next = target(1, item, i);
  const prevItem = state.item;
  state.item = next ? next.item : item;
  state.previewIndex = next ? next.i : i;
  if (state.item !== prevItem) { renderStrip(); renderLibBody(); }
  syncGotoFromItem();
  setOnAir(true);
  $('#slides .is-live')?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
}

// Adelante envía lo que espera a la izquierda (la siguiente, o lo que elegiste en la biblioteca).
function studioNext() {
  if (state.item) sendToLive(state.item, state.previewIndex);
}

function studioPrev() {
  if (!state.onAir || !state.liveAt) { step(-1); return; }
  const t = target(-1, state.liveAt.item, state.liveAt.i);
  if (t) sendToLive(t.item, t.i);
}

// Tras oscurecer, vuelve lo mismo que estaba en vivo.
function resumeLive() {
  if (!studioOn()) setOnAir(true);
  else if (state.liveAt) sendToLive(state.liveAt.item, state.liveAt.i);
  else studioNext();
}

function setOnAir(on) {
  if (on && !state.item && !state.liveAt) return;
  const before = slideAt(state.liveAt);
  state.onAir = on;
  // Un video empieza a reproducirse al ponerlo en vivo y se pausa al apagar.
  const media = (on ? slideAt(state.liveAt) ?? currentSlide() : before ?? currentSlide())?.media;
  if (media?.kind === 'video' && state.playback.id === media.id && state.playback.playing !== on) {
    setPlayback({ playing: on });
    return;
  }
  update(false);
}

function setPlayback(patch) {
  const pb = state.playback;
  const now = Date.now();
  state.playback = { ...pb, position: playbackPosition(pb), at: now, ...patch };
  if ('position' in patch) state.playback.position = patch.position;
  update(false);
  if (state.item?.kind === 'media') $('#stripActions').innerHTML = stripActionsHtml(state.item);
}

function currentSlide() {
  return state.item ? state.item.slides[state.previewIndex] : null;
}

function update(animate) {
  const slide = currentSlide();
  const studio = studioOn();
  if (!studio) state.liveAt = slide ? { item: state.item, i: state.previewIndex } : null;
  const live = state.onAir ? slideAt(state.liveAt) : null;
  const liveChanged = live !== state.live.slide;
  state.live.slide = live;
  state.live.playback = live?.media ? state.playback : null;
  const audible = live?.media?.kind === 'video';
  paintStage(stage, { look: state.live.look, slide, blank: false, hideText: false, playback: state.playback, silent: studio || !audible || live !== slide }, animate);
  if (studio && liveStage) paintStage(liveStage, { look: state.live.look, slide: live, blank: false, hideText: false, playback: state.playback, silent: !audible }, liveChanged);
  paintAmbient(slide);
  renderMediaBar();
  if (sessionReady) postLive();
  renderMonitorMeta();
  markStrip();
  const liveItem = state.onAir ? state.liveAt?.item : null;
  const it = liveItem?.kind === 'bible' ? liveItem : null;
  $$('#libBody .ch').forEach((el) => el.classList.toggle('is-live', !!it && Number(el.dataset.bookOf) === it.b && Number(el.dataset.chapter) === it.ch));
  saveSession();
}

function renderMonitorMeta() {
  const slide = currentSlide();
  const on = state.onAir;
  const studio = studioOn();
  const connected = state.outputConnected;
  const label = slide ? slideLabel(state.item, state.previewIndex) : '';
  const liveLabel = on && state.liveAt ? slideLabel(state.liveAt.item, state.liveAt.i) : '';
  const previewIsLive = on && !studio;
  // Al final, la «siguiente» es la misma que está en vivo: no hay nada más que pasar.
  const noNext = studio && on && state.liveAt?.item === state.item && state.liveAt.i === state.previewIndex;
  $('#monitorEmpty').hidden = !!slide;
  const tag = $('#monitorLabel');
  tag.textContent = studio ? 'Siguiente' : previewIsLive ? 'En vivo' : 'Vista previa';
  tag.classList.toggle('live', previewIsLive);
  $('#obsChip').hidden = !previewIsLive;
  $('#monitorRef').textContent = noNext ? 'No hay más diapositivas' : label;
  $('#monitor').classList.toggle('on-air', previewIsLive);
  $('#monitor').classList.toggle('is-end', noNext);
  const btn = $('#liveBtn');
  btn.disabled = !slide || noNext;
  btn.setAttribute('aria-pressed', String(previewIsLive));
  $('span', btn).textContent = studio ? (on ? 'Pasar a la siguiente' : 'Poner en vivo') : on ? 'En vivo · Apagar' : 'Poner en vivo';
  $('#prevBtn').disabled = studio && on && state.liveAt ? !target(-1, state.liveAt.item, state.liveAt.i) : !target(-1);
  $('#nextBtn').disabled = studio ? !slide || noNext : !target(1);
  if (studio) {
    $('#liveLabel').classList.toggle('live', on);
    $('#liveRef').textContent = liveLabel;
    $('#liveEmpty').hidden = !!liveLabel;
    $('#liveMonitor').classList.toggle('on-air', on);
    $('#clearLive').disabled = !on;
  }

  const pill = $('#liveStatus');
  pill.dataset.state = on ? 'live' : 'idle';
  $('span', pill).textContent = on ? 'En vivo' : connected ? 'Apagado' : 'Sin proyector';
  $('#outputNote').textContent = !connected
    ? 'Abre el proyector para mostrar En vivo en la otra pantalla'
    : on ? `Proyectando: ${liveLabel}` : 'Proyector conectado · solo muestra el fondo';
  const open = $('#openOutput');
  open.classList.toggle('accent', !connected);
  $('span', open).textContent = connected ? (DESKTOP ? 'Proyector' : 'Traer el proyector') : 'Abrir proyector';
}

function renderStrip() {
  const it = state.item;
  const actions = $('#stripActions');
  if (!it) {
    $('#stripTitle').textContent = 'Diapositivas';
    $('#stripSub').textContent = 'Lo que elijas en la biblioteca aparece aquí';
    actions.innerHTML = '';
    $('#slides').innerHTML = '<div class="strip-empty">Elige un capítulo de la Biblia, un himno o una canción de internet.</div>';
    return;
  }
  $('#stripTitle').textContent = it.title;
  $('#stripSub').textContent = it.sub;
  actions.innerHTML = stripActionsHtml(it);
  $('#slides').innerHTML = it.slides.map((s, i) => (s.design ? `
    <button class="slide design" type="button" data-slide="${i}">
      <span class="slide-num">${esc(s.label)}</span>
      <span class="slide-mini" data-mini="${i}"></span>
    </button>` : s.media ? `
    <button class="slide media" type="button" data-slide="${i}">
      <span class="slide-num">${esc(s.label)}</span>
      <span class="slide-thumb"${s.media.thumb ? ` style="background-image:url('${s.media.thumb}')"` : ''}>${s.media.thumb ? '' : icon(s.media.kind === 'video' ? 'play' : 'image')}</span>
    </button>` : `
    <button class="slide${s.coro ? ' coro' : ''}" type="button" data-slide="${i}">
      <span class="slide-num">${esc(s.label)}${s.edited ? '<span class="edited-tag">Editado</span>' : ''}</span>
      <span class="slide-text">${esc(s.text)}</span>
    </button>`)).join('');
  $$('#slides [data-mini]').forEach((el) => miniStage(el, it.slides[Number(el.dataset.mini)].design));
  markStrip();
}

function stripActionsHtml(it) {
  if (it.kind === 'bible') {
    const last = state.bible[it.b].chapters.length - 1;
    return `
      ${it.full ? '' : `<button class="btn" type="button" data-strip="chapter" data-value="0">Capítulo completo</button>`}
      <button class="btn" type="button" data-strip="chapter" data-value="-1" ${it.ch === 0 ? 'disabled' : ''}>${icon('chevronLeft')}Cap. ${it.ch}</button>
      <button class="btn" type="button" data-strip="chapter" data-value="1" ${it.ch === last ? 'disabled' : ''}>Cap. ${it.ch + 2}${icon('chevronRight')}</button>
      <button class="btn" type="button" data-strip="edit-verse" title="Editar el versículo de la vista previa">${icon('pencil')}Editar versículo</button>`;
  }
  if (it.kind === 'deck') {
    return `
      <button class="btn accent" type="button" data-strip="edit-deck">${icon('pencil')}Editar diapositivas</button>
      <button class="btn" type="button" data-strip="add-deck-slide">${icon('plus')}Diapositiva</button>
      <button class="btn danger" type="button" data-strip="delete-deck">${icon('trash')}Eliminar</button>`;
  }
  if (it.kind === 'text') {
    return `
      <button class="btn" type="button" data-strip="edit-text">${icon('pencil')}Editar</button>
      <button class="btn danger" type="button" data-strip="delete-text">${icon('trash')}Eliminar</button>`;
  }
  if (it.kind === 'media') {
    const m = it.media;
    const fit = `
      <div class="segmented strip-seg" role="group" aria-label="Ajuste">
        <button type="button" data-strip="fit" data-value="contain" aria-pressed="${m.fit !== 'cover'}">Ver completa</button>
        <button type="button" data-strip="fit" data-value="cover" aria-pressed="${m.fit === 'cover'}">Llenar</button>
      </div>`;
    const remove = `<button class="btn danger" type="button" data-strip="delete-media">${icon('trash')}Eliminar</button>`;
    if (m.kind !== 'video') return fit + remove;
    return `
      <button class="btn" type="button" data-strip="loop" aria-pressed="${!!m.loop}">${icon('repeat')}Repetir</button>
      ${fit}${remove}`;
  }
  const song = it.song;
  const q = `${song.title} ${song.author || ''}`.trim();
  const youtube = `<a class="btn" href="https://www.youtube.com/results?search_query=${encodeURIComponent(q)}" target="_blank" rel="noopener">${icon('play')}YouTube</a>`;
  if (song.source === 'web') {
    const saved = state.mine.some((m) => m.origin === song.id);
    return `
      <button class="btn accent" type="button" data-strip="save-web" ${saved ? 'disabled' : ''}>${icon(saved ? 'check' : 'save')}${saved ? 'Guardada' : 'Guardar en Mis canciones'}</button>
      <button class="btn" type="button" data-strip="edit-song">${icon('pencil')}Editar letra</button>
      ${youtube}`;
  }
  if (song.source === 'mine') {
    return `
      <label class="select-wrap compact" title="Carpeta">
        ${icon('folder', 'lead')}
        <select data-strip-folder aria-label="Carpeta de la canción">${folderOptionsHtml(song.folderId)}</select>
        ${icon('chevronRight')}
      </label>
      <button class="btn" type="button" data-strip="edit-song">${icon('pencil')}Editar</button>
      <button class="btn danger" type="button" data-strip="delete-song">${icon('trash')}Eliminar</button>
      ${youtube}`;
  }
  return `
    <button class="btn" type="button" data-strip="edit-song">${icon('pencil')}Editar letra</button>
    <button class="btn danger" type="button" data-strip="delete-song">${icon('trash')}Eliminar</button>
    ${youtube}`;
}

function markStrip() {
  const studio = studioOn();
  const liveI = studio && state.onAir && state.liveAt?.item === state.item ? state.liveAt.i : -1;
  $('#slides').classList.toggle('on-air', state.onAir && !studio);
  $$('#slides .slide').forEach((el, i) => {
    el.classList.toggle('is-current', i === state.previewIndex);
    el.classList.toggle('is-live', i === liveI);
  });
}

// En el ejecutable el proyector es una ventana de la app: se elige la pantalla (la segunda, si hay).
async function openOutputDesktop() {
  let screens = [];
  try { screens = await tauri('list_monitors'); } catch { /* sin datos: una sola pantalla */ }
  if (screens.length <= 1 && !state.outputConnected) { tauri('open_projector', { monitor: null }).catch((e) => toast(`No se pudo abrir el proyector: ${e}`)); return; }
  const list = $('#screenList');
  list.innerHTML = screens.map((m, i) => `
    <button class="screen-opt" type="button" data-screen="${i}">
      ${icon('display')}
      <span class="row-main"><span class="row-title">${esc(m.name)}${m.primary ? ' <span class="screen-tag">Principal</span>' : ''}</span>
      <span class="row-sub">${m.width} × ${m.height}${m.primary ? ' · aquí está la consola' : ''}</span></span>
    </button>`).join('');
  $('#closeProjector').hidden = !state.outputConnected;
  $('#screenDialog').showModal();
}

function openOutput() {
  if (DESKTOP) { openOutputDesktop(); return; }
  if (state.outWin && !state.outWin.closed) { state.outWin.focus(); return; }
  const win = window.open('?salida', 'easybiblia-proyector', 'popup=yes,width=1280,height=720');
  if (!win) { toast('El navegador bloqueó la ventana. Permite ventanas emergentes para localhost y vuelve a intentarlo.'); return; }
  state.outWin = win;
  moveToSecondScreen(win);
}

async function moveToSecondScreen(win) {
  if (!('getScreenDetails' in window)) return;
  try {
    const details = await window.getScreenDetails();
    const target = details.screens.find((s) => !s.isPrimary);
    if (!target) return;
    win.moveTo(target.availLeft, target.availTop);
    win.resizeTo(target.availWidth, target.availHeight);
  } catch { /* sin permiso para ver las pantallas: la ventana se queda donde se abrió */ }
}

/* ───────────── Medios: imágenes, videos y textos ───────────── */
const mediaUrls = new Map();
const uploadedMedia = new Set();

const itemMediaIds = (it) => (!it ? [] : it.kind === 'media' ? [it.media.id] : it.kind === 'deck' ? deckMediaIds(it.deck) : []);

function resyncServer() {
  uploadedMedia.clear();
  [...new Set([...itemMediaIds(state.liveAt?.item), ...itemMediaIds(state.item)])].forEach(uploadMedia);
  postLive();
}

function consoleMediaUrl(id) {
  if (mediaUrls.has(id)) return mediaUrls.get(id);
  mediaUrls.set(id, null);
  idb.get(id, 'media').then((blob) => {
    if (!blob) return;
    mediaUrls.set(id, URL.createObjectURL(blob));
    update(false);
    if (state.item?.kind === 'deck') renderStrip();
    if (state.tab === 'media') hydrateDeckThumbs();
    if (studio.deck) { paintStudioStage(); renderStudioSlides(); }
  }).catch(() => {});
  return null;
}

function persistMedia() {
  store.set(KEY.media, state.media);
}

function persistTexts() {
  store.set(KEY.texts, state.texts);
}

// Sube el archivo al servidor para que OBS lo pueda mostrar (solo con ./serve.sh).
async function uploadMedia(id) {
  if (!serverLive || auth.mode !== 'open' || uploadedMedia.has(id) || (DESKTOP && !state.obsOn)) return;
  uploadedMedia.add(id);
  try {
    const blob = await idb.get(id, 'media');
    if (!blob) return;
    const res = await apiSend(`api/media?id=${encodeURIComponent(id)}`, { body: blob, headers: { 'Content-Type': blob.type || 'application/octet-stream' } });
    if (!res.ok) throw new Error(String(res.status));
  } catch {
    uploadedMedia.delete(id);
  }
}

async function makeThumb(file, kind) {
  const url = URL.createObjectURL(file);
  try {
    let source;
    if (kind === 'image') {
      source = await new Promise((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = reject; im.src = url; });
    } else {
      source = document.createElement('video');
      source.muted = true;
      source.preload = 'auto';
      source.src = url;
      await new Promise((resolve, reject) => { source.onloadeddata = resolve; source.onerror = reject; setTimeout(reject, 6000); });
      source.currentTime = Math.min(1, (source.duration || 2) / 3);
      await new Promise((resolve) => { source.onseeked = resolve; setTimeout(resolve, 3000); });
    }
    const w = source.naturalWidth || source.videoWidth;
    const h = source.naturalHeight || source.videoHeight;
    const canvas = document.createElement('canvas');
    canvas.width = 192;
    canvas.height = 108;
    const scale = Math.max(canvas.width / w, canvas.height / h);
    canvas.getContext('2d').drawImage(source, (canvas.width - w * scale) / 2, (canvas.height - h * scale) / 2, w * scale, h * scale);
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch {
    return '';
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function storeMediaFile(file, kind) {
  const id = uid();
  try {
    await idb.put(id, file, 'media');
    const thumb = kind === 'audio' ? '' : await makeThumb(file, kind);
    const m = { id, kind, name: file.name.replace(/\.[^.]+$/, ''), mime: file.type, size: file.size, fit: 'contain', loop: kind === 'video', muted: false, volume: 1, thumb };
    state.media.unshift(m);
    return m;
  } catch {
    toast(`No se pudo guardar «${file.name}»: el navegador no tiene espacio suficiente.`);
    return null;
  }
}

async function addMediaFiles(files, kind) {
  let last = null;
  for (const file of files) {
    if (!file.type.startsWith(`${kind}/`)) { toast(`«${file.name}» no es ${{ video: 'un video', audio: 'un audio', image: 'una imagen' }[kind]}.`); continue; }
    last = (await storeMediaFile(file, kind)) || last;
  }
  persistMedia();
  renderLibBody();
  if (last?.kind === 'audio') toast('Audio agregado', { label: 'Reproducir', fn: () => playAudio(last) });
  else if (last) { loadItem(makeMediaItem(last)); toast(last.kind === 'video' ? 'Video agregado' : 'Imagen agregada'); }
}

function saveText() {
  const title = $('#songTitle').value.trim();
  const blocks = $('#songLyrics').value.replace(/\r\n?/g, '\n').split(/\n[ \t]*\n+/).map((b) => b.trim()).filter(Boolean);
  if (!title || !blocks.length) return;
  const slides = blocks.map((text, i) => ({ label: blocks.length > 1 ? `Parte ${i + 1}` : 'Texto', text }));
  if (editingText) {
    Object.assign(editingText, { title, slides });
    persistTexts();
    if (state.item?.kind === 'text' && state.item.text === editingText) {
      state.item = makeTextItem(editingText);
      state.previewIndex = clamp(state.previewIndex, 0, slides.length - 1);
      renderStrip();
      update(false);
    }
    renderLibBody();
    toast('Texto guardado');
    return;
  }
  const t = { id: uid(), title, slides };
  state.texts.unshift(t);
  persistTexts();
  state.query.media = '';
  if (state.tab !== 'media') setTab('media'); else renderLibBody();
  loadItem(makeTextItem(t));
  toast('Texto creado');
}

function clearItemIf(test) {
  if (state.liveAt && test(state.liveAt.item)) { state.liveAt = null; state.onAir = false; update(false); }
  if (state.item && test(state.item)) { state.item = null; state.onAir = false; renderStrip(); update(false); }
}

function deleteText(t) {
  const idx = state.texts.indexOf(t);
  if (idx < 0) return;
  state.texts.splice(idx, 1);
  persistTexts();
  clearItemIf((it) => it.text === t);
  renderLibBody();
  toast(`«${t.title}» eliminado`, { label: 'Deshacer', fn: () => { state.texts.splice(idx, 0, t); persistTexts(); renderLibBody(); } });
}

// El archivo se borra del navegador unos segundos después, para que «Deshacer» pueda recuperarlo.
function deleteMedia(id) {
  const idx = state.media.findIndex((m) => m.id === id);
  if (idx < 0) return;
  const [m] = state.media.splice(idx, 1);
  persistMedia();
  if (state.audio === m) stopAudio();
  clearItemIf((it) => it.media === m);
  renderLibBody();
  let undone = false;
  setTimeout(() => {
    if (undone || state.media.includes(m)) return;
    idb.del(id, 'media').catch(() => {});
    const url = mediaUrls.get(id);
    if (url) URL.revokeObjectURL(url);
    mediaUrls.delete(id);
  }, 7000);
  toast(`«${m.name}» eliminado`, { label: 'Deshacer', fn: () => { undone = true; state.media.splice(idx, 0, m); persistMedia(); renderLibBody(); } });
}

/* ───────────── Barra de reproducción del video y reproductor de audio ───────────── */
const fmtTime = (t) => (Number.isFinite(t) && t > 0 ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}` : '0:00');
const paintRangeFill = (r) => r.style.setProperty('--p', `${((r.value - r.min) / (r.max - r.min)) * 100}%`);
const consoleVideo = () => $('#monitor .stage-media video');
let mediaSeeking = false;
let mediaFrame = 0;
let seekTimer = 0;

function setVolumeUi(btn, range, volume, muted) {
  const silent = muted || volume === 0;
  btn.innerHTML = icon(silent ? 'mute' : 'sound');
  btn.setAttribute('aria-label', silent ? 'Activar sonido' : 'Silenciar');
  range.value = muted ? 0 : volume;
  paintRangeFill(range);
}

function renderMediaBar() {
  const media = currentSlide()?.media;
  const bar = $('#mediaBar');
  bar.hidden = media?.kind !== 'video';
  if (bar.hidden) return;
  const playing = state.playback.id === media.id && state.playback.playing;
  $('#mbPlay').innerHTML = icon(playing ? 'pause' : 'play');
  $('#mbPlay').setAttribute('aria-label', playing ? 'Pausar' : 'Reproducir');
  setVolumeUi($('#mbMute'), $('#mbVol'), media.volume ?? 1, !!media.muted);
  if (!mediaFrame) mediaFrame = requestAnimationFrame(tickMediaBar);
}

function tickMediaBar() {
  mediaFrame = 0;
  if ($('#mediaBar').hidden) return;
  const v = consoleVideo();
  const seek = $('#mbSeek');
  if (v) {
    const dur = v.duration || 0;
    const t = mediaSeeking ? (seek.value / 1000) * dur : v.currentTime;
    $('#mbTime').textContent = fmtTime(t);
    $('#mbDur').textContent = fmtTime(dur);
    seek.disabled = !Number.isFinite(dur) || !dur;
    if (!mediaSeeking && Number.isFinite(dur) && dur) { seek.value = Math.round((t / dur) * 1000); paintRangeFill(seek); }
  }
  mediaFrame = requestAnimationFrame(tickMediaBar);
}

function bindMediaBar() {
  const seek = $('#mbSeek');
  const media = () => currentSlide()?.media;
  $('#mbPlay').addEventListener('click', () => { const m = media(); if (m) setPlayback({ playing: !(state.playback.id === m.id && state.playback.playing) }); });
  $('#mbRestart').addEventListener('click', () => setPlayback({ position: 0, playing: true }));
  // Arrastrar la línea de tiempo mueve el video al instante; el proyector y OBS lo siguen.
  seek.addEventListener('pointerdown', () => { mediaSeeking = true; });
  seek.addEventListener('input', () => {
    mediaSeeking = true;
    paintRangeFill(seek);
    const v = consoleVideo();
    if (!Number.isFinite(v?.duration) || !v.duration) return;
    const t = (seek.value / 1000) * v.duration;
    v.currentTime = t;
    $('#mbTime').textContent = fmtTime(t);
    clearTimeout(seekTimer);
    seekTimer = setTimeout(() => setPlayback({ position: t }), 120);
  });
  seek.addEventListener('change', () => {
    const v = consoleVideo();
    if (Number.isFinite(v?.duration) && v.duration) { clearTimeout(seekTimer); setPlayback({ position: (seek.value / 1000) * v.duration }); }
    mediaSeeking = false;
  });
  $('#mbVol').addEventListener('input', (e) => {
    const m = media();
    if (!m) return;
    m.volume = Number(e.target.value);
    m.muted = m.volume === 0;
    paintRangeFill(e.target);
    const v = consoleVideo();
    if (v) { v.volume = m.volume; v.muted = m.muted || !state.onAir || studioOn(); }
    const lv = studioOn() && liveStage?.querySelector('.stage-media video');
    if (lv) { lv.volume = m.volume; lv.muted = m.muted; }
    setVolumeUi($('#mbMute'), e.target, m.volume, m.muted);
    persistMediaSoon();
    postLive();
  });
  $('#mbMute').addEventListener('click', () => {
    const m = media();
    if (!m) return;
    m.muted = !m.muted;
    if (!m.muted && !(m.volume > 0)) m.volume = 1;
    persistMediaSoon();
    update(false);
  });
}

let mediaSaveTimer = 0;
function persistMediaSoon() {
  clearTimeout(mediaSaveTimer);
  mediaSaveTimer = setTimeout(persistMedia, 300);
}

// Audio de fondo: suena desde la consola y sigue mientras cambias de diapositiva.
async function playAudio(m) {
  const a = $('#abAudio');
  let url = mediaUrls.get(m.id);
  if (!url) {
    const blob = await idb.get(m.id, 'media').catch(() => null);
    if (!blob) { toast('No se encontró ese audio en este navegador.'); return; }
    url = URL.createObjectURL(blob);
    mediaUrls.set(m.id, url);
  }
  state.audio = m;
  a.src = url;
  a.volume = clamp(m.volume ?? 1, 0, 1);
  a.muted = !!m.muted;
  a.loop = !!m.loop;
  $('#abTitle').textContent = m.name;
  $('#audioBar').hidden = false;
  $('#outputNote').hidden = true;
  setVolumeUi($('#abMute'), $('#abVol'), m.volume ?? 1, !!m.muted);
  try { await a.play(); } catch { toast('Pulsa ▶ en el reproductor para escuchar el audio.'); }
  if (state.tab === 'media') renderLibBody();
}

function stopAudio() {
  const a = $('#abAudio');
  a.pause();
  a.removeAttribute('src');
  a.load();
  state.audio = null;
  $('#audioBar').hidden = true;
  $('#outputNote').hidden = false;
  if (state.tab === 'media') renderLibBody();
}

function bindAudioBar() {
  const a = $('#abAudio');
  const seek = $('#abSeek');
  let seeking = false;
  const paintPlay = () => { $('#abPlay').innerHTML = icon(a.paused ? 'play' : 'pause'); $('#abPlay').setAttribute('aria-label', a.paused ? 'Reproducir' : 'Pausar'); };
  const tick = () => {
    if (!state.audio) return;
    const dur = a.duration || 0;
    const t = seeking ? (seek.value / 1000) * dur : a.currentTime;
    $('#abTime').textContent = fmtTime(t);
    $('#abDur').textContent = fmtTime(dur);
    if (!seeking && dur) { seek.value = Math.round((t / dur) * 1000); paintRangeFill(seek); }
  };
  a.addEventListener('play', paintPlay);
  a.addEventListener('pause', paintPlay);
  a.addEventListener('timeupdate', tick);
  a.addEventListener('loadedmetadata', tick);
  $('#abPlay').addEventListener('click', () => (a.paused ? a.play().catch(() => {}) : a.pause()));
  seek.addEventListener('pointerdown', () => { seeking = true; });
  seek.addEventListener('input', () => { seeking = true; paintRangeFill(seek); if (a.duration) { a.currentTime = (seek.value / 1000) * a.duration; tick(); } });
  seek.addEventListener('change', () => { seeking = false; });
  $('#abVol').addEventListener('input', (e) => {
    const m = state.audio;
    if (!m) return;
    m.volume = Number(e.target.value);
    m.muted = m.volume === 0;
    a.volume = m.volume;
    a.muted = m.muted;
    setVolumeUi($('#abMute'), e.target, m.volume, m.muted);
    persistMediaSoon();
  });
  $('#abMute').addEventListener('click', () => {
    const m = state.audio;
    if (!m) return;
    m.muted = !m.muted;
    if (!m.muted && !(m.volume > 0)) m.volume = 1;
    a.muted = m.muted;
    a.volume = m.volume;
    setVolumeUi($('#abMute'), $('#abVol'), m.volume, m.muted);
    persistMediaSoon();
  });
  $('#abClose').addEventListener('click', stopAudio);
}

/* Resplandor ambiental detrás de la pantalla: da color al vidrio de los controles. */
let ambientStage = null;
function paintAmbient(slide) {
  const amb = $('#ambient');
  if (!ambientStage) { ambientStage = createStage(); ambientStage.classList.add('mini'); amb.append(ambientStage); }
  const media = slide?.media;
  if (media) {
    ambientStage.hidden = true;
    amb.style.backgroundImage = media.thumb ? `url("${media.thumb}")` : '';
    return;
  }
  amb.style.backgroundImage = '';
  ambientStage.hidden = false;
  paintStage(ambientStage, { look: state.live.look, slide, silent: true }, false);
}

/* ───────────── Mis canciones ───────────── */
function persistMine() {
  if (!store.set(KEY.mine, state.mine)) toast('No se pudo guardar: el almacenamiento del navegador está lleno.');
}

const slidesToText = (slides) => slides.map((s) => (s.coro ? `Coro\n${s.text}` : s.text)).join('\n\n');
let editorOrigin = null;
let editingSong = null;
let editorLoadAfter = false;
let editorMode = 'song';
let editingText = null;

function saveWebSong() {
  const s = state.webSong;
  if (!s || state.mine.some((m) => m.origin === s.id)) return;
  openEditor(null, { heading: 'Guardar canción', title: s.title, author: s.author, lyrics: slidesToText(s.slides), origin: s.id });
}

function currentFolderId() {
  return String(state.songLib).startsWith('folder:') && state.songLib !== 'folder:none' ? state.songLib.slice(7) : '';
}

function openEditor(song, prefill = {}) {
  const dlg = $('#songEditor');
  editorMode = prefill.mode === 'text' ? 'text' : 'song';
  editingText = prefill.text || null;
  dlg.classList.toggle('text-mode', editorMode === 'text');
  $('#lyricsLabel').textContent = editorMode === 'text' ? 'Texto' : 'Letra';
  state.editingId = song ? song.id : null;
  editingSong = song || null;
  editorOrigin = prefill.origin || null;
  editorLoadAfter = !!prefill.loadAfter;
  const hymn = !!song && song.source !== 'mine';
  dlg.classList.toggle('hymn-mode', hymn);
  $('#restoreOriginal').hidden = !(hymn && song.edited);
  $('#editorTitle').textContent = editorMode === 'text'
    ? (editingText ? 'Editar texto' : 'Nuevo texto')
    : song ? (hymn ? 'Editar himno' : 'Editar canción') : prefill.heading || 'Subir letra';
  $('#songTitle').value = song?.title ?? editingText?.title ?? prefill.title ?? '';
  $('#songAuthor').value = song?.author ?? prefill.author ?? '';
  $('#songLyrics').value = song ? slidesToText(song.slides) : editingText ? editingText.slides.map((x) => x.text).join('\n\n') : prefill.lyrics ?? '';
  $('#songFolder').innerHTML = folderOptionsHtml(song ? song.folderId : prefill.folderId ?? currentFolderId());
  $('#songFolder').dataset.prev = $('#songFolder').value;
  dlg.returnValue = '';
  dlg.showModal();
  if (!$('#songTitle').value) $('#songTitle').focus();
}

async function onFolderSelect(e) {
  const sel = e.target;
  if (sel.value !== '__new') { sel.dataset.prev = sel.value; return; }
  const folder = await createFolder();
  sel.innerHTML = folderOptionsHtml(folder ? folder.id : sel.dataset.prev);
  sel.dataset.prev = sel.value;
  if (folder) renderLibTools();
}

async function readLyricsFile(file) {
  const raw = await file.text();
  // Quita marcas de tiempo de archivos .lrc ([01:23.45]) y etiquetas como [ar:...].
  const text = raw.replace(/^\uFEFF/, '').replace(/^\[[a-z]+:.*\]\s*$/gim, '').replace(/\[\d+:\d+(?:[.:]\d+)?\]\s*/g, '').trim();
  $('#songLyrics').value = text;
  if (!$('#songTitle').value.trim()) $('#songTitle').value = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  toast(`Letra cargada de «${file.name}»`);
}

function onEditorClose() {
  if ($('#songEditor').returnValue !== 'save') return;
  if (editorMode === 'text') { saveText(); return; }
  const title = $('#songTitle').value.trim();
  const author = $('#songAuthor').value.trim();
  const slides = splitLyrics($('#songLyrics').value, false);
  const folderId = $('#songFolder').value && $('#songFolder').value !== '__new' ? $('#songFolder').value : null;
  if (!title || !slides.length) return;
  const folderName = folderId ? state.folders.find((f) => f.id === folderId)?.name : null;
  if (editingSong) {
    const song = editingSong;
    if (song.source === 'mine') { Object.assign(song, { title, author, slides, folderId }); persistMine(); }
    else saveHymnEdit(song, { title, author, slides });
    refreshSong(song);
    toast(song.edited === false ? 'Se dejó la letra original' : 'Cambios guardados');
    return;
  }
  const song = { id: uid(), title, author, source: 'mine', slides, folderId };
  if (editorOrigin) song.origin = editorOrigin;
  state.mine.unshift(song);
  persistMine();
  state.songLib = folderId ? `folder:${folderId}` : 'mine';
  state.query.songs = '';
  if (editorOrigin) {
    if (editorLoadAfter) loadItem(makeSongItem(song));
    renderStrip();
    renderLibTools();
    toast(`Guardada en ${folderName ? `«${folderName}»` : 'Mis canciones'}`, { label: 'Ver', fn: () => setTab('songs') });
  } else {
    setTab('songs');
    loadItem(makeSongItem(song));
    toast(folderName ? `Canción guardada en «${folderName}»` : 'Canción guardada');
  }
}

function moveSong(song, folderId) {
  song.folderId = folderId || null;
  persistMine();
  renderLibrary();
  renderStrip();
  const name = folderOf(song)?.name;
  toast(name ? `Movida a «${name}»` : 'Quitada de la carpeta');
}

function refreshSong(song) {
  const isThis = (it) => it?.kind === 'song' && it.song === song;
  if (isThis(state.item)) {
    state.item = makeSongItem(song);
    state.previewIndex = clamp(state.previewIndex, 0, state.item.slides.length - 1);
  }
  // Si está en vivo, el proyector muestra la letra nueva al momento.
  if (isThis(state.liveAt?.item)) {
    const item = isThis(state.item) ? state.item : makeSongItem(song);
    state.liveAt = { item, i: clamp(state.liveAt.i, 0, item.slides.length - 1) };
  }
  if (isThis(state.item) || isThis(state.liveAt?.item)) { renderStrip(); update(false); }
  renderLibrary();
}

// Las canciones de internet no se pueden cambiar: al editarlas se guarda una copia en Mis canciones.
function editSong(song) {
  if (song.source === 'web') {
    openEditor(null, { heading: 'Editar y guardar', title: song.title, author: song.author, lyrics: slidesToText(song.slides), origin: song.id, loadAfter: true });
  } else {
    openEditor(song);
  }
}

function hideHymn(song) {
  if (!String(song.source).startsWith('hymnal:')) return;
  state.hymnHidden.add(songKey(song));
  store.set(KEY.hymnHidden, [...state.hymnHidden]);
  clearSongFromScreen(song);
  renderLibrary();
  toast(`«${song.title}» eliminado del himnario`, {
    label: 'Deshacer',
    fn: () => { state.hymnHidden.delete(songKey(song)); store.set(KEY.hymnHidden, [...state.hymnHidden]); renderLibrary(); },
  });
}

function clearSongFromScreen(song) {
  if (state.liveAt?.item.kind === 'song' && state.liveAt.item.song === song) { state.liveAt = null; state.onAir = false; update(false); }
  if (state.item?.kind === 'song' && state.item.song === song) { state.item = null; state.onAir = false; renderStrip(); update(false); }
}

function initSongEditorExtras() {
  $('#restoreOriginal').addEventListener('click', () => {
    const o = editingSong?.original;
    if (!o) return;
    $('#songTitle').value = o.title;
    $('#songAuthor').value = o.author || '';
    $('#songLyrics').value = slidesToText(o.slides);
    $('#restoreOriginal').hidden = true;
    toast('Letra original puesta. Pulsa «Guardar» para conservarla.');
  });
}

function deleteSong(song) {
  if (song.source !== 'mine') { hideHymn(song); return; }
  const idx = state.mine.indexOf(song);
  if (idx < 0) return;
  state.mine.splice(idx, 1);
  persistMine();
  clearSongFromScreen(song);
  renderLibrary();
  toast(`«${song.title}» eliminada`, {
    label: 'Deshacer',
    fn: () => { state.mine.splice(idx, 0, song); persistMine(); renderLibrary(); loadItem(makeSongItem(song)); },
  });
}

/* ───────────── Apariencia ───────────── */
function buildLookPanel() {
  const fontButtons = (key, list) => list.map((f) => `
    <button class="font-opt" type="button" data-look-set="${key}" data-value="${f.id}">
      <span class="aa" style="font-family:${esc(f.stack)}">Aa</span><span class="fname">${esc(f.name)}</span>
    </button>`).join('');
  $('#fontGrid').innerHTML = fontButtons('font', FONTS);
  $('#refFontGrid').innerHTML = fontButtons('refFont', [{ id: 'same', name: 'Igual', stack: 'inherit' }, ...FONTS]);

  const swatches = (key, { same = false } = {}) => `
    ${same ? `<button class="swatch same" type="button" data-look-set="${key}" data-value="same" aria-label="Igual que el texto" title="Igual que el texto">=</button>` : ''}
    ${paletteFor(key).map((c) => `<button class="swatch" type="button" style="--sw:${c.value}" data-look-set="${key}" data-value="${c.value}" aria-label="${esc(c.name)}" title="${esc(c.name)}"></button>`).join('')}
    <label class="swatch custom" title="Otro color" data-custom="${key}"><input type="color" data-look="${key}" aria-label="Elegir otro color"></label>`;
  $('#colorSwatches').innerHTML = swatches('color');
  $('#strokeSwatches').innerHTML = swatches('strokeColor');
  $('#refColorSwatches').innerHTML = swatches('refColor', { same: true });
  $('#bgSwatches').innerHTML = swatches('bg');
  $('#dimSwatches').innerHTML = swatches('dimColor');
  $('#frameSwatches').innerHTML = swatches('frameColor');
}

function setRange(r, value) {
  r.value = value;
  r.style.setProperty('--p', `${((value - r.min) / (r.max - r.min)) * 100}%`);
}

function paletteFor(key) {
  return PALETTES[key === 'strokeColor' ? 'stroke' : key] || [];
}

function updateDragHint() {
  $('#monitor').classList.toggle('can-drag', inspectorOpen() && state.inspTab === 'bg' && !!state.live.look.bgImage && !isCompact());
}

function syncLookControls() {
  const L = state.live.look;
  const panel = $('#inspector');
  $$('[data-look]', panel).forEach((el) => {
    const v = L[el.dataset.look];
    if (el.type === 'checkbox') el.checked = !!v;
    else if (el.type === 'range') setRange(el, v);
    else if (el.type === 'color') el.value = /^#[0-9a-f]{6}$/i.test(v) ? v : L.color;
  });
  $$('[data-val]', panel).forEach((el) => { el.textContent = FORMAT[el.dataset.val](L[el.dataset.val]); });
  $$('[data-look-set]', panel).forEach((b) => b.setAttribute('aria-pressed', String(String(L[b.dataset.lookSet]) === b.dataset.value)));
  $$('[data-custom]', panel).forEach((el) => {
    const key = el.dataset.custom;
    el.setAttribute('aria-pressed', String(L[key] !== 'same' && !paletteFor(key).some((c) => c.value === L[key])));
  });
  $$('[data-needs]', panel).forEach((el) => { el.hidden = !L[el.dataset.needs]; });
  $('#clearImage').hidden = !L.bgImage;
  $('#bgZoomRange').min = L.bgFit === 'cover' ? 100 : 20;
  updateDragHint();
  renderResolutions();
  syncAnimControls();
}

const RESOLUTIONS = {
  '16/9': { note: 'Televisores, pantallas LED y la mayoría de proyectores actuales.', sizes: [
    ['HD', 1280, 720], ['Full HD', 1920, 1080, true], ['QHD', 2560, 1440], ['4K UHD', 3840, 2160]] },
  '16/10': { note: 'Proyectores de oficina y muchas laptops.', sizes: [
    ['WXGA', 1280, 800], ['WUXGA', 1920, 1200, true], ['WQXGA', 2560, 1600], ['WQUXGA', 3840, 2400]] },
  '4/3': { note: 'Proyectores y monitores antiguos.', sizes: [
    ['XGA', 1024, 768, true], ['SXGA+', 1400, 1050], ['UXGA', 1600, 1200], ['QXGA', 2048, 1536]] },
};

function renderResolutions() {
  const info = RESOLUTIONS[state.live.look.ratio];
  if (!info) return;
  $('#ratioNote').textContent = info.note;
  $('#ratioList').innerHTML = info.sizes.map(([name, w, h, common]) => `
    <li><span class="res-name">${name}</span>${common ? '<span class="res-tag">Más común</span>' : ''}
      <span class="res-px">${w.toLocaleString('es')} × ${h.toLocaleString('es')} px</span></li>`).join('');
}

function initRatioHelp() {
  const btn = $('#ratioHelp');
  const info = $('#ratioInfo');
  btn.addEventListener('click', () => {
    info.hidden = !info.hidden;
    btn.setAttribute('aria-expanded', String(!info.hidden));
  });
}

function applyRootRatio() {
  document.documentElement.style.setProperty('--ratio-n', ratioNumber(state.live.look.ratio));
}

// Guardar en localStorage se retrasa un poco: al arrastrar o mover un deslizador llegan muchos cambios seguidos.
let lookSaveTimer = null;
function setLook(patch) {
  const L = state.live.look;
  if ((patch.bgFit ?? L.bgFit) === 'cover' && (patch.bgZoom ?? L.bgZoom) < 100) patch = { ...patch, bgZoom: 100 };
  Object.assign(state.live.look, patch);
  clearTimeout(lookSaveTimer);
  lookSaveTimer = setTimeout(() => {
    if (!store.set(KEY.look, state.live.look) && state.live.look.bgImage) toast('La imagen es muy grande para recordarla; se usará solo en esta sesión.');
  }, 250);
  syncLookControls();
  applyRootRatio();
  update(false);
}

let lookFrame = 0;
let lookPatch = {};
function scheduleLook(patch) {
  Object.assign(lookPatch, patch);
  if (lookFrame) return;
  lookFrame = requestAnimationFrame(() => { lookFrame = 0; const p = lookPatch; lookPatch = {}; setLook(p); });
}

// Arrastrar sobre la pantalla mueve la imagen de fondo 1:1; la rueda o el pellizco cambian el zoom.
// Proporción (ancho / alto) de la imagen de fondo; las guardadas antes se miden una vez.
const bgAspects = new Map();
function bgAspect(url) {
  if (!url) return 0;
  if (state.live.look.bgImage === url && state.live.look.bgAspect) return state.live.look.bgAspect;
  if (bgAspects.has(url)) return bgAspects.get(url);
  bgAspects.set(url, 0);
  const img = new Image();
  img.onload = () => bgAspects.set(url, img.naturalWidth / img.naturalHeight);
  img.src = url;
  return 0;
}

// Arrastrar sobre la pantalla mueve la imagen de fondo 1:1 con el puntero; la rueda o el pellizco cambian el zoom.
function bindBackgroundDrag() {
  const mon = $('#monitor');
  let drag = null;
  const active = () => mon.classList.contains('can-drag');
  mon.addEventListener('pointerdown', (e) => {
    if (!active() || e.button !== 0 || e.target.closest('.media-bar')) return;
    e.preventDefault();
    capture(mon, e.pointerId);
    const r = stage.getBoundingClientRect();
    const L = state.live.look;
    // Cuánto sobra (o falta) de imagen en cada eje: 1 punto de posición mueve la imagen un 1 % de eso.
    const a = bgAspect(L.bgImage) || r.width / r.height;
    const cover = L.bgFit === 'cover';
    const s = cover ? Math.max(r.width / a, r.height) : Math.min(r.width / a, r.height);
    const z = Math.max(cover ? 100 : 20, L.bgZoom) / 100;
    const spanX = Math.abs(r.width - a * s) * z;
    const spanY = Math.abs(r.height - s) * z;
    drag = { x: e.clientX, y: e.clientY, bx: L.bgX, by: L.bgY, kx: spanX > 1 ? 100 / spanX : 0, ky: spanY > 1 ? 100 / spanY : 0 };
    mon.classList.add('dragging');
  });
  mon.addEventListener('pointermove', (e) => {
    if (!drag) return;
    scheduleLook({
      bgX: clamp(Math.round(drag.bx + (e.clientX - drag.x) * drag.kx), -50, 50),
      bgY: clamp(Math.round(drag.by + (e.clientY - drag.y) * drag.ky), -50, 50),
    });
  });
  const end = () => { drag = null; mon.classList.remove('dragging'); };
  mon.addEventListener('pointerup', end);
  mon.addEventListener('pointercancel', end);
  mon.addEventListener('wheel', (e) => {
    if (!active()) return;
    e.preventDefault();
    const min = state.live.look.bgFit === 'cover' ? 100 : 20;
    scheduleLook({ bgZoom: clamp(Math.round((state.live.look.bgZoom - e.deltaY * 0.25) / 5) * 5, min, 300) });
  }, { passive: false });
}

async function readImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const scale = Math.min(1, 1920 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // Un logo con fondo transparente se queda en PNG (en JPEG lo transparente saldría negro).
    let transparent = false;
    if (/png|webp|gif/.test(file.type)) {
      const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 3; i < px.length; i += 4 * 97) if (px[i] < 250) { transparent = true; break; }
    }
    return {
      url: transparent ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85),
      aspect: img.naturalWidth / img.naturalHeight,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function refitStages() {
  if (stage) fitStage(stage, state.live.look);
  if (liveStage) fitStage(liveStage, state.live.look);
}

function setInspector(open, { focus = false } = {}) {
  const panel = $('#inspector');
  const btn = $('#toggleInspector');
  const hadFocus = panel.contains(document.activeElement);
  $('#app').dataset.inspector = open ? 'open' : 'closed';
  btn.setAttribute('aria-pressed', String(open));
  btn.setAttribute('aria-expanded', String(open));
  // Cerrado en escritorio, el panel sale del orden de tabulación; en móvil es una pestaña propia.
  panel.inert = !open && !isCompact();
  updateDragHint();
  if (open && focus) $('[data-insp-tab][aria-selected="true"]', panel)?.focus({ preventScroll: true });
  if (!open && hadFocus) btn.focus({ preventScroll: true });
  if (open && state.inspTab === 'anim') requestAnimationFrame(playDemo);
}

const inspectorOpen = () => $('#app').dataset.inspector === 'open';

function setInspTab(tab) {
  state.inspTab = tab;
  $$('[data-insp-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.inspTab === tab)));
  $$('[data-insp]').forEach((s) => { s.hidden = s.dataset.insp !== tab; });
  $('#inspBody').scrollTop = 0;
  if (tab === 'anim') requestAnimationFrame(playDemo);
  updateDragHint();
  saveUI();
}

function setPane(pane) {
  state.pane = pane;
  $('#app').dataset.pane = pane;
  $$('.tab').forEach((t) => t.setAttribute('aria-current', String(t.dataset.pane === pane)));
  saveUI();
}

/* ───────────── Selección de vidrio en los controles segmentados ───────────── */
// Una pastilla translúcida se desliza hasta la opción elegida, como en los controles de Apple.
function placeSegmentThumb(seg) {
  let thumb = seg.querySelector(':scope > .seg-thumb');
  if (!thumb) {
    thumb = document.createElement('span');
    thumb.className = 'seg-thumb';
    thumb.setAttribute('aria-hidden', 'true');
    seg.prepend(thumb);
    seg.classList.add('glass');
  }
  const on = seg.querySelector(':scope > button[aria-selected="true"], :scope > button[aria-pressed="true"]');
  if (!on || !on.offsetWidth) { if (!on) thumb.style.opacity = '0'; return; }
  const first = !thumb.dataset.ready;
  if (first) thumb.style.transition = 'none';
  thumb.style.width = `${on.offsetWidth}px`;
  thumb.style.setProperty('--x', `${on.offsetLeft}px`);
  thumb.style.opacity = '1';
  if (first) { thumb.dataset.ready = '1'; void thumb.offsetWidth; thumb.style.transition = ''; }
}

function setupGlassSegments() {
  const ro = new ResizeObserver((entries) => entries.forEach((en) => placeSegmentThumb(en.target)));
  const watch = (seg) => { if (!seg.dataset.glass) { seg.dataset.glass = '1'; ro.observe(seg); } placeSegmentThumb(seg); };
  $$('.segmented').forEach(watch);
  new MutationObserver((muts) => {
    const segs = new Set();
    for (const m of muts) {
      const seg = m.target.closest?.('.segmented');
      if (seg) segs.add(seg);
      m.addedNodes?.forEach((n) => {
        if (n.nodeType !== 1) return;
        if (n.matches('.segmented')) segs.add(n);
        n.querySelectorAll?.('.segmented').forEach((x) => segs.add(x));
      });
    }
    segs.forEach(watch);
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-selected', 'aria-pressed'] });
}

/* ───────────── Apariencia flotante y movible ───────────── */
// Se arrastra por la cabecera; en los bordes ofrece resistencia y al soltar vuelve dentro de la pantalla.
function bindInspectorDrag(saved) {
  const panel = $('#inspector');
  const head = $('.insp-head', panel);
  const root = document.documentElement.style;
  const bounds = () => ({ minL: 8, maxL: Math.max(8, innerWidth - panel.offsetWidth - 8), minT: 8, maxT: Math.max(8, innerHeight - 72) });
  const rubber = (v, min, max) => {
    const band = (over) => (over * 120 * 0.55) / (120 + 0.55 * Math.abs(over));
    return v < min ? min - band(min - v) : v > max ? max + band(v - max) : v;
  };
  const set = (left, top) => { root.setProperty('--insp-left', `${left}px`); root.setProperty('--insp-top', `${top}px`); };
  const settle = (left, top) => {
    const b = bounds();
    const pos = { left: clamp(left, b.minL, b.maxL), top: clamp(top, b.minT, b.maxT) };
    set(pos.left, pos.top);
    return pos;
  };
  let pos = saved && Number.isFinite(saved.left) ? saved : null;
  if (pos) requestAnimationFrame(() => { pos = settle(pos.left, pos.top); });
  let drag = null;
  head.addEventListener('pointerdown', (e) => {
    if (isCompact() || e.button !== 0 || e.target.closest('button')) return;
    const r = panel.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    panel.classList.add('dragging');
    capture(head, e.pointerId);
    e.preventDefault();
  });
  head.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const b = bounds();
    set(rubber(e.clientX - drag.dx, b.minL, b.maxL), rubber(e.clientY - drag.dy, b.minT, b.maxT));
  });
  const end = () => {
    if (!drag) return;
    drag = null;
    panel.classList.remove('dragging');
    const r = panel.getBoundingClientRect();
    pos = settle(r.left, r.top);
    state.inspPos = pos;
    saveUI();
  };
  head.addEventListener('pointerup', end);
  head.addEventListener('pointercancel', end);
  head.addEventListener('dblclick', (e) => {
    if (e.target.closest('button')) return;
    root.removeProperty('--insp-left');
    root.removeProperty('--insp-top');
    pos = null;
    state.inspPos = null;
    saveUI();
  });
  addEventListener('resize', () => { if (pos) pos = settle(pos.left, pos.top); });
  state.inspPos = pos;
}

/* ───────────── Avisos ───────────── */
function toast(message, action) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.append(Object.assign(document.createElement('span'), { textContent: message }));
  const dismiss = () => { el.classList.add('out'); setTimeout(() => el.remove(), 260); };
  if (action) {
    const btn = Object.assign(document.createElement('button'), { type: 'button', textContent: action.label });
    btn.addEventListener('click', () => { action.fn(); dismiss(); });
    el.append(btn);
  }
  $('#toasts').append(el);
  setTimeout(dismiss, action ? 6000 : 3200);
}

/* ───────────── Acciones de la biblioteca ───────────── */
async function libAction(action) {
  const lib = library(state.songLib);
  switch (action) {
    case 'upload-lyrics': return openEditor(null);
    case 'pick-image': return $('#mediaImageFile').click();
    case 'pick-video': return $('#mediaVideoFile').click();
    case 'pick-audio': return $('#mediaAudioFile').click();
    case 'add-text': return openEditor(null, { mode: 'text' });
    case 'new-deck': return createDeck();
    case 'songs-home': state.songLib = null; renderLibBody(); return saveUI();
    case 'new-song': return openEditor(null, { heading: 'Nueva canción', title: state.tab === 'web' ? state.query.web : '' });
    case 'new-folder': {
      const folder = await createFolder();
      if (folder) { state.songLib = `folder:${folder.id}`; state.query.songs = ''; if (state.tab !== 'songs') state.tab = 'songs'; renderLibrary(); saveUI(); toast(`Carpeta «${folder.name}» creada`); }
      return undefined;
    }
    case 'rename-folder': return lib?.folder && renameFolder(lib.folder);
    case 'delete-folder': return lib?.folder && deleteFolder(lib.folder);
    case 'bibles-open': state.bibleManage = !state.bibleManage; return renderLibrary();
    case 'bibles-back': state.bibleManage = false; return renderLibrary();
    case 'web-back': state.web.artist = null; return renderLibBody();
    case 'artist-retry': return state.web.artist && openArtist(state.web.artist);
    case 'web-retry': return searchWeb(state.web.q);
    case 'restore-hymns': {
      const prefix = `${state.songLib}|`;
      [...state.hymnHidden].filter((k) => k.startsWith(prefix)).forEach((k) => state.hymnHidden.delete(k));
      store.set(KEY.hymnHidden, [...state.hymnHidden]);
      renderLibrary();
      return toast('Himnos recuperados');
    }
    case 'web-from-query': return searchWeb(state.query.songs);
    default: return undefined;
  }
}

/* ───────────── OBS ───────────── */
// Tamaño para la fuente de OBS según el formato de la pantalla: la misma altura de 1080 (o el ancho
// de 1920) que usa OBS por defecto, sin estirar ni dejar bandas.
const OBS_SIZES = { '16/9': [1920, 1080], '16/10': [1920, 1200], '4/3': [1440, 1080] };

async function refreshObsDesktop() {
  let st = { on: false };
  try { st = await tauri('obs_status'); } catch { /* sin datos */ }
  state.obsOn = !!st.on;
  $('#obsSwitch').checked = state.obsOn;
  $('#obsLan').disabled = !state.obsOn;
  $('#obsLan').checked = !!st.lan;
  $$('#obsDialog .obs-link, #obsDialog .obs-steps').forEach((el) => { el.hidden = !state.obsOn; });
  if (!state.obsOn) return;
  // Con «en la red», los enlaces usan la IP de este equipo y la llave de visor; si no, localhost.
  const base = st.lan ? `${st.lan}/?salida&obs&k=${st.viewer}` : `${st.url}/?salida&obs`;
  $('#obsFull').value = base;
  $('#obsOverlay').value = `${base}&transparente`;
}

async function setObsDesktop(on, lan) {
  try {
    if (on) { await tauri('obs_start', { lan }); state.obsOn = true; resyncServer(); }
    else { await tauri('obs_stop'); state.obsOn = false; }
  } catch (e) {
    toast(String(e).includes('sesion') ? 'La sesión terminó. Vuelve a entrar.' : `No se pudo encender OBS: ${e}`);
  }
  refreshObsDesktop();
}

function openObs() {
  const ratio = state.live.look.ratio;
  const [w, h] = OBS_SIZES[ratio] || OBS_SIZES['16/9'];
  $('#obsWidth').textContent = w;
  $('#obsHeight').textContent = h;
  $('#obsRatio').textContent = ratio.replace('/', ':');
  const base = `${location.origin}${location.pathname}`;
  const k = auth.viewer ? `&k=${auth.viewer}` : '';
  $('#obsFull').value = `${base}?salida&obs${k}`;
  $('#obsOverlay').value = `${base}?salida&obs&transparente${k}`;
  $('#obsWarn').hidden = serverLive;
  $('#obsDesktop').hidden = !DESKTOP;
  if (DESKTOP) refreshObsDesktop();
  $('#obsDialog').showModal();
}

async function copyField(id) {
  const input = $(`#${id}`);
  try {
    await navigator.clipboard.writeText(input.value);
  } catch {
    input.select();
    document.execCommand('copy');
  }
  toast('Enlace copiado');
}

/* ───────────── Eventos ───────────── */
function focusSearch() {
  if (state.pane !== 'library') setPane('library');
  const input = $('#search');
  input.focus();
  input.select();
}

const NEXT_KEYS = ['ArrowRight', 'ArrowDown', 'PageDown', ' '];
const PREV_KEYS = ['ArrowLeft', 'ArrowUp', 'PageUp'];

// En el modo de dos pantallas, adelante y atrás cambian directamente lo que está en vivo. B quita lo
// que está en pantalla en cualquier modo.
function handleKey(key, e) {
  const studio = studioOn();
  if (NEXT_KEYS.includes(key)) { e?.preventDefault(); if (studio) studioNext(); else step(1); }
  else if (PREV_KEYS.includes(key)) { e?.preventDefault(); if (studio) studioPrev(); else step(-1); }
  else if (key === 'Enter') { e?.preventDefault(); if (studio) studioNext(); else setOnAir(!state.onAir); }
  else if (key === 'b' || key === 'B') { e?.preventDefault(); setOnAir(false); }
  else if (key === '/') { e?.preventDefault(); focusSearch(); }
}

// En la ventana del proyector se está presentando, así que navegar nunca deja la pantalla a oscuras:
// si no hay nada en vivo, la primera tecla vuelve a mostrar lo último (o lo preparado) sin saltarlo, e
// Intro no apaga. Para oscurecer a propósito, B o «.», como en PowerPoint.
function handleOutputKey(key) {
  if (key === 'b' || key === 'B' || key === '.') { if (state.onAir) setOnAir(false); else resumeLive(); return; }
  if (!state.onAir) { resumeLive(); return; }
  if (key === 'Enter') return;
  const delta = NEXT_KEYS.includes(key) ? 1 : PREV_KEYS.includes(key) ? -1 : 0;
  if (!delta) return;
  if (!studioOn()) step(delta);
  else if (delta > 0) studioNext();
  else studioPrev();
}

function bindEvents() {
  $$('[data-tab]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

  $('#libTools').addEventListener('change', (e) => {
    if (e.target.id === 'bibleSelect') { switchBible(e.target.value); return; }
    if (e.target.id !== 'libSelect') return;
    state.songLib = e.target.value;
    state.query.songs = '';
    renderLibrary();
    saveUI();
  });
  $('#libTools').addEventListener('click', (e) => {
    const b = e.target.closest('[data-action]');
    if (b) libAction(b.dataset.action);
  });

  $('#libBody').addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    const d = t.dataset;
    if (d.book != null) return toggleBook(Number(d.book));
    if (d.bookChip != null) return toggleBook(Number(d.bookChip), { forceOpen: true });
    if (d.chapter != null) return loadItem(makeBibleItem(Number(d.bookOf), Number(d.chapter)));
    if (d.jump) {
      const [b, c, v, to] = d.jump.split(',').map((x) => (x === '' || x == null ? null : Number(x)));
      state.openBook = b;
      return to != null ? loadItem(makeBibleItem(b, c, v, to)) : loadItem(makeBibleItem(b, c), v ?? 0);
    }
    if (d.lib) { state.songLib = d.lib; renderLibBody(); $('#libBody').scrollTop = 0; saveUI(); return; }
    if (d.editSong != null) { const song = findSong(d.src, d.editSong); if (song) editSong(song); return; }
    if (d.delSong != null) { const song = findSong(d.src, d.delSong); if (song) deleteSong(song); return; }
    if (d.song != null) { const song = findSong(d.src || state.songLib, d.song); if (song) loadItem(makeSongItem(song)); return; }
    if (d.web != null) return openWebResult(Number(d.web));
    if (d.artist != null) return openArtist(state.web.artists[Number(d.artist)]);
    if (d.track != null) return openTrack(Number(d.track));
    if (d.webIdea) return searchWeb(d.webIdea);
    if (d.tabGo) return setTab(d.tabGo);
    if (d.openText) { const t = state.texts.find((x) => x.id === d.openText); if (t) loadItem(makeTextItem(t)); return; }
    if (d.openMedia) { const m = state.media.find((x) => x.id === d.openMedia); if (m) loadItem(makeMediaItem(m)); return; }
    if (d.delText) { const t = state.texts.find((x) => x.id === d.delText); if (t) deleteText(t); return; }
    if (d.delMedia) return deleteMedia(d.delMedia);
    if (d.openAudio) { const m = state.media.find((x) => x.id === d.openAudio); if (m) playAudio(m); return; }
    if (d.delAudio) return deleteMedia(d.delAudio);
    if (d.openDeck) { const deck = state.decks.find((x) => x.id === d.openDeck); if (deck) loadItem(makeDeckItem(deck)); return; }
    if (d.delDeck) { const deck = state.decks.find((x) => x.id === d.delDeck); if (deck) deleteDeck(deck); return; }
    if (d.bibleGet) return downloadBible(d.bibleGet);
    if (d.bibleUse) return switchBible(d.bibleUse);
    if (d.bibleDel) return deleteBible(d.bibleDel);
    if (d.action) return libAction(d.action);
  });

  const search = $('#search');

  const editor = $('#songEditor');
  $('#songFolder').addEventListener('change', onFolderSelect);
  $('#lyricsFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) await readLyricsFile(file).catch(() => toast('No se pudo leer ese archivo. Usa un archivo de texto (.txt).'));
  });
  const lyrics = $('#songLyrics');
  lyrics.addEventListener('dragover', (e) => { e.preventDefault(); lyrics.classList.add('drop'); });
  lyrics.addEventListener('dragleave', () => lyrics.classList.remove('drop'));
  lyrics.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    lyrics.classList.remove('drop');
    if (!file) return;
    e.preventDefault();
    readLyricsFile(file).catch(() => toast('No se pudo leer ese archivo. Usa un archivo de texto (.txt).'));
  });
  editor.addEventListener('close', () => lyrics.classList.remove('drop'));

  $('#mediaImageFile').addEventListener('change', (e) => { const files = [...e.target.files]; e.target.value = ''; if (files.length) addMediaFiles(files, 'image'); });
  $('#mediaVideoFile').addEventListener('change', (e) => { const files = [...e.target.files]; e.target.value = ''; if (files.length) addMediaFiles(files, 'video'); });
  $('#mediaAudioFile').addEventListener('change', (e) => { const files = [...e.target.files]; e.target.value = ''; if (files.length) addMediaFiles(files, 'audio'); });
  bindMediaBar();
  bindAudioBar();

  $('#obsBtn').addEventListener('click', openObs);
  $('#obsChip').addEventListener('click', openObs);
  $('#obsDialog').addEventListener('click', (e) => {
    const b = e.target.closest('[data-copy]');
    if (b) copyField(b.dataset.copy);
  });

  $('#stripActions').addEventListener('change', async (e) => {
    const sel = e.target.closest('[data-strip-folder]');
    if (!sel || state.item?.kind !== 'song') return;
    let folderId = sel.value;
    if (folderId === '__new') {
      const folder = await createFolder();
      if (!folder) { sel.innerHTML = folderOptionsHtml(state.item.song.folderId); return; }
      folderId = folder.id;
    }
    moveSong(state.item.song, folderId);
  });

  $('#libBody').addEventListener('input', (e) => {
    if (e.target.id !== 'artistFilter' || !state.web.artist) return;
    state.web.artist.filter = e.target.value;
    refreshArtistSongs();
  });

  search.addEventListener('input', () => {
    state.query[state.tab] = search.value;
    if (state.tab !== 'web') renderLibBody();
  });
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      search.value = '';
      search.dispatchEvent(new Event('input'));
      search.blur();
      return;
    }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (state.tab === 'web') { searchWeb(search.value); return; }
    const first = $('#libBody .jump-row, #libBody .chip, #libBody .song-row, #libBody .result');
    if (first) { first.click(); search.blur(); }
  });

  $('#slides').addEventListener('click', (e) => {
    const s = e.target.closest('[data-slide]');
    if (!s) return;
    if (studioOn()) sendToLive(state.item, Number(s.dataset.slide));
    else select(Number(s.dataset.slide));
  });
  $('#slides').addEventListener('dblclick', (e) => {
    if (e.target.closest('[data-slide]') && !studioOn()) setOnAir(true);
  });
  const onStripAction = (e) => {
    const b = e.target.closest('[data-strip]');
    if (!b) return;
    const it = state.item;
    const a = b.dataset.strip;
    if (a === 'edit-verse' && it?.kind === 'bible') { openVerseEditor(); return; }
    if (a === 'chapter' && it?.kind === 'bible') {
      const ch = it.ch + Number(b.dataset.value);
      const keep = Number(b.dataset.value) === 0 ? it.slides[state.previewIndex].v : 0;
      if (state.bible[it.b].chapters[ch]) loadItem(makeBibleItem(it.b, ch), keep);
    } else if (a === 'save-web') saveWebSong();
    else if (a === 'edit-song' && it?.kind === 'song') editSong(it.song);
    else if (a === 'delete-song' && it?.kind === 'song') deleteSong(it.song);
    else if (a === 'track-retry' && pendingTrack) openTrack(pendingTrack.id);
    else if (a === 'edit-text' && it?.kind === 'text') openEditor(null, { mode: 'text', text: it.text });
    else if (a === 'edit-deck' && it?.kind === 'deck') openStudio(it.deck, state.previewIndex);
    else if (a === 'add-deck-slide' && it?.kind === 'deck') {
      it.deck.slides.splice(state.previewIndex + 1, 0, newDesignSlide());
      persistDecks();
      refreshDeckItem(it.deck, state.previewIndex + 1);
      openStudio(it.deck, state.previewIndex);
    } else if (a === 'delete-deck' && it?.kind === 'deck') deleteDeck(it.deck);
    else if (a === 'delete-text' && it?.kind === 'text') deleteText(it.text);
    else if (a === 'delete-media' && it?.kind === 'media') deleteMedia(it.media.id);
    else if (a === 'fit' && it?.kind === 'media') { it.media.fit = b.dataset.value; persistMedia(); renderStrip(); update(false); }
    else if (a === 'loop' && it?.kind === 'media') { it.media.loop = !it.media.loop; persistMedia(); renderStrip(); update(false); }
    else if (a === 'mute' && it?.kind === 'media') { it.media.muted = !it.media.muted; persistMedia(); renderStrip(); update(false); }
    else if (a === 'play' && it?.kind === 'media') setPlayback({ playing: !(state.playback.id === it.media.id && state.playback.playing) });
    else if (a === 'restart' && it?.kind === 'media') setPlayback({ position: 0, playing: true });
    else if (a === 'track-manual' && pendingTrack) openEditor(null, { title: pendingTrack.title, author: pendingTrack.artist });
    else if (a === 'restore') { renderStrip(); markStrip(); }
  };
  $('#stripActions').addEventListener('click', onStripAction);
  $('#slides').addEventListener('click', onStripAction);

  $('#prevBtn').addEventListener('click', () => (studioOn() ? studioPrev() : step(-1)));
  $('#nextBtn').addEventListener('click', () => (studioOn() ? studioNext() : step(1)));
  $('#liveBtn').addEventListener('click', () => (studioOn() ? studioNext() : setOnAir(!state.onAir)));
  $('#openOutput').addEventListener('click', openOutput);
  $('#toggleInspector').addEventListener('click', () => setInspector(!inspectorOpen(), { focus: true }));
  $('#closeInspector').addEventListener('click', () => setInspector(false));
  $$('[data-insp-tab]').forEach((b) => b.addEventListener('click', () => setInspTab(b.dataset.inspTab)));
  $$('.tab').forEach((t) => t.addEventListener('click', () => setPane(t.dataset.pane)));

  const panel = $('#inspector');
  panel.addEventListener('input', (e) => {
    const key = e.target.dataset.look;
    if (!key) return;
    const t = e.target;
    setLook({ [key]: t.type === 'checkbox' ? t.checked : t.type === 'range' ? Number(t.value) : t.value });
  });
  panel.addEventListener('click', (e) => {
    const set = e.target.closest('[data-look-set]');
    if (set) {
      const raw = set.dataset.value;
      setLook({ [set.dataset.lookSet]: /^\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw });
      return;
    }
    if (e.target.closest('[data-look-reset="bgPosition"]')) { setLook({ bgZoom: 100, bgX: 0, bgY: 0 }); return; }
    const stepBtn = e.target.closest('[data-look-step]');
    if (stepBtn) {
      const key = stepBtn.dataset.lookStep;
      const r = $(`input[data-look="${key}"]`, panel);
      setLook({ [key]: clamp(state.live.look[key] + Number(stepBtn.dataset.value), Number(r.min), Number(r.max)) });
    }
  });
  $('#resetLook').addEventListener('click', () => {
    const previous = { ...state.live.look };
    setLook({ ...DEFAULT_LOOK });
    toast('Apariencia restablecida', { label: 'Deshacer', fn: () => setLook(previous) });
  });
  $('#bgFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    let pic;
    try { pic = await readImage(file); } catch { toast('No se pudo abrir esa imagen. Prueba con un archivo JPG o PNG.'); return; }
    // Si la forma de la imagen no es la de la pantalla (un logo cuadrado, una foto vertical), se ve
    // completa con relleno difuminado; si coincide, llena la pantalla sin recortar casi nada.
    const screen = ratioNumber(state.live.look.ratio);
    const fit = Math.abs(Math.log(pic.aspect / screen)) > 0.15 ? 'blur' : 'cover';
    setLook({ bgImage: pic.url, bgAspect: pic.aspect, bgFit: fit, bgZoom: 100, bgX: 0, bgY: 0 });
    if (fit === 'blur') toast('La imagen se ve completa, con los lados rellenos. Para que llene la pantalla elige «Llenar».');
  });
  $('#clearImage').addEventListener('click', () => setLook({ bgImage: null, bgAspect: 0 }));
  bindBackgroundDrag();

  $('#songEditor').addEventListener('close', onEditorClose);

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); focusSearch(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if ($('dialog[open]')) return;
    if (e.key === 'Escape' && inspectorOpen() && !isCompact()) { setInspector(false); return; }
    if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    if (e.key === 'Enter' && e.target.closest?.('button, a')) return;
    handleKey(e.key, e);
  });

  if (DESKTOP) {
    const ev = window.__TAURI__.event;
    ev.listen('proyector', (e) => { state.outputConnected = !!e.payload; renderMonitorMeta(); });
    ev.listen('salida-tecla', (e) => { if (auth.mode === 'open') handleOutputKey(e.payload); });
    tauri('projector_open').then((on) => { state.outputConnected = on; renderMonitorMeta(); }).catch(() => {});
    $('#screenList').addEventListener('click', (e) => {
      const b = e.target.closest('[data-screen]');
      if (!b) return;
      $('#screenDialog').close();
      tauri('open_projector', { monitor: Number(b.dataset.screen) }).catch((err) => toast(`No se pudo abrir el proyector: ${err}`));
    });
    $('#closeProjector').addEventListener('click', () => { $('#screenDialog').close(); tauri('close_projector'); });
    $('#obsSwitch').addEventListener('change', (e) => setObsDesktop(e.target.checked, $('#obsLan').checked));
    $('#obsLan').addEventListener('change', (e) => setObsDesktop(true, e.target.checked));
  }

  // Mensajes de la ventana del proyector (misma app, otra ventana): está conectada y sus teclas.
  addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.source === window || !e.data || typeof e.data !== 'object') return;
    if (e.data.type === 'hello') {
      state.outWin = e.source;
      if (!state.outputConnected) { state.outputConnected = true; renderMonitorMeta(); }
    } else if (e.data.type === 'bye') {
      state.outputConnected = false;
      renderMonitorMeta();
    } else if (e.data.type === 'output-key' && auth.mode === 'open') {
      handleOutputKey(e.data.key);
    }
  });
}

/* ───────────── Apariencia → Animación ───────────── */
// Repite la entrada en la vista previa de la consola; el proyector no se entera (su diapositiva no cambió).
function replayPreview() {
  if (!stage || !currentSlide()) return;
  stage.dataset.key = '';
  update(true);
}

// Ejemplo A → B: un escenario de verdad, con el aspecto actual, que pasa de una diapositiva a la otra.
const DEMO_SLIDES = [
  { label: 'A', text: 'Diapositiva A', ref: 'Ejemplo 1:1' },
  { label: 'B', text: 'Así entra la diapositiva B', ref: 'Ejemplo 1:2' },
];
let demoStage = null;
let demoTimer = 0;

function playDemo() {
  if (!demoStage || $('[data-insp="anim"]').hidden || !inspectorOpen()) return;
  clearTimeout(demoTimer);
  const look = state.live.look;
  const tag = $('#animDemoTag');
  paintStage(demoStage, { look, slide: DEMO_SLIDES[0], silent: true }, false);
  tag.textContent = 'A';
  demoTimer = setTimeout(() => {
    paintStage(demoStage, { look, slide: DEMO_SLIDES[1], silent: true }, true);
    tag.textContent = 'B';
  }, 700);
}

// Cada ajuste solo aparece cuando sirve para el efecto elegido.
function syncAnimControls() {
  const { transition: tr, textAnim: tx } = state.live.look;
  const show = {
    'tr-dir': tr === 'slide',
    'tr-int': tr === 'zoom' || tr === 'blur',
    'tr-ease': tr !== 'cut' && tr !== 'black',
    'tr-dur': tr !== 'cut',
    'tx-dir': tx === 'slide',
    'tx-int': ['slide', 'zoom', 'blur', 'words'].includes(tx),
    'tx-ease': !['none', 'letters'].includes(tx),
    'tx-dur': tx !== 'none',
    'tx-delay': tx !== 'none',
  };
  $$('[data-anim-for]').forEach((el) => { el.hidden = !show[el.dataset.animFor]; });
  const durLabel = $('#txSpeedLabel');
  if (durLabel) durLabel.textContent = tx === 'words' || tx === 'letters' ? 'Tiempo hasta verse todo' : 'Duración';
}

function initAnimPanel() {
  const tile = (key, [value, name]) => `<button class="anim-opt" type="button" data-look-set="${key}" data-value="${value}">${name}</button>`;
  $('#transitionGrid').innerHTML = TRANSITIONS.map((t) => tile('transition', t)).join('');
  $('#textAnimGrid').innerHTML = TEXT_ANIMS.map((t) => tile('textAnim', t)).join('');
  demoStage = createStage();
  $('#animDemo').prepend(demoStage);
  new ResizeObserver(() => fitStage(demoStage, state.live.look)).observe(demoStage);
  syncLookControls();

  $('#replayAnim').addEventListener('click', replayPreview);
  $('#animDemo').addEventListener('click', playDemo);
  const panel = $('#inspector');
  // Al tocar cualquier ajuste se ve en el ejemplo en el acto.
  panel.addEventListener('click', (e) => {
    if (e.target.closest('[data-insp-tab="anim"], [data-insp="anim"] [data-look-set]')) requestAnimationFrame(playDemo);
  });
  panel.addEventListener('change', (e) => { if (e.target.closest('[data-insp="anim"] input')) playDemo(); });
  $('#toggleInspector').addEventListener('click', () => requestAnimationFrame(playDemo));
}

/* ───────────── Modo estudio: vista previa + en vivo ───────────── */
function applyStudio() {
  const on = studioOn();
  $('.monitors').classList.toggle('studio', on);
  $('#liveCol').hidden = !on;
  $('#studioSwitch').checked = !!state.studio;
}

function setStudio(on) {
  state.studio = on;
  store.set('biblia.studio', on);
  // Al volver a una sola pantalla, la vista previa salta a lo que está en vivo: el público no ve ningún cambio.
  if (!on && state.onAir && state.liveAt) {
    const { item, i } = state.liveAt;
    if (item === state.item) state.previewIndex = i;
    else { state.item = item; state.previewIndex = i; renderStrip(); renderLibBody(); syncGotoFromItem(); }
  }
  applyStudio();
  // Al pasar a dos pantallas con algo en vivo, a la izquierda aparece directamente la siguiente.
  if (on && studioOn() && state.onAir && state.liveAt) sendToLive(state.liveAt.item, state.liveAt.i);
  else update(false);
  refitStages();
}

function initStudio() {
  state.studio = store.get('biblia.studio', false);
  liveStage = createStage();
  $('#liveMonitor').prepend(liveStage);
  new ResizeObserver(() => fitStage(liveStage, state.live.look)).observe(liveStage);
  $('#studioSwitch').addEventListener('change', (e) => setStudio(e.target.checked));
  $('#clearLive').addEventListener('click', () => setOnAir(false));
  matchMedia('(max-width: 1099px)').addEventListener('change', () => { applyStudio(); update(false); });
  applyStudio();
  update(false);
}

/* ───────────── Iglesia y bienvenida ───────────── */
const CHURCH_KEY = 'biblia.iglesia';
const DEFAULT_NAME = 'Biblia';

function applyChurch() {
  const church = store.get(CHURCH_KEY, null);
  $('#brandName').textContent = church?.name || DEFAULT_NAME;
  document.title = church?.name ? `${church.name} · Biblia` : DEFAULT_NAME;
}

function initWelcome() {
  const dlg = $('#welcome');
  const form = $('#welcomeForm');
  const nameInput = $('#churchName');
  const preview = () => { $('#wlPrevName').textContent = nameInput.value.trim() || DEFAULT_NAME; };

  nameInput.addEventListener('input', preview);
  dlg.addEventListener('click', (e) => {
    const action = e.target.closest('[data-wl]')?.dataset.wl;
    if (action === 'back') dlg.close();
    else if (action === 'change-pin') { dlg.close(); showGate('change'); }
    else if (action === 'lock-now') { dlg.close(); lockNow(); }
  });
  form.addEventListener('submit', () => {
    const name = nameInput.value.trim();
    store.set(CHURCH_KEY, { name });
    applyChurch();
    saveChurchName(name);
  });
  $('#brandBtn').addEventListener('click', () => {
    nameInput.value = store.get(CHURCH_KEY, null)?.name || '';
    preview();
    dlg.showModal();
    nameInput.focus();
  });
}

/* ───────────── Divisores ajustables ───────────── */
// Arrastre 1:1 desde donde se agarró, con captura del puntero para no perderlo fuera del divisor.
function dragHandle(handle, cursorClass, onStart, onMove, onEnd) {
  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    handle.classList.add('active');
    document.body.classList.add(cursorClass);
    const origin = onStart(e);
    const ac = new AbortController();
    const end = () => {
      ac.abort();
      handle.classList.remove('active');
      document.body.classList.remove(cursorClass);
      onEnd();
    };
    handle.addEventListener('pointermove', (ev) => onMove(ev, origin), { signal: ac.signal });
    handle.addEventListener('pointerup', end, { signal: ac.signal });
    handle.addEventListener('pointercancel', end, { signal: ac.signal });
  });
}

function initResizer() {
  const root = document.documentElement;
  const library = $('.library');
  const main = $('.main');
  const monitors = $('.monitors');
  const split = $('#splitV');

  // Ancho de la biblioteca.
  const LIB_MIN = 260, LIB_MAX = 560;
  const setLib = (w) => root.style.setProperty('--lib-w', `${Math.round(clamp(w, LIB_MIN, LIB_MAX))}px`);
  const savedLib = store.get('easybiblia.libWidth');
  if (savedLib) setLib(savedLib);

  const resizer = document.createElement('div');
  resizer.className = 'resizer';
  resizer.setAttribute('aria-hidden', 'true');
  $('#app').appendChild(resizer);
  dragHandle(resizer, 'is-resizing-x',
    (e) => ({ x: e.clientX, w: library.offsetWidth }),
    (ev, o) => setLib(o.w + ev.clientX - o.x),
    () => store.set('easybiblia.libWidth', library.offsetWidth));
  resizer.addEventListener('dblclick', () => { root.style.removeProperty('--lib-w'); store.set('easybiblia.libWidth', null); });

  // Alto de la vista previa frente a las diapositivas.
  const MON_MIN = 240, STRIP_MIN = 160;
  const monMax = () => main.clientHeight - $('.toolbar').offsetHeight - split.offsetHeight - STRIP_MIN;
  const setMon = (h) => main.style.setProperty('--mon-h', `${Math.round(clamp(h, MON_MIN, Math.max(MON_MIN, monMax())))}px`);
  const saveMon = () => store.set('biblia.monH', monitors.offsetHeight);
  const savedMon = store.get('biblia.monH');
  if (savedMon) setMon(savedMon);

  dragHandle(split, 'is-resizing-y',
    (e) => ({ y: e.clientY, h: monitors.offsetHeight }),
    (ev, o) => setMon(o.h + ev.clientY - o.y),
    saveMon);
  split.addEventListener('dblclick', () => { main.style.removeProperty('--mon-h'); store.set('biblia.monH', null); });
  split.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    e.stopPropagation();
    setMon(monitors.offsetHeight + (e.key === 'ArrowDown' ? 24 : -24));
    saveMon();
  });
  addEventListener('resize', () => {
    const h = parseFloat(main.style.getPropertyValue('--mon-h'));
    if (h) setMon(h);
  });
}

/* ───────────── Tema de la app ───────────── */
function initThemeSelector() {
  const seg = $('#themeSeg');
  const select = (theme) => {
    applyTheme(theme);
    $$('[data-theme-opt]', seg).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeOpt === theme)));
    placeSegmentThumb(seg);
  };
  select(store.get('biblia.theme', 'auto'));
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('[data-theme-opt]');
    if (!b) return;
    select(b.dataset.themeOpt);
    store.set('biblia.theme', b.dataset.themeOpt);
  });
}

function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

// La consola arranca solo después del PIN (la llama auth.js cuando el servidor entrega su HTML).
function startConsole() {
  bootConsole();
  initResizer();
  initThemeSelector();
  applyChurch();
  initWelcome();
  initRatioHelp();
  initAnimPanel();
  initSongEditorExtras();
  initVerseEditor();
  initLayoutEditor();
  initStudio();
  // Al volver a entrar, OBS y el proyector se ponen al día al instante: lo que está en vivo y sus
  // imágenes o videos (si el servidor se reinició, los perdió). Mientras tanto nunca se apagaron.
  auth.onUnlock = resyncServer;
  auth.keepAlive = () => state.onAir;
}

if (IS_OUTPUT) bootOutput();
else startGate();
