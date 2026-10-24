// Biblia de escritorio: la consola y el proyector en ventanas propias, sin navegador ni servidor.
// El servidor local solo existe mientras se transmite a OBS (ver obs.rs) y únicamente deja VER.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod obs;

use serde::Serialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    fs,
    path::PathBuf,
    sync::{Arc, Condvar, Mutex},
    time::{Duration, Instant},
};
use tauri::{
    ipc::{InvokeBody, Request},
    AppHandle, Emitter, Manager, Position, Size, State, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};

/// Lo que está en vivo: lo escribe la consola y lo leen el proyector (por eventos) y OBS (por obs.rs).
pub struct Live {
    pub json: String,
    pub rev: u64,
}

pub struct Shared {
    pub live: Mutex<Live>,
    pub changed: Condvar,
    /// Imágenes y videos para OBS: id → (archivo temporal, tipo).
    pub media: Mutex<HashMap<String, (PathBuf, String)>>,
    pub media_dir: PathBuf,
}

struct Session {
    unlocked: bool,
    last_use: Instant,
    fails: u32,
    wait_until: Option<Instant>,
}

struct AppState {
    shared: Arc<Shared>,
    session: Mutex<Session>,
    obs: Mutex<Option<obs::Server>>,
    session_minutes: u64,
}

const MEDIA_TYPES: &[&str] = &[
    "image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "video/mp4", "video/webm",
    "video/quicktime", "video/ogg", "audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/wav",
    "audio/x-wav", "audio/ogg", "audio/webm", "audio/flac",
];

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}
fn sha256_hex(s: &str) -> String {
    hex(&Sha256::digest(s.as_bytes()))
}
fn random_hex(n: usize) -> String {
    let mut b = vec![0u8; n];
    getrandom::getrandom(&mut b).expect("sin números aleatorios del sistema");
    hex(&b)
}
fn is_hex(s: &str, len: usize) -> bool {
    s.len() == len && s.bytes().all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
}
/// El nombre de la iglesia llega en base64url (UTF-8), como en la versión web.
fn is_name(s: &str) -> bool {
    !s.is_empty() && s.len() <= 160 && s.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_')
}

/// Configuración privada (PIN, nombre, llaves): la carpeta de la app del sistema, nunca la del programa.
fn conf_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}
fn read_conf(app: &AppHandle, name: &str) -> String {
    conf_dir(app).ok().and_then(|d| fs::read_to_string(d.join(name)).ok()).unwrap_or_default().trim().to_string()
}
fn write_conf(app: &AppHandle, name: &str, value: &str) -> Result<(), String> {
    let dir = conf_dir(app)?;
    let tmp = dir.join(format!("{name}.tmp"));
    fs::write(&tmp, value).map_err(|e| e.to_string())?;
    fs::rename(tmp, dir.join(name)).map_err(|e| e.to_string())
}
fn ensure_id(app: &AppHandle, name: &str) -> String {
    let v = read_conf(app, name);
    if is_hex(&v, 32) {
        return v;
    }
    let v = random_hex(16);
    let _ = write_conf(app, name, &v);
    v
}
fn stored_pin(app: &AppHandle) -> Option<(String, String)> {
    let v = read_conf(app, "pin");
    let mut it = v.split(' ');
    match (it.next(), it.next()) {
        (Some(s), Some(h)) if is_hex(s, 32) && is_hex(h, 64) => Some((s.to_string(), h.to_string())),
        _ => None,
    }
}

impl AppState {
    fn expired(&self, s: &Session) -> bool {
        s.last_use.elapsed() > Duration::from_secs(self.session_minutes * 60)
    }
    /// ¿Sigue abierta la sesión? No la renueva (lo usa la comprobación periódica de la consola).
    fn active(&self) -> bool {
        let mut s = self.session.lock().unwrap();
        if s.unlocked && self.expired(&s) {
            s.unlocked = false;
        }
        s.unlocked
    }
    /// Uso real de la consola: exige sesión y la renueva.
    fn use_session(&self) -> Result<(), String> {
        let mut s = self.session.lock().unwrap();
        if !s.unlocked || self.expired(&s) {
            s.unlocked = false;
            return Err("sesion".into());
        }
        s.last_use = Instant::now();
        Ok(())
    }
    fn unlock(&self) {
        let mut s = self.session.lock().unwrap();
        s.unlocked = true;
        s.last_use = Instant::now();
        s.fails = 0;
        s.wait_until = None;
    }
    fn wait_left(&self) -> u64 {
        let s = self.session.lock().unwrap();
        s.wait_until.map(|t| t.saturating_duration_since(Instant::now()).as_secs()).unwrap_or(0)
    }
    /// Tras 5 PIN equivocados hay que esperar: 30 s y el doble cada vez, hasta 15 min.
    fn note_failure(&self) {
        let mut s = self.session.lock().unwrap();
        s.fails += 1;
        if s.fails >= 5 {
            let secs = (30u64 << (s.fails - 5).min(5)).min(900);
            s.wait_until = Some(Instant::now() + Duration::from_secs(secs));
        }
    }
}

