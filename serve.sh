#!/usr/bin/env bash
#
# Biblia — servidor local para macOS y Linux. No instala nada: usa el servidor Apache del sistema
# (macOS lo trae de serie) y openssl, también del sistema. Ver ./serve.sh --ayuda
#
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-3737}"
# Minutos sin usar la consola tras los que se vuelve a pedir el PIN (720 = 12 horas).
SESSION_MIN="${BIBLIA_SESION_MIN:-720}"
BIND="127.0.0.1"
RED=0
RESET_PIN=0
RESET_ALL=0

ayuda() {
  cat <<'TXT'
Biblia — servidor local

USO
  ./serve.sh [opciones] [puerto]

OPCIONES
  (sin nada)            Abre la app en http://localhost:3737, solo en este equipo.
  4000                  Usa otro puerto (entre 1024 y 65535).
  --red                 Deja que otro equipo de la red vea la salida para OBS.
                        Desde la red solo se puede VER (con la llave de visor que se
                        muestra al arrancar); el control sigue siendo solo de este equipo.
  --restablecer-pin     Borra el PIN si lo olvidaste. Al abrir la app pedirá uno nuevo.
  --reiniciar           Deja todo como recién instalado: borra el PIN, el nombre de la
                        iglesia y la llave de visor, y la próxima vez que se abra la app
                        borra también lo guardado en el navegador (canciones, presentaciones,
                        imágenes, apariencia…). Pide confirmación.
  --no-abrir            No abre el navegador al arrancar.
  -h, --ayuda, --help   Muestra esta ayuda.

SEGURIDAD
  · Por defecto el servidor solo escucha en este equipo: un escaneo de la red no lo ve.
  · La consola no se entrega sin PIN: antes de entrar solo existe la portada.
  · La consola pide un PIN cada vez que se enciende el servidor o tras 12 horas sin
    usarla (otro tiempo: BIBLIA_SESION_MIN=30 ./serve.sh para 30 minutos).
    Si la sesión se cierra, lo que está en vivo sigue en pantalla y en OBS; al volver a
    entrar, todo continúa. El PIN no viaja ni se guarda tal cual: el navegador lo deriva
    (PBKDF2) y aquí solo queda un resumen.
  · Cada orden lleva la firma de la llave de este navegador (ECDSA P-256, no se puede
    exportar ni copiar). Una petición capturada no sirve para repetirla ni para cambiarla.
  · Tras 5 PIN equivocados hay que esperar, cada vez más.

DETENER
  Ctrl+C en esta ventana.
TXT
}

for arg in "$@"; do
  case "$arg" in
    -h|--ayuda|--help|ayuda) ayuda; exit 0 ;;
    --red) BIND="0.0.0.0"; RED=1 ;;
    --restablecer-pin) RESET_PIN=1 ;;
    --reiniciar|--reset|--borrar-todo) RESET_ALL=1 ;;
    --no-abrir) NO_ABRIR=1 ;;
    ''|*[!0-9]*) echo "Opción desconocida: $arg"; echo "Usa ./serve.sh --ayuda para ver las opciones."; exit 1 ;;
    *) PORT="$arg" ;;
  esac
done

if ! [[ "$SESSION_MIN" =~ ^[0-9]+$ ]] || [ "$SESSION_MIN" -lt 1 ]; then
  echo "BIBLIA_SESION_MIN debe ser un número de minutos (1 o más)."
  exit 1
fi

if ! [[ "$PORT" =~ ^[0-9]+$ ]] || [ "$PORT" -lt 1024 ] || [ "$PORT" -gt 65535 ]; then
  echo "Puerto inválido: $PORT (usa uno entre 1024 y 65535)"
  exit 1
fi

# Configuración privada (PIN y llave de visor): fuera de la carpeta que se sirve.
case "$(uname -s)" in
  Darwin) CONF="$HOME/Library/Application Support/Biblia" ;;
  *) CONF="${XDG_CONFIG_HOME:-$HOME/.config}/biblia" ;;
esac
CONF="${BIBLIA_CONF_DIR:-$CONF}"
mkdir -p "$CONF"
chmod 700 "$CONF"

