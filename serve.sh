#!/usr/bin/env bash
#
# Biblia — servidor para macOS y Linux. Usa Apache y OpenSSL del sistema.
#
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXED_PORT=0
[ -z "${PORT:-}" ] || FIXED_PORT=1
PORT="${PORT:-3737}"
# Minutos sin usar la consola tras los que se vuelve a pedir el PIN (720 = 12 horas).
SESSION_MIN="${BIBLIA_SESION_MIN:-720}"
REMOTE_ORIGIN="${BIBLIA_ORIGEN_REMOTO:-}"
REMOTE_HOST=""
REMOTE_ACCESS=""
TUNNEL_PID=""
BIND="127.0.0.1"
RED=0
PANEL_RED=0
INTERNET=0
MENU=0
CHANGE_PIN=0
RESET_PIN=0
RESET_ALL=0

ayuda() {
  cat <<'TXT'
Biblia — servidor local

USO
  ./serve.sh [opciones] [puerto]

OPCIONES
  (sin nada)            Muestra el menú en Terminal. Usa 3737 o el siguiente puerto disponible.
  4000                  Usa un puerto fijo (entre 1024 y 65535).
  --menu                Muestra el menú de inicio.
  --red                 Deja que otro equipo de la red vea la salida para OBS.
  --panel-red           Habilita el panel con PIN por HTTPS en la IP de este equipo.
  --internet            Crea un enlace HTTPS temporal con Cloudflare para entrar desde fuera.
  --restablecer-pin     Borra el PIN si lo olvidaste. Al abrir la app pedirá uno nuevo.
  --reiniciar           Deja todo como recién instalado: borra el PIN, el nombre de la
                        iglesia y la llave de visor, y la próxima vez que se abra la app
                        borra también lo guardado en el navegador (canciones, presentaciones,
                        imágenes, apariencia…). Pide confirmación.
  --no-abrir            No abre el navegador al arrancar.
  BIBLIA_ORIGEN_REMOTO=https://biblia.tu-dominio.com ./serve.sh
                        Autoriza ese dominio HTTPS por un túnel local. Requiere PIN
                        creado previamente.
  -h, --ayuda, --help   Muestra esta ayuda.

SEGURIDAD
  · El inicio local escucha en este equipo. El panel por IP requiere HTTPS y el PIN.
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
    --red) RED=1 ;;
    --panel-red) PANEL_RED=1; RED=1 ;;
    --internet) INTERNET=1 ;;
    --menu) MENU=1 ;;
    --restablecer-pin) RESET_PIN=1 ;;
    --reiniciar|--reset|--borrar-todo) RESET_ALL=1 ;;
    --no-abrir) NO_ABRIR=1 ;;
    ''|*[!0-9]*) echo "Opción desconocida: $arg"; echo "Usa ./serve.sh --ayuda para ver las opciones."; exit 1 ;;
    *) PORT="$arg"; FIXED_PORT=1 ;;
  esac
done

if [ "$MENU" = 1 ] || { [ "$#" = 0 ] && [ "$FIXED_PORT" = 0 ] && [ -t 0 ] && [ -z "$REMOTE_ORIGIN" ]; }; then
  while :; do
    printf '\nBiblia\n'
    echo '  1. Iniciar Biblia'
    echo '  2. Iniciar con acceso al panel por IP (HTTPS)'
    echo '  3. Cambiar PIN'
    echo '  4. Restablecer PIN olvidado'
    echo '  5. Compartir proyección en la red (OBS)'
    echo '  6. Compartir por internet (Cloudflare)'
    echo '  0. Salir'
    printf 'Elige una opción [1]: '
    IFS= read -r opcion || exit 0
    case "$opcion" in
      ''|1) break ;;
      2) PANEL_RED=1; RED=1; break ;;
      3) CHANGE_PIN=1; break ;;
      4) RESET_PIN=1; break ;;
      5) RED=1; break ;;
      6) INTERNET=1; break ;;
      0) exit 0 ;;
      *) echo 'Elige una de las opciones del menú.' ;;
    esac
  done
fi
if [ "$RED" = 1 ] && [ "$PANEL_RED" = 0 ]; then BIND="0.0.0.0"; fi