/* ───────────── PIN y sesión ───────────── */

#[tauri::command]
fn auth_status(app: AppHandle) -> Value {
    let install = ensure_id(&app, "install.id");
    match stored_pin(&app) {
        Some((salt, _)) => json!({ "configured": true, "salt": salt, "name": read_conf(&app, "iglesia"), "install": install }),
        None => json!({ "configured": false, "install": install }),
    }
}

#[tauri::command]
fn auth_create(app: AppHandle, state: State<'_, AppState>, salt: String, verifier: String, name: String) -> Value {
    if stored_pin(&app).is_some() {
        return json!({ "status": 409 });
    }
    if !is_hex(&salt, 32) || !is_hex(&verifier, 64) || (!name.is_empty() && !is_name(&name)) {
        return json!({ "status": 400 });
    }
    if write_conf(&app, "pin", &format!("{salt} {}", sha256_hex(&verifier))).is_err() {
        return json!({ "status": 500 });
    }
    if !name.is_empty() {
        let _ = write_conf(&app, "iglesia", &name);
    }
    state.unlock();
    json!({ "status": 200 })
}

#[tauri::command]
fn auth_login(app: AppHandle, state: State<'_, AppState>, verifier: String) -> Value {
    let Some((_, hash)) = stored_pin(&app) else { return json!({ "status": 409 }) };
    let left = state.wait_left();
    if left > 0 {
        return json!({ "status": 429, "wait": left });
    }
    if !is_hex(&verifier, 64) || sha256_hex(&verifier) != hash {
        state.note_failure();
        return json!({ "status": 401, "wait": state.wait_left() });
    }
    state.unlock();
    json!({ "status": 200 })
}

#[tauri::command]
fn auth_check(state: State<'_, AppState>, keep: Option<bool>) -> bool {
    // Mientras se está en vivo, la consola la renueva: no caduca por no tocar nada durante la predicación.
    if keep.unwrap_or(false) {
        return state.use_session().is_ok();
    }
    state.active()
}

#[tauri::command]
fn auth_lock(state: State<'_, AppState>) {
    state.session.lock().unwrap().unlocked = false;
}

#[tauri::command]
fn auth_change(app: AppHandle, state: State<'_, AppState>, current: String, salt: String, verifier: String) -> Value {
    if state.use_session().is_err() {
        return json!({ "status": 401, "error": "sesion" });
    }
    let Some((_, hash)) = stored_pin(&app) else { return json!({ "status": 409 }) };
    if !is_hex(&current, 64) || !is_hex(&salt, 32) || !is_hex(&verifier, 64) {
        return json!({ "status": 400 });
    }
    let left = state.wait_left();
    if left > 0 {
        return json!({ "status": 429, "wait": left });
    }
    if sha256_hex(&current) != hash {
        state.note_failure();
        return json!({ "status": 401, "wait": state.wait_left() });
    }
    match write_conf(&app, "pin", &format!("{salt} {}", sha256_hex(&verifier))) {
        Ok(()) => json!({ "status": 200 }),
        Err(_) => json!({ "status": 500 }),
    }
}

#[tauri::command]
fn auth_name(app: AppHandle, state: State<'_, AppState>, name: String) -> Result<(), String> {
    state.use_session()?;
    if !is_name(&name) {
        return Err("nombre".into());
    }
    write_conf(&app, "iglesia", &name)
}

/// «Empezar de cero»: con el PIN actual, borra el PIN, el nombre y las llaves. La consola borra luego
/// lo guardado en su almacenamiento y vuelve al registro.
#[tauri::command]
fn app_reset(app: AppHandle, state: State<'_, AppState>, current: String) -> Value {
    if state.use_session().is_err() {
        return json!({ "status": 401, "error": "sesion" });
    }
    let Some((_, hash)) = stored_pin(&app) else { return json!({ "status": 409 }) };
    if !is_hex(&current, 64) || sha256_hex(&current) != hash {
        state.note_failure();
        return json!({ "status": 401, "wait": state.wait_left() });
    }
    if let Ok(dir) = conf_dir(&app) {
        for f in ["pin", "iglesia", "viewer.key", "install.id"] {
            let _ = fs::remove_file(dir.join(f));
        }
    }
    if let Some(s) = state.obs.lock().unwrap().take() {
        s.stop();
    }
    state.session.lock().unwrap().unlocked = false;
    json!({ "status": 200 })
}