if [ "$RESET_ALL" = 1 ]; then
  echo "Esto deja la app como recién instalada:"
  echo "  · se borran el PIN, el nombre de la iglesia y la llave de visor de OBS;"
  echo "  · la próxima vez que se abra la app en este equipo se borrará también lo guardado"
  echo "    en el navegador: canciones, carpetas, presentaciones, imágenes, videos y apariencia."
  printf 'Para confirmar escribe BORRAR: '
  read -r ok
  if [ "$ok" = "BORRAR" ]; then
    rm -rf "$CONF"
    echo "Hecho. Arranca con ./serve.sh y la app empezará desde cero."
  else
    echo "No se borró nada."
  fi
  exit 0
fi

if [ "$RESET_PIN" = 1 ]; then
  if [ ! -f "$CONF/pin" ]; then echo "No hay ningún PIN guardado."; exit 0; fi
  printf '¿Seguro que quieres borrar el PIN? La próxima vez que abras la app tendrás que crear otro. (s/N) '
  read -r ok
  case "$ok" in s|S|si|sí|SI|Sí) rm -f "$CONF/pin"; echo "PIN borrado." ;; *) echo "No se borró nada." ;; esac
  exit 0
fi

# Apache del sistema: macOS, Debian/Ubuntu o Fedora.
HTTPD="${HTTPD:-}"; MODS="${APACHE_MODULES:-}"; MIME=""
for cand in "/usr/sbin/httpd|/usr/libexec/apache2|/private/etc/apache2/mime.types" \
            "/usr/sbin/apache2|/usr/lib/apache2/modules|/etc/mime.types" \
            "/usr/sbin/httpd|/usr/lib64/httpd/modules|/etc/mime.types" \
            "/usr/sbin/httpd|/usr/lib/httpd/modules|/etc/mime.types"; do
  IFS='|' read -r h m t <<< "$cand"
  if [ -x "${HTTPD:-$h}" ] && [ -f "${MODS:-$m}/mod_cgi.so" ]; then HTTPD="${HTTPD:-$h}"; MODS="${MODS:-$m}"; MIME="$t"; break; fi
done
if [ -z "$HTTPD" ] || [ -z "$MODS" ]; then
  echo "No encontré el servidor Apache del sistema."
  echo "  · En macOS viene de serie."
  echo "  · En Linux instálalo una vez: sudo apt install apache2   (o: sudo dnf install httpd)"
  echo "  · En Windows usa: iniciar-windows.cmd"
  exit 1
fi
OPENSSL="/usr/bin/openssl"
[ -x "$OPENSSL" ] || OPENSSL="$(command -v openssl || true)"
if [ -z "$OPENSSL" ]; then echo "Falta openssl en el sistema."; exit 1; fi

if command -v lsof >/dev/null && lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "El puerto $PORT ya está en uso. Prueba con otro: ./serve.sh $((PORT + 1))"
  exit 1
fi

[ -s "$CONF/viewer.key" ] || "$OPENSSL" rand -hex 16 > "$CONF/viewer.key"
chmod 600 "$CONF/viewer.key"
# Identifica esta instalación: si cambia (tras --reiniciar), la app borra lo guardado en el navegador.
[ -s "$CONF/install.id" ] || "$OPENSSL" rand -hex 16 > "$CONF/install.id"
rm -rf "$CONF/.crear"
VIEWER="$(cat "$CONF/viewer.key")"

RUN="$(mktemp -d "${TMPDIR:-/tmp}/biblia.XXXXXX")"
chmod 700 "$RUN"
chmod +x "$DIR/server/"*.cgi

stop() {
  if [ -f "$RUN/httpd.pid" ]; then kill "$(cat "$RUN/httpd.pid")" 2>/dev/null || true; fi
  rm -rf "$RUN"
}
trap stop EXIT
trap 'exit 0' INT TERM

LAN_IP=""
if [ "$RED" = 1 ]; then
  LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || true)"
fi
HOSTS="localhost|127\\.0\\.0\\.1|\\[::1\\]"
[ -n "$LAN_IP" ] && HOSTS="$HOSTS|${LAN_IP//./\\.}"

load() { [ -f "$MODS/$2" ] && echo "LoadModule $1 $MODS/$2"; return 0; }

