// Servidor para OBS: solo existe mientras se transmite y solo deja VER (nada se puede cambiar desde aquí).
//   /                 la página de salida (la misma de la versión web: index.html?salida&obs)
//   /api/live?rev=N   lo que está en vivo; espera hasta 20 s a que cambie
//   /api/media?id=X   las imágenes y videos que se proyectan
// Por defecto escucha solo en este equipo; con «en la red», otros equipos necesitan la llave de visor.
use crate::Shared;
use std::{
    fs::File,
    io::Read,
    net::UdpSocket,
    sync::Arc,
    thread,
    time::{Duration, Instant},
};
use tauri::AppHandle;
use tiny_http::{Header, Method, Request, Response, Server as Http, StatusCode};

pub struct Server {
    http: Arc<Http>,
    pub port: u16,
    pub lan: bool,
    pub lan_url: Option<String>,
    pub viewer: String,
}

struct Ctx {
    app: AppHandle,
    shared: Arc<Shared>,
    viewer: String,
    hosts: Vec<String>,
}

/// Lo único que se sirve: la página de salida y lo que necesita (ni la consola ni la Biblia completa).
const FILES: &[&str] = &["index.html", "app.js", "auth.js", "studio.js", "styles.css", "icon.svg"];

const CSP: &str = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";

impl Server {
    pub fn start(app: AppHandle, shared: Arc<Shared>, lan: bool, viewer: String, first_port: u16) -> Result<Server, String> {
        let bind = if lan { "0.0.0.0" } else { "127.0.0.1" };
        let (http, port) = (first_port..first_port + 20)
            .find_map(|p| Http::http((bind, p)).ok().map(|h| (h, p)))
            .ok_or_else(|| "no hay ningún puerto libre para OBS".to_string())?;
        let http = Arc::new(http);
        let lan_ip = if lan { local_ip() } else { None };
        let mut hosts = vec![format!("localhost:{port}"), format!("127.0.0.1:{port}"), format!("[::1]:{port}")];
        if let Some(ip) = &lan_ip {
            hosts.push(format!("{ip}:{port}"));
        }
        let ctx = Arc::new(Ctx { app, shared, viewer: viewer.clone(), hosts });
        let listener = http.clone();
        thread::spawn(move || {
            for req in listener.incoming_requests() {
                let ctx = ctx.clone();
                thread::spawn(move || handle(&ctx, req));
            }
        });
        Ok(Server { http, port, lan, lan_url: lan_ip.map(|ip| format!("http://{ip}:{port}")), viewer })
    }

    pub fn stop(&self) {
        self.http.unblock();
    }
}

/// La IP de este equipo en la red (sin enviar nada: solo pregunta al sistema qué interfaz usaría).
fn local_ip() -> Option<String> {
    let s = UdpSocket::bind("0.0.0.0:0").ok()?;
    s.connect("8.8.8.8:80").ok()?;
    Some(s.local_addr().ok()?.ip().to_string())
}

fn header_value(req: &Request, name: &str) -> String {
    req.headers()
        .iter()
        .find(|h| h.field.as_str().as_str().eq_ignore_ascii_case(name))
        .map(|h| h.value.as_str().to_string())
        .unwrap_or_default()
}

fn query_param<'a>(query: &'a str, name: &str) -> Option<&'a str> {
    query.split('&').find_map(|kv| kv.split_once('=').filter(|(k, _)| *k == name).map(|(_, v)| v))
}

fn send<R: Read>(req: Request, mut res: Response<R>, code: u16, ctype: &str, extra: &[(&str, &str)]) {
    let base = [
        ("Content-Type", ctype),
        ("X-Content-Type-Options", "nosniff"),
        ("X-Frame-Options", "DENY"),
        ("Referrer-Policy", "no-referrer"),
        ("Cross-Origin-Resource-Policy", "same-origin"),
    ];
    for (k, v) in base.iter().chain(extra.iter()) {
        if let Ok(h) = Header::from_bytes(k.as_bytes(), v.as_bytes()) {
            res.add_header(h);
        }
    }
    let _ = req.respond(res.with_status_code(StatusCode(code)));
}

fn json(req: Request, code: u16, body: String) {
    send(req, Response::from_string(body), code, "application/json", &[("Cache-Control", "no-store")]);
}

fn handle(ctx: &Ctx, req: Request) {
    // Contra el «DNS rebinding»: solo se responde si se pide por el nombre de este equipo.
    if !ctx.hosts.contains(&header_value(&req, "Host")) {
        return json(req, 421, r#"{"error":"host"}"#.into());
    }
    if *req.method() != Method::Get && *req.method() != Method::Head {
        return json(req, 405, r#"{"error":"metodo"}"#.into());
    }
    let url = req.url().to_string();
    let (path, query) = url.split_once('?').unwrap_or((url.as_str(), ""));
    let loopback = req.remote_addr().map(|a| a.ip().is_loopback()).unwrap_or(false);
    let can_view = loopback || query_param(query, "k") == Some(ctx.viewer.as_str());

    match path {
        "/api/live" => {
            if !can_view {
                return json(req, 403, r#"{"error":"visor"}"#.into());
            }
            let want = query_param(query, "rev").and_then(|v| v.parse::<u64>().ok());
            let deadline = Instant::now() + Duration::from_secs(20);
            let mut live = ctx.shared.live.lock().unwrap();
            if let Some(w) = want {
                while live.rev == w {
                    let left = deadline.saturating_duration_since(Instant::now());
                    if left.is_zero() {
                        break;
                    }
                    live = ctx.shared.changed.wait_timeout(live, left).unwrap().0;
                }
            }
            let body = format!("{{\"rev\":{},\"state\":{}}}", live.rev, live.json);
            drop(live);
            json(req, 200, body);
        }
        "/api/media" => {
            if !can_view {
                return json(req, 403, r#"{"error":"visor"}"#.into());
            }
            let id = query_param(query, "id").unwrap_or("").to_string();
            let entry = ctx.shared.media.lock().unwrap().get(&id).cloned();
            match entry.and_then(|(p, t)| File::open(p).ok().map(|f| (f, t))) {
                Some((file, kind)) => send(
                    req,
                    Response::from_file(file),
                    200,
                    &kind,
                    &[("Cache-Control", "private, max-age=3600"), ("Content-Security-Policy", "sandbox; default-src 'none'")],
                ),
                None => json(req, 404, r#"{"error":"no-existe"}"#.into()),
            }
        }
        _ => {
            let name = if path == "/" { "index.html" } else { path.trim_start_matches('/') };
            if !FILES.contains(&name) {
                return json(req, 404, r#"{"error":"no-existe"}"#.into());
            }
            match ctx.app.asset_resolver().get(name.to_string()) {
                Some(asset) => {
                    let ctype = asset.mime_type.clone();
                    send(req, Response::from_data(asset.bytes), 200, &ctype, &[("Cache-Control", "no-cache"), ("Content-Security-Policy", CSP)]);
                }
                None => json(req, 404, r#"{"error":"no-existe"}"#.into()),
            }
        }
    }
}