/// «¿Olvidaste el PIN?» en el ejecutable (no hay terminal): empezar de cero sin PIN. Borra la
/// configuración; la consola borra después todo lo guardado y vuelve al registro. Quien tenga el equipo
/// delante podría borrar igual la carpeta de la app; desde la red no se puede hacer nada de esto.
#[tauri::command]
fn app_forget(app: AppHandle, state: State<'_, AppState>) {
    if let Ok(dir) = conf_dir(&app) {
        for f in ["pin", "iglesia", "viewer.key", "install.id"] {
            let _ = fs::remove_file(dir.join(f));
        }
    }
    if let Some(s) = state.obs.lock().unwrap().take() {
        s.stop();
    }
    let mut s = state.session.lock().unwrap();
    s.unlocked = false;
    s.fails = 0;
    s.wait_until = None;
}

/* ───────────── En vivo ───────────── */

#[tauri::command]
fn set_live(app: AppHandle, state: State<'_, AppState>, live: String) -> Result<(), String> {
    state.use_session()?;
    if live.len() > 262_144 || serde_json::from_str::<Value>(&live).is_err() {
        return Err("estado".into());
    }
    {
        let mut l = state.shared.live.lock().unwrap();
        l.json = live.clone();
        l.rev += 1;
    }
    state.shared.changed.notify_all();
    let _ = app.emit_to("proyector", "live", live);
    Ok(())
}

#[tauri::command]
fn get_live(state: State<'_, AppState>) -> String {
    state.shared.live.lock().unwrap().json.clone()
}

/* ───────────── Pantallas y proyector ───────────── */

#[derive(Serialize)]
struct MonitorInfo {
    name: String,
    width: u32,
    height: u32,
    primary: bool,
}

fn console_window(app: &AppHandle) -> Result<tauri::WebviewWindow, String> {
    app.get_webview_window("consola").ok_or_else(|| "sin consola".to_string())
}

#[tauri::command]
fn list_monitors(app: AppHandle) -> Result<Vec<MonitorInfo>, String> {
    let w = console_window(&app)?;
    let primary = w.primary_monitor().map_err(|e| e.to_string())?.map(|m| (m.position().x, m.position().y));
    let list = w.available_monitors().map_err(|e| e.to_string())?;
    Ok(list
        .iter()
        .enumerate()
        .map(|(i, m)| MonitorInfo {
            name: m.name().cloned().unwrap_or_else(|| format!("Pantalla {}", i + 1)),
            width: m.size().width,
            height: m.size().height,
            primary: Some((m.position().x, m.position().y)) == primary,
        })
        .collect())
}

/// Abre (o mueve) la ventana del proyector a la pantalla elegida, a pantalla completa. Con una sola
/// pantalla se abre como ventana normal, para no tapar la consola.
#[tauri::command]
fn open_projector(app: AppHandle, monitor: Option<usize>) -> Result<(), String> {
    let console = console_window(&app)?;
    let monitors = console.available_monitors().map_err(|e| e.to_string())?;
    let primary = console.primary_monitor().map_err(|e| e.to_string())?.map(|m| (m.position().x, m.position().y));
    let target = match monitor {
        Some(i) => monitors.get(i),
        None => monitors.iter().find(|m| Some((m.position().x, m.position().y)) != primary).or(monitors.first()),
    }
    .ok_or_else(|| "sin pantallas".to_string())?;
    let fullscreen = monitors.len() > 1 || monitor.is_some();

    let win = match app.get_webview_window("proyector") {
        Some(w) => w,
        None => WebviewWindowBuilder::new(&app, "proyector", WebviewUrl::App("index.html".into()))
            .title("Biblia · Proyector")
            .inner_size(1280.0, 720.0)
            .decorations(!fullscreen)
            .visible(false)
            .background_color(tauri::window::Color(0, 0, 0, 255))
            .initialization_script("window.__BIBLIA_SALIDA__ = true;")
            .build()
            .map_err(|e| e.to_string())?,
    };
    let _ = win.set_fullscreen(false);
    if fullscreen {
        let _ = win.set_decorations(false);
        win.set_position(Position::Physical(*target.position())).map_err(|e| e.to_string())?;
        win.set_size(Size::Physical(*target.size())).map_err(|e| e.to_string())?;
    } else {
        let _ = win.center();
    }
    win.show().map_err(|e| e.to_string())?;
    if fullscreen {
        win.set_fullscreen(true).map_err(|e| e.to_string())?;
    }
    let _ = win.set_focus();
    let _ = app.emit("proyector", true);
    Ok(())
}