{
cat <<EOF
ServerRoot "$RUN"
ServerName localhost
Listen ${BIND}:${PORT}
PidFile "$RUN/httpd.pid"
ErrorLog "$RUN/error.log"
LogLevel warn
ServerTokens Prod
ServerSignature Off
TraceEnable Off
EOF
load mpm_prefork_module mod_mpm_prefork.so
load unixd_module mod_unixd.so
load authz_core_module mod_authz_core.so
load mime_module mod_mime.so
load dir_module mod_dir.so
load alias_module mod_alias.so
load cgi_module mod_cgi.so
load env_module mod_env.so
load headers_module mod_headers.so
cat <<EOF

# Pocos procesos: pensado para equipos modestos (4 GB de RAM).
StartServers 2
MinSpareServers 2
MaxSpareServers 4
MaxRequestWorkers 16
Timeout 60
KeepAliveTimeout 5
LimitRequestBody 1048576
LimitRequestFields 40
LimitRequestFieldSize 4096

TypesConfig "$MIME"
AddType application/javascript .js
AddType application/json .json
AddType image/svg+xml .svg
AddCharset utf-8 .html .css .js .json

DocumentRoot "$DIR"
DirectoryIndex index.html
SetEnv EASYBIBLIA_STATE "$RUN"
SetEnv BIBLIA_CONF "$CONF"
SetEnv BIBLIA_OPENSSL "$OPENSSL"
SetEnv BIBLIA_LAN_HOST "$LAN_IP"
SetEnv BIBLIA_SESSION_MIN "$SESSION_MIN"
ScriptAlias /api/live "$DIR/server/live.cgi"
ScriptAlias /api/media "$DIR/server/media.cgi"
ScriptAlias /api/auth "$DIR/server/auth.cgi"
ScriptAlias /api/app "$DIR/server/app.cgi"
SetEnv BIBLIA_APP_DIR "$DIR"

<Location "/api/media">
  LimitRequestBody 1073741824
</Location>

<Directory />
  Require all denied
  AllowOverride None
</Directory>
<Directory "$DIR">
  Options -Indexes -FollowSymLinks
  AllowOverride None
  Require all granted
  # Solo se responde si se pide por el nombre de este equipo (frena el «DNS rebinding»).
  <If "! %{HTTP_HOST} =~ m#^($HOSTS):${PORT}\$#">
    Require all denied
  </If>
</Directory>
<Directory "$DIR/server">
  Options +ExecCGI
  Require all granted
</Directory>
# Nada interno se sirve: scripts, configuración, notas ni archivos ocultos.
# La consola (console.html) solo se entrega con sesión, por /api/app.
<LocationMatch "^/(server|\\.[^/]*)(/|\$)|\\.(sh|ps1|cmd|md|bak|log)\$|^/console\\.html\$">
  Require all denied
</LocationMatch>

Header always set X-Content-Type-Options "nosniff"
Header always set X-Frame-Options "DENY"
Header always set Referrer-Policy "no-referrer"
Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), usb=(), payment=()"
Header always set Cross-Origin-Opener-Policy "same-origin"
Header always set Cross-Origin-Resource-Policy "same-origin"
Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' data: blob:; connect-src 'self' https://itunes.apple.com https://lrclib.net https://raw.githubusercontent.com; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
Header set Cache-Control "no-cache"
EOF
} > "$RUN/httpd.conf"

"$HTTPD" -f "$RUN/httpd.conf" -DFOREGROUND &
SERVER=$!
sleep 1
if ! kill -0 "$SERVER" 2>/dev/null; then
  echo "El servidor no pudo arrancar:"
  cat "$RUN/error.log" 2>/dev/null || true
  exit 1
fi

URL="http://localhost:$PORT"
echo "=============================================="
echo "  Biblia · by @jairohm.dev"
echo "=============================================="
echo "  App       : $URL"
echo "  OBS       : $URL/?salida&obs"
echo "  OBS (solo texto, fondo transparente):"
echo "              $URL/?salida&obs&transparente"
if [ "$RED" = 1 ] && [ -n "$LAN_IP" ]; then
  echo "  OBS en otro equipo de la red (solo ver):"
  echo "              http://$LAN_IP:$PORT/?salida&obs&k=$VIEWER"
fi
echo "  Sesión    : se pide el PIN tras $SESSION_MIN min sin usar la consola ($((SESSION_MIN / 60)) h $((SESSION_MIN % 60)) min)"
echo "  Ayuda     : ./serve.sh --ayuda"
echo "  Detener   : Ctrl+C"
echo "=============================================="

if [ -z "${NO_ABRIR:-}" ]; then
  if command -v open >/dev/null; then open "$URL" 2>/dev/null || true
  elif command -v xdg-open >/dev/null; then xdg-open "$URL" >/dev/null 2>&1 || true; fi
fi
wait "$SERVER"
