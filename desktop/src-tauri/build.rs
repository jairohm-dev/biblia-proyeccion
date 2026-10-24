// Copia la app web (la misma que sirven serve.sh y serve.ps1) a ../dist, que Tauri incluye dentro del
// ejecutable. Así hay una sola app: cualquier cambio en index.html, app.js… entra en la próxima compilación.
use std::{fs, path::Path};

const FILES: &[&str] = &[
    "index.html", "console.html", "app.js", "auth.js", "studio.js", "styles.css", "icon.svg",
    "bible_rvr1960.json", "himnarios.json",
];

fn main() {
    let root = Path::new("../..");
    let dist = Path::new("../dist");
    fs::create_dir_all(dist).expect("no se pudo crear desktop/dist");
    for file in FILES {
        let src = root.join(file);
        println!("cargo:rerun-if-changed={}", src.display());
        fs::copy(&src, dist.join(file)).unwrap_or_else(|e| panic!("no se pudo copiar {file}: {e}"));
    }
    tauri_build::build();
}