#[tauri::command]
fn close_projector(app: AppHandle) {
    if let Some(w) = app.get_webview_window("proyector") {
        let _ = w.close();
    }
}

#[tauri::command]
fn projector_open(app: AppHandle) -> bool {
    app.get_webview_window("proyector").is_some()
}

/* ───────────── OBS (el único momento con servidor local) ───────────── */

#[tauri::command]
fn obs_start(app: AppHandle, state: State<'_, AppState>, lan: bool) -> Result<Value, String> {
    state.use_session()?;
    let mut guard = state.obs.lock().unwrap();
    if let Some(s) = guard.as_ref() {
        if s.lan != lan {
            guard.take().unwrap().stop();
        }
    }
    if guard.is_none() {
        let viewer = ensure_id(&app, "viewer.key");
        *guard = Some(obs::Server::start(app.clone(), state.shared.clone(), lan, viewer, 3737)?);
    }
    let s = guard.as_ref().unwrap();
    Ok(json!({ "url": format!("http://localhost:{}", s.port), "lan": s.lan_url, "viewer": s.viewer }))
}

#[tauri::command]
fn obs_stop(state: State<'_, AppState>) {
    if let Some(s) = state.obs.lock().unwrap().take() {
        s.stop();
    }
}

#[tauri::command]
fn obs_status(state: State<'_, AppState>) -> Value {
    match state.obs.lock().unwrap().as_ref() {
        Some(s) => json!({ "on": true, "url": format!("http://localhost:{}", s.port), "lan": s.lan_url, "viewer": s.viewer }),
        None => json!({ "on": false }),
    }
}

/// Recibe una imagen o un video (en bruto, sin JSON) para que OBS lo pueda mostrar.
#[tauri::command]
fn put_media(request: Request<'_>, state: State<'_, AppState>) -> Result<(), String> {
    state.use_session()?;
    let header = |k: &str| request.headers().get(k).and_then(|v| v.to_str().ok()).unwrap_or("").to_string();
    let id = header("x-media-id");
    let kind = header("x-media-type").to_lowercase();
    if id.is_empty() || id.len() > 64 || !id.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-') {
        return Err("id".into());
    }
    if !MEDIA_TYPES.contains(&kind.as_str()) {
        return Err("tipo".into());
    }
    let InvokeBody::Raw(data) = request.body() else { return Err("cuerpo".into()) };
    let path = state.shared.media_dir.join(&id);
    fs::write(&path, data).map_err(|e| e.to_string())?;
    state.shared.media.lock().unwrap().insert(id, (path, kind));
    Ok(())
}

fn main() {
    let session_minutes = std::env::var("BIBLIA_SESION_MIN").ok().and_then(|v| v.parse::<u64>().ok()).filter(|m| *m >= 1).unwrap_or(720);
    let media_dir = std::env::temp_dir().join(format!("biblia-{}", random_hex(6)));
    let _ = fs::create_dir_all(&media_dir);
    let shared = Arc::new(Shared {
        live: Mutex::new(Live { json: "null".into(), rev: 0 }),
        changed: Condvar::new(),
        media: Mutex::new(HashMap::new()),
        media_dir: media_dir.clone(),
    });
    let state = AppState {
        shared,
        session: Mutex::new(Session { unlocked: false, last_use: Instant::now(), fails: 0, wait_until: None }),
        obs: Mutex::new(None),
        session_minutes,
    };

    tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            auth_status, auth_create, auth_login, auth_check, auth_lock, auth_change, auth_name, app_reset, app_forget,
            set_live, get_live, list_monitors, open_projector, close_projector, projector_open,
            obs_start, obs_stop, obs_status, put_media
        ])
        .on_window_event(|window, event| match (window.label(), event) {
            ("proyector", WindowEvent::Destroyed) => {
                let _ = window.app_handle().emit("proyector", false);
            }
            // Al cerrar la consola se cierra también el proyector: la app termina.
            ("consola", WindowEvent::CloseRequested { .. }) => {
                if let Some(p) = window.app_handle().get_webview_window("proyector") {
                    let _ = p.close();
                }
            }
            _ => {}
        })
        .build(tauri::generate_context!())
        .expect("no se pudo iniciar Biblia")
        .run(move |app, event| {
            if let tauri::RunEvent::Exit = event {
                if let Some(s) = app.state::<AppState>().obs.lock().unwrap().take() {
                    s.stop();
                }
                let _ = fs::remove_dir_all(&media_dir);
            }
        });
}