if [ "$INTERNET" = 1 ]; then REMOTE_ORIGIN=""; fi
if [ -n "$REMOTE_ORIGIN" ]; then
  if ! [[ "$REMOTE_ORIGIN" =~ ^https://([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?$ ]] || [ "${#REMOTE_ORIGIN}" -gt 261 ]; then
    echo "BIBLIA_ORIGEN_REMOTO debe ser https://dominio exacto, en minúsculas, sin ruta, puerto ni comodines."
    exit 1
  fi
  REMOTE_HOST="${REMOTE_ORIGIN#https://}"
fi

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
CONF="$(cd "$CONF" && pwd -P)"
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

if [ -n "$REMOTE_ORIGIN" ] && [ ! -s "$CONF/pin" ]; then
  echo "Crea primero el PIN entrando por localhost con ./serve.sh, sin BIBLIA_ORIGEN_REMOTO."
  exit 1
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

# Lo que dejó una ejecución anterior que no pudo cerrarse bien (ventana cerrada, equipo apagado): un
# servidor huérfano ocupa el puerto y su carpeta temporal se queda para siempre. Las ejecuciones que
# siguen vivas tienen su serve.pid y no se tocan.
limpiar_huerfanos() {
  local d pid owner
  for d in "${TMPDIR:-/tmp}"/biblia.*; do
    [ -d "$d" ] || continue
    owner="$(cat "$d/serve.pid" 2>/dev/null || true)"
    if [ -n "$owner" ] && ps -p "$owner" -o command= 2>/dev/null | grep -q 'serve\.sh'; then continue; fi
    pid="$(cat "$d/cloudflared.pid" 2>/dev/null || true)"
    if [ -n "$pid" ] && ps -p "$pid" -o command= 2>/dev/null | grep -qF "$d/cloudflared.yml"; then
      kill "$pid" 2>/dev/null || true
    fi
    pid="$(cat "$d/httpd.pid" 2>/dev/null || true)"
    if [ -n "$pid" ] && ps -p "$pid" -o command= 2>/dev/null | grep -qF "$(basename "$d")"; then
      kill "$pid" 2>/dev/null || true
      echo "Cerré un servidor de Biblia que había quedado abierto (proceso $pid)."
      sleep 1
    fi
    rm -rf "$d"
  done
}
limpiar_huerfanos

REQUESTED_PORT="$PORT"
if command -v lsof >/dev/null; then
  while lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do
    if [ "$FIXED_PORT" = 1 ] || [ "$PORT" -eq 65535 ]; then
      echo "El puerto $PORT no está disponible. Indica uno libre al ejecutar ./serve.sh."
      exit 1
    fi
    PORT=$((10#$PORT + 1))
  done
fi

[ -s "$CONF/viewer.key" ] || "$OPENSSL" rand -hex 16 > "$CONF/viewer.key"
chmod 600 "$CONF/viewer.key"
# Identifica esta instalación: si cambia (tras --reiniciar), la app borra lo guardado en el navegador.
[ -s "$CONF/install.id" ] || "$OPENSSL" rand -hex 16 > "$CONF/install.id"
rm -rf "$CONF/.crear"
VIEWER="$(cat "$CONF/viewer.key")"

RUN="$(mktemp -d "${TMPDIR:-/tmp}/biblia.XXXXXX")"
chmod 700 "$RUN"
echo $$ > "$RUN/serve.pid"
chmod +x "$DIR/server/"*.cgi

stop_cloudflare() {
  if [ -n "$TUNNEL_PID" ]; then
    kill "$TUNNEL_PID" 2>/dev/null || true
    wait "$TUNNEL_PID" 2>/dev/null || true
    TUNNEL_PID=""
  fi
}

stop() {
  stop_cloudflare
  if [ -f "$RUN/httpd.pid" ]; then kill "$(cat "$RUN/httpd.pid")" 2>/dev/null || true; fi
  rm -rf "$RUN"
}
trap stop EXIT
trap 'exit 0' INT TERM HUP

LAN_IP=""
if [ "$RED" = 1 ]; then
  if command -v ipconfig >/dev/null; then
    iface="$(route -n get default 2>/dev/null | awk '$1 == "interface:" {print $2; exit}' || true)"
    LAN_IP="$(ipconfig getifaddr "${iface:-en0}" 2>/dev/null || ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
  else
    LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  fi
  if ! [[ "$LAN_IP" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || [[ "$LAN_IP" == 127.* ]]; then LAN_IP=""; fi
fi

PANEL_ORIGIN=""
if [ "$PANEL_RED" = 1 ]; then
  if [ -z "$LAN_IP" ]; then echo 'Conecta este equipo a la red para habilitar el panel por IP.'; exit 1; fi
  if [ ! -f "$MODS/mod_ssl.so" ]; then echo 'Apache necesita mod_ssl para abrir el panel por HTTPS.'; exit 1; fi
  PANEL_ORIGIN="https://$LAN_IP:$PORT"
  if command -v lockf >/dev/null; then
    cert_lock=(lockf -k -t 20 "$CONF/panel-cert.lock")
  else
    cert_lock=(flock -w 20 "$CONF/panel-cert.lock")
  fi
  if ! "${cert_lock[@]}" bash "$DIR/server/panel-cert.sh" "$OPENSSL" "$CONF" "$RUN" "$LAN_IP"; then
    echo 'No se pudo preparar el certificado HTTPS de Biblia.'
    if [ -f "$RUN/cert.log" ]; then tail -4 "$RUN/cert.log"; fi
    exit 1
  fi
fi

load() { [ -f "$MODS/$2" ] && echo "LoadModule $1 $MODS/$2"; return 0; }

write_httpd_config() {
local hosts="localhost|127\\.0\\.0\\.1|\\[::1\\]" host_pattern
[ -n "$LAN_IP" ] && hosts="$hosts|${LAN_IP//./\\.}"
host_pattern="($hosts):${PORT}"
[ -n "$REMOTE_HOST" ] && host_pattern="$host_pattern|${REMOTE_HOST//./\\.}"
cat <<EOF
ServerRoot "$RUN"
DefaultRuntimeDir "$RUN"
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
if [ "$PANEL_RED" = 1 ]; then
  load ssl_module mod_ssl.so
  echo "Listen $LAN_IP:$PORT https"
fi
cat <<EOF

# Pocos procesos: pensado para equipos modestos (4 GB de RAM). Solo se crean los que hagan falta, pero
# cada proyector o fuente de OBS ocupa uno de forma permanente con su espera de 20 s: si se agotan, los
# cambios de la consola hacen cola. Sin KeepAlive, una conexión inactiva no retiene ninguno.
StartServers 2
MinSpareServers 2
MaxSpareServers 4
MaxRequestWorkers 32
Timeout 60
KeepAlive Off
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
SetEnv BIBLIA_PANEL_ORIGIN "$PANEL_ORIGIN"
SetEnv BIBLIA_SESSION_MIN "$SESSION_MIN"
SetEnv BIBLIA_REMOTE_ORIGIN "$REMOTE_ORIGIN"
SetEnv BIBLIA_REMOTE_HOST "$REMOTE_HOST"
SetEnv BIBLIA_REMOTE_ACCESS "$REMOTE_ACCESS"
ScriptAlias /api/live "$DIR/server/live.cgi"
ScriptAlias /api/media "$DIR/server/media.cgi"
ScriptAlias /api/auth "$DIR/server/auth.cgi"
ScriptAlias /api/app "$DIR/server/app.cgi"
ScriptAlias /api/settings "$DIR/server/settings.cgi"
SetEnv BIBLIA_APP_DIR "$DIR"

<Location "/api/media">
  LimitRequestBody 1073741824
</Location>
<Location "/api/live">
  LimitRequestBody 16777216
</Location>
<Location "/api/settings">
  LimitRequestBody 16777216
</Location>
<LocationMatch "^/api/(media|live)(/|\$)">
  <If "'$REMOTE_ACCESS' != '' && %{HTTP_HOST} == '$REMOTE_HOST' && %{REQUEST_METHOD} == 'POST' && req('X-Biblia-Access') != '$REMOTE_ACCESS'">
    Require all denied
  </If>
</LocationMatch>
<LocationMatch "^/(?!(?:index\.html|styles\.css|icon\.svg|auth\.js|app\.js|studio\.js|bible_rvr1960\.json|himnarios\.json|api/(?:auth|app|live|media|settings))?\$)">
  <If "'$REMOTE_ACCESS' != '' && %{HTTP_HOST} == '$REMOTE_HOST'">
    Require all denied
  </If>
</LocationMatch>

<Directory />
  Require all denied
  AllowOverride None
</Directory>
<Directory "$DIR">
  Options -Indexes -FollowSymLinks
  AllowOverride None
  Require all granted
  # Solo se responde si se pide por el nombre de este equipo (frena el «DNS rebinding»).
  <If "! %{HTTP_HOST} =~ m#^($host_pattern)\$#">
    Require all denied
  </If>
  <If "%{HTTP_HOST} == '$REMOTE_HOST' && (%{REMOTE_ADDR} != '127.0.0.1' || req('X-Forwarded-Proto') != 'https')">
    Require all denied
  </If>
</Directory>
<Directory "$DIR/server">
  Options +ExecCGI
  Require all granted
</Directory>
<Directory "$CONF">
  Require all denied
</Directory>
# Nada interno se sirve: scripts, configuración, notas ni archivos ocultos.
# La consola (console.html) solo se entrega con sesión, por /api/app.
<LocationMatch "^/(server|\\.[^/]*)(/|\$)|\\.(sh|ps1|cmd|md|bak|log|pem|key|cer|pfx|p12)\$|^/console\\.html\$">
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
if [ "$PANEL_RED" = 1 ]; then
  cat <<EOF
<VirtualHost $LAN_IP:$PORT>
  ServerName $LAN_IP:$PORT
  SSLEngine on
  SSLProtocol -all +TLSv1.2
  SSLCertificateFile "$RUN/panel.pem"
  SSLCertificateKeyFile "$RUN/panel.key"
</VirtualHost>
EOF
fi
}
write_httpd_config > "$RUN/httpd.conf"

"$HTTPD" -f "$RUN/httpd.conf" -DFOREGROUND &
SERVER=$!
# En macOS: que el equipo y la pantalla no se duerman mientras el servidor esté encendido.
if command -v caffeinate >/dev/null; then caffeinate -di -w $$ & fi
sleep 1
if ! kill -0 "$SERVER" 2>/dev/null || [ "$(cat "$RUN/httpd.pid" 2>/dev/null)" != "$SERVER" ]; then
  echo "El servidor no pudo arrancar:"
  cat "$RUN/error.log" 2>/dev/null || true
  exit 1
fi

if [ "$INTERNET" = 1 ]; then
  . "$DIR/server/cloudflare.sh"
  if start_cloudflare; then
    # Actualiza la lista de hosts después de que Biblia haya reservado su puerto.
    write_httpd_config > "$RUN/httpd.conf"
    "$HTTPD" -t -f "$RUN/httpd.conf"
    "$HTTPD" -k graceful -f "$RUN/httpd.conf"
  else
    stop_cloudflare
    echo 'No se pudo crear el enlace de internet. Biblia sigue disponible en este equipo.'
  fi
fi

URL="http://localhost:$PORT"
OPEN_URL="$URL"
if [ "$CHANGE_PIN" = 1 ] && [ -s "$CONF/pin" ]; then OPEN_URL="$URL/?cambiar-pin"; fi
if [ "$PORT" != "$REQUESTED_PORT" ]; then echo "El puerto $REQUESTED_PORT está ocupado. Biblia usará el $PORT."; fi
echo "=============================================="
echo "  Biblia · by @jairohm.dev"
echo "=============================================="
echo "  App       : $OPEN_URL"
if [ -n "$PANEL_ORIGIN" ]; then
  echo "  Acceso al panel con PIN: $PANEL_ORIGIN"
  echo "  Certificado público de Biblia: $CONF/Biblia-autoridad-red.cer"
  echo '  Agrega ese certificado como autoridad de confianza en los dispositivos que usarán el panel.'
fi
if [ -n "$REMOTE_ACCESS" ]; then
  echo "  Panel por internet: $REMOTE_ORIGIN/#acceso=$REMOTE_ACCESS"
  echo '  Comparte el enlace completo con quienes tengan el PIN. Se cierra con Ctrl+C.'
elif [ -n "$REMOTE_ORIGIN" ]; then
  echo "  Panel por túnel: $REMOTE_ORIGIN (requiere PIN)"
fi
echo "  OBS       : $URL/?salida&obs"
echo "  OBS (solo texto, fondo transparente):"
echo "              $URL/?salida&obs&transparente"
if [ "$RED" = 1 ] && [ -n "$LAN_IP" ]; then
  echo "  OBS en otro equipo de la red (solo ver):"
  echo "              ${PANEL_ORIGIN:-http://$LAN_IP:$PORT}/?salida&obs&k=$VIEWER"
fi
echo "  Sesión    : se pide el PIN tras $SESSION_MIN min sin usar la consola ($((SESSION_MIN / 60)) h $((SESSION_MIN % 60)) min)"
echo "  Ayuda     : ./serve.sh --ayuda"
echo "  Detener   : Ctrl+C"
echo "=============================================="

if [ -z "${NO_ABRIR:-}" ]; then
  if command -v open >/dev/null; then open "$OPEN_URL" 2>/dev/null || true
  elif command -v xdg-open >/dev/null; then xdg-open "$OPEN_URL" >/dev/null 2>&1 || true; fi
fi
wait "$SERVER"
