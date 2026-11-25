// Pruebas de integración aisladas. Ejecutar: node server/test-remote.mjs
// Node solo se usa para las pruebas; el servidor sigue sin dependencias nuevas.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temp = await mkdtemp(join(tmpdir(), 'biblia-remote-test-'));
const app = join(temp, 'app');
const conf = join(temp, 'conf');
const run = join(temp, 'run');
const customOrigin = 'https://biblia.example.com';
const tunnelOrigin = 'https://biblia-prueba.trycloudflare.com';
const tunnelBin = join(temp, 'bin');
const stopped = join(temp, 'tunnel-stopped');
const hex = n => randomBytes(n).toString('hex');
const hash = value => createHash('sha256').update(value).digest('hex');
const verifier = hex(32);
const viewer = hex(16);
const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pub = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const device = hash(Buffer.from(pub, 'base64')).slice(0, 32);
let server;
let output = '';
let port;
let origin = customOrigin;
let checks = 0;
const env = { ...process.env, TMPDIR: run, BIBLIA_CONF_DIR: conf, BIBLIA_ORIGEN_REMOTO: customOrigin };

function request(path, { remote = true, method = 'GET', body = '', headers = {} } = {}) {
  return new Promise((accept, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method, headers: {
      Host: remote ? new URL(origin).host : `localhost:${port}`,
      ...(remote ? { 'X-Forwarded-Proto': 'https', Origin: origin } : {}),
      'Content-Length': Buffer.byteLength(body), ...headers,
    } }, res => {
      let text = '';
      res.setEncoding('utf8').on('data', chunk => { text += chunk; });
      res.on('end', () => accept({ status: res.statusCode, text, headers: res.headers }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('Timeout')));
    req.end(body);
  });
}

async function expect(status, path, options) {
  const response = await request(path, options);
  assert.equal(response.status, status, `${path}: ${response.text.slice(0, 200)}`);
  checks++;
  return response;
}

function signed(path, body = '', headers = {}) {
  const time = String(Math.floor(Date.now() / 1000));
  const nonce = hex(16);
  const message = ['POST', path, time, nonce, hash(body)].join('\n');
  return { method: 'POST', body, headers: {
    'X-Biblia-Device': device, 'X-Biblia-Time': time, 'X-Biblia-Nonce': nonce,
    'X-Biblia-Signature': sign('sha256', Buffer.from(message), privateKey).toString('base64'),
    ...headers,
  } };
}

async function start(mode) {
  const probe = net.createServer();
  await new Promise((ok, fail) => probe.once('error', fail).listen(0, '127.0.0.1', ok));
  port = probe.address().port;
  await new Promise(ok => probe.close(ok));
  output = '';
  origin = mode === 'internet' ? tunnelOrigin : customOrigin;
  const options = mode === 'internet' ? ['--internet'] : [];
  server = spawn('bash', ['serve.sh', '--no-abrir', ...options, String(port)], {
    cwd: app, detached: true, env: { ...env, BIBLIA_ORIGEN_REMOTO: mode === 'remote' ? origin : '',
      PATH: `${tunnelBin}:${process.env.PATH}`, TUNNEL_PORT: String(port), TUNNEL_STOPPED: stopped },
  });
  server.stdout.on('data', data => { output += data; });
  server.stderr.on('data', data => { output += data; });
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(output);
    try {
      if (mode === 'internet' && !output.includes(`${origin}/#acceso=`)) { await delay(100); continue; }
      if ((await request('/', { remote: mode === 'internet' })).status === 200) return;
    } catch {}
    await delay(100);
  }
  throw new Error(`No arrancó el servidor: ${output}`);
}

async function stop() {
  if (!server || server.exitCode !== null) return;
  const child = server;
  const done = new Promise(ok => child.once('exit', ok));
  child.kill('SIGTERM');
  await done;
  server = null;
}

