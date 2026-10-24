# Cómo contribuir a Biblia

¡Gracias por querer ayudar! Biblia es para iglesias de todo tamaño, muchas con equipos modestos y
sin personal técnico. Ten eso en mente en cada cambio.

## Principios

1. **Ligera.** Debe ir fluida en una laptop de 4 GB de RAM. Nada de frameworks ni dependencias pesadas.
2. **Sin instalar nada.** La versión web solo usa lo que trae el sistema: ni Node, ni Python, ni npm.
3. **Segura por defecto.** La red de una iglesia suele ser pública. No debilites el PIN, las firmas
   ECC, las comprobaciones de `Host`/`Origin` ni la entrega de la consola solo tras entrar.
4. **Fácil para cualquiera.** Textos claros en español, sin jerga técnica en la interfaz.
5. **Las tres versiones por igual.** Si cambias el servidor, cámbialo en `server/*.cgi` (macOS/Linux),
   en `serve.ps1` (Windows) y en `desktop/src-tauri/src/main.rs` (escritorio).

## Empezar

```bash
git clone https://github.com/jairohm-dev/biblia-proyeccion.git
cd biblia-proyeccion
BIBLIA_CONF_DIR=/tmp/biblia-dev ./serve.sh 3838   # PIN y datos de prueba aparte de los tuyos
```

Edita los archivos y recarga el navegador: no hay paso de compilación. Para la app de escritorio:
`cd desktop/src-tauri && cargo tauri dev`.

## Proceso

1. Abre un *issue* para hablar de cambios grandes antes de hacerlos.
2. Crea una rama (`git checkout -b mejora/lo-que-sea`).
3. Prueba en vivo: consola + proyector + OBS (`?salida&obs`), tema claro y oscuro, y pantalla pequeña.
4. Abre un *pull request* que explique qué cambia y por qué; si toca la interfaz, añade capturas.

## Estilo del código

- JavaScript moderno sin dependencias; sigue el estilo del archivo que tocas.
- Comentarios breves y en español, que expliquen el *porqué*.
- En CSS, usa las variables de color ya definidas para que funcionen los temas claro y oscuro.
- `serve.ps1` debe guardarse en UTF-8 con BOM y saltos de línea CRLF.

## Seguridad

Si encuentras una vulnerabilidad, **no abras un issue público**: escríbeme por
[jairohm.dev](https://jairohm.dev) y lo resolvemos antes de publicarlo.

## Contenido

- Himnos y Biblias: solo textos de **dominio público** o con permiso explícito para redistribuirlos.
- Nunca subas PIN, llaves, carpetas `conf*/` ni datos de una iglesia.