try {
  await Promise.all([mkdir(app), mkdir(conf), mkdir(run), mkdir(tunnelBin)]);
  // Prueba el arranque y el cierre de Biblia con el mismo formato de salida del cliente real.
  await writeFile(join(tunnelBin, 'cloudflared'), `#!/bin/sh
case " $* " in *" --url http://127.0.0.1:$TUNNEL_PORT "*) ;; *) exit 1 ;; esac
trap 'printf cerrado > "$TUNNEL_STOPPED"; exit 0' TERM
printf '| %s |\\nRegistered tunnel connection\\n' '${tunnelOrigin}' >&2
while :; do sleep 0.1; done
`, { mode: 0o700 });
  for (const file of ['serve.sh', 'server', 'index.html', 'console.html']) {
    await cp(join(root, file), join(app, file), { recursive: true });
  }
  await writeFile(join(app, 'datos-de-prueba.json'), '{}');
  // Rechaza configuraciones ambiguas y no permite publicar una instalación sin PIN.
  for (const invalid of ['http://biblia.example.com', 'https://*.example.com',
    'https://ejemplo.com/ruta', 'https://ejemplo.com:443', 'https://a.com\nSetEnv MAL 1']) {
    const result = spawnSync('bash', ['serve.sh', '--no-abrir'], {
      cwd: app, env: { ...env, BIBLIA_ORIGEN_REMOTO: invalid }, encoding: 'utf8',
    });
    assert.equal(result.status, 1); checks++;
  }
  assert.equal(spawnSync('bash', ['serve.sh', '--no-abrir'], { cwd: app, env }).status, 1); checks++;
  await writeFile(join(conf, 'pin'), `${hex(16)} ${hash(verifier)}\n`);
  await writeFile(join(conf, 'viewer.key'), viewer);

  await start('local');
  await expect(200, '/', { remote: false });
  await expect(403, '/');
  await expect(403, '/api/auth?accion=estado');
  await expect(200, '/api/live?rev=-1', { remote: false });
  await stop();

  await start('remote');
  await expect(200, '/');
  await expect(403, '/', { headers: { Host: 'otro.example.com' } });
  await expect(403, '/', { headers: { 'X-Forwarded-Proto': 'http' } });
  await expect(403, '/api/auth?accion=estado', { headers: { 'X-Forwarded-Proto': '' } });
  await expect(421, '/api/live', { headers: { Host: `localhost:${port}` } });
  await expect(403, '/console.html');
  await expect(403, '/server/lib.sh');
  await expect(403, '/api/live?rev=-1');
  await expect(403, '/api/media?id=prueba');
  await expect(403, '/api/auth?accion=crear', { method: 'POST' });
  await expect(403, '/api/auth?accion=entrar', { method: 'POST', headers: { Origin: 'https://intruso.example' } });
  await expect(403, '/api/auth?accion=entrar', { method: 'POST', headers: { Origin: `http://localhost:${port}` } });
  await expect(403, '/api/auth?accion=entrar', { method: 'POST', headers: { Origin: '' } });
  await expect(401, '/api/app', { method: 'POST' });
  await expect(401, '/api/live', { method: 'POST', body: '{}' });
  await expect(401, '/api/auth?accion=entrar', { method: 'POST', body: JSON.stringify({ verifier: hex(32), pub }) });
  await expect(200, '/api/auth?accion=entrar', { method: 'POST', body: JSON.stringify({ verifier, pub }) });
  const session = await expect(200, '/api/auth?accion=comprobar', signed('/api/auth?accion=comprobar'));
  assert.equal(JSON.parse(session.text).viewer, viewer);
  await expect(200, '/api/app', signed('/api/app'));
  const settingsPath = '/api/settings?accion=leer';
  const writeSettings = '/api/settings?accion=guardar&revision=0';
  const settings = JSON.stringify({ look: { size: 96 }, theme: 'dark', studio: true });
  await expect(401, settingsPath, { method: 'POST' });
  assert.equal((await expect(200, settingsPath, signed(settingsPath))).headers.etag, '"0"');
  await expect(200, writeSettings, signed(writeSettings, settings));
  await expect(409, writeSettings, signed(writeSettings, '{}'));
  assert.equal((await expect(200, settingsPath, signed(settingsPath))).text, settings);
  const live = JSON.stringify({ slide: { text: 'Control remoto de prueba' }, blank: false });
  const update = signed('/api/live', live);
  await expect(204, '/api/live', update);
  await expect(401, '/api/live', update); // No se pueden repetir órdenes capturadas.
  await expect(401, '/api/live', { ...signed('/api/live', live), body: '{}' });
  const projected = await expect(200, '/api/live?rev=-1', { remote: false });
  assert.equal(JSON.parse(projected.text).state.slide.text, 'Control remoto de prueba');
  await expect(200, `/api/live?rev=-1&k=${viewer}`);
  await expect(403, `/api/live?rev=-1&k=${hex(16)}`);
  await expect(204, '/api/media?id=prueba', signed('/api/media?id=prueba', 'media', { 'Content-Type': 'image/png' }));
  await expect(403, '/api/media?id=prueba');
  await expect(200, `/api/media?id=prueba&k=${viewer}`);
  await expect(200, '/api/live?rev=-1', { remote: false });
  // Una IP de la LAN no puede declararse túnel local mediante cabeceras.
  const cgi = spawnSync('sh', ['-c', '. "$1"; check_host', 'test', join(app, 'server/lib.sh')], {
    env: { ...process.env, EASYBIBLIA_STATE: run, BIBLIA_CONF: conf,
      BIBLIA_REMOTE_HOST: new URL(origin).host, BIBLIA_REMOTE_ORIGIN: origin, HTTP_HOST: new URL(origin).host,
      HTTP_X_FORWARDED_PROTO: 'https', REMOTE_ADDR: '192.168.1.20' }, encoding: 'utf8',
  });
  assert.match(cgi.stdout, /403 Forbidden/); checks++;
  // El bloqueo por PIN equivocado sigue activo.
  for (let i = 0; i < 5; i++) {
    await expect(401, '/api/auth?accion=entrar', { method: 'POST', body: JSON.stringify({ verifier: hex(32), pub }) });
  }
  await expect(429, '/api/auth?accion=entrar', { method: 'POST', body: JSON.stringify({ verifier, pub }) });
  await stop();

  await start('internet');
  const access = /#acceso=([0-9a-f]{64})/.exec(output)?.[1];
  assert.ok(access);
  const invite = { 'X-Biblia-Access': access };
  await expect(403, '/datos-de-prueba.json');
  await expect(200, '/datos-de-prueba.json', { remote: false });
  await expect(403, '/api/auth?accion=estado');
  await expect(403, '/api/auth?accion=estado', { headers: { 'X-Biblia-Access': hex(32) } });
  await expect(200, '/api/auth?accion=estado', { headers: invite });
  await expect(403, '/api/auth?accion=crear', { method: 'POST', headers: invite });
  await expect(403, '/api/media?id=prueba', { method: 'POST', body: 'media' });
  await expect(200, '/api/auth?accion=entrar', { method: 'POST', body: JSON.stringify({ verifier, pub }), headers: invite });
  await expect(403, '/api/app', signed('/api/app'));
  await expect(200, '/api/app', signed('/api/app', '', invite));
  const closeInternet = '/api/auth?accion=cerrarinternet';
  await expect(403, closeInternet, signed(closeInternet, '', invite));
  const snapshot = await expect(200, settingsPath, signed(settingsPath, '', invite));
  assert.equal(snapshot.text, settings);
  assert.equal(snapshot.headers.etag, `"${hash(settings)}"`);
  const checkPath = '/api/auth?accion=comprobar';
  const localSession = await expect(200, checkPath, { ...signed(checkPath, '', { Origin: `http://localhost:${port}` }), remote: false });
  assert.deepEqual(JSON.parse(localSession.text).panelUrls, [`${tunnelOrigin}/#acceso=${access}`]);
  await stop();
  assert.equal(await readFile(stopped, 'utf8'), 'cerrado');

  await start('local');
  origin = tunnelOrigin;
  const localOrigin = { Origin: `http://localhost:${port}` };
  const localSigned = path => ({ ...signed(path, '', localOrigin), remote: false });
  const waitSharing = async () => {
    const path = '/api/auth?accion=compartir';
    for (let i = 0; i < 40; i++) {
      const result = JSON.parse((await request(path, localSigned(path))).text);
      if (!result.pending) { assert.equal(result.ok, true); return; }
      await delay(100);
    }
    throw new Error('No se completó el cambio de acceso.');
  };
  const openInternet = '/api/auth?accion=abririnternet';
  await expect(401, openInternet, { remote: false, method: 'POST', headers: localOrigin });
  await expect(200, '/api/auth?accion=entrar', { remote: false, method: 'POST',
    headers: localOrigin, body: JSON.stringify({ verifier, pub }) });
  await expect(202, openInternet, localSigned(openInternet));
  await waitSharing();
  await expect(200, '/');
  await expect(202, closeInternet, localSigned(closeInternet));
  await waitSharing();
  await expect(403, '/');
  await expect(200, '/', { remote: false });
  console.log(`OK: ${checks} comprobaciones de acceso por internet, PIN, ajustes, visor y modo local.`);
} finally {
  await stop();
  await rm(temp, { recursive: true, force: true });
}
