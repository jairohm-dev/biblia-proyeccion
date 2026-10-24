#!/bin/sh
# Funciones comunes de los CGI: respuestas, comprobación de origen y firmas ECDSA P-256.
#
# Cómo se protege el control:
#   · Solo se acepta control desde este mismo equipo (REMOTE_ADDR de loopback).
#   · El nombre del servidor (Host) y el origen (Origin) deben ser los de la app: frena el
#     «DNS rebinding» y que una página web cualquiera mande órdenes al servidor.
#   · Cada orden va firmada con la llave del equipo (ECDSA P-256, no exportable en el navegador),
#     con hora y un número de un solo uso: una petición copiada no se puede repetir ni cambiar.

OPENSSL=${BIBLIA_OPENSSL:-/usr/bin/openssl}
RUN=${EASYBIBLIA_STATE:?}
CONF=${BIBLIA_CONF:?}
umask 077
BODY=''
WORK=''

cleanup() { [ -n "$WORK" ] && rm -rf "$WORK"; }
trap cleanup EXIT

reply() {   # reply «Estado HTTP» [JSON]
  printf 'Status: %s\r\nContent-Type: application/json\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\n\r\n%s' "$1" "${2:-}"
  exit 0
}

sha256_hex() { "$OPENSSL" dgst -sha256 -hex | sed 's/^.*= *//'; }

is_loopback() {
  case "$REMOTE_ADDR" in 127.*|::1|::ffff:127.*) return 0 ;; esac
  return 1
}

check_host() {
  case "$HTTP_HOST" in
    "localhost:$SERVER_PORT"|"127.0.0.1:$SERVER_PORT"|"[::1]:$SERVER_PORT") return 0 ;;
  esac
  [ -n "${BIBLIA_LAN_HOST:-}" ] && [ "$HTTP_HOST" = "$BIBLIA_LAN_HOST:$SERVER_PORT" ] && return 0
  reply '421 Misdirected Request' '{"error":"host"}'
}

check_origin() {
  case "${HTTP_ORIGIN:-}" in
    "http://localhost:$SERVER_PORT"|"http://127.0.0.1:$SERVER_PORT"|"http://[::1]:$SERVER_PORT") return 0 ;;
  esac
  reply '403 Forbidden' '{"error":"origen"}'
}

# Ver lo que se proyecta (OBS): desde este equipo, libre; desde la red, con la llave de visor (&k=…).
check_viewer() {
  is_loopback && return 0
  k=$(printf '&%s' "$QUERY_STRING" | sed -n 's/.*&k=\([0-9a-f]\{32\}\).*/\1/p')
  [ -n "$k" ] && [ "$k" = "$(cat "$CONF/viewer.key" 2>/dev/null)" ] && return 0
  reply '403 Forbidden' '{"error":"visor"}'
}

read_body() {   # read_body [límite en bytes]
  limit=${1:-1048576}
  len=${CONTENT_LENGTH:-0}
  case "$len" in ''|*[!0-9]*) reply '400 Bad Request' '{"error":"longitud"}' ;; esac
  [ "$len" -le "$limit" ] || reply '413 Payload Too Large' '{"error":"grande"}'
  WORK=$(mktemp -d "$RUN/tmp.XXXXXX")
  BODY="$WORK/body"
  if [ "$len" -gt 0 ]; then head -c "$len" > "$BODY"; else : > "$BODY"; fi
}

json_field() {   # json_field nombre → valor de texto simple (solo base64, hex y guiones)
  sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([A-Za-z0-9+/=_-]*\)\".*/\1/p" "$BODY" | head -n 1
}

# Comprueba la firma de la petición. Mensaje firmado (separado por saltos de línea):
#   MÉTODO · ruta con consulta · hora (s) · número de un solo uso · SHA-256 del cuerpo
verify_signature() {
  dev=${HTTP_X_BIBLIA_DEVICE:-}
  ts=${HTTP_X_BIBLIA_TIME:-}
  nonce=${HTTP_X_BIBLIA_NONCE:-}
  sig=${HTTP_X_BIBLIA_SIGNATURE:-}
  printf '%s' "$dev" | grep -Eq '^[0-9a-f]{32}$' || reply '401 Unauthorized' '{"error":"equipo"}'
  printf '%s' "$nonce" | grep -Eq '^[0-9a-f]{32}$' || reply '401 Unauthorized' '{"error":"firma"}'
  printf '%s' "$ts" | grep -Eq '^[0-9]{9,11}$' || reply '401 Unauthorized' '{"error":"firma"}'
  printf '%s' "$sig" | grep -Eq '^[A-Za-z0-9+/=]{60,120}$' || reply '401 Unauthorized' '{"error":"firma"}'
  pem="$RUN/devices/$dev.pem"
  [ -f "$pem" ] || reply '401 Unauthorized' '{"error":"sesion"}'
  # La sesión caduca tras BIBLIA_SESSION_MIN minutos SIN USARSE: mientras se proyecta, se renueva sola.
  mins=${BIBLIA_SESSION_MIN:-720}
  if [ -n "$(find "$pem" -mmin +"$mins" 2>/dev/null)" ]; then rm -f "$pem"; reply '401 Unauthorized' '{"error":"caducada"}'; fi

  now=$(date +%s)
  skew=$((now - ts))
  [ "$skew" -lt 0 ] && skew=$((-skew))
  [ "$skew" -le 120 ] || reply '401 Unauthorized' '{"error":"hora"}'

  [ -n "$WORK" ] || { WORK=$(mktemp -d "$RUN/tmp.XXXXXX"); BODY="$WORK/body"; : > "$BODY"; }
  printf '%s\n%s\n%s\n%s\n%s' "$REQUEST_METHOD" "$REQUEST_URI" "$ts" "$nonce" "$(sha256_hex < "$BODY")" > "$WORK/msg"
  printf '%s' "$sig" | "$OPENSSL" base64 -d -A > "$WORK/sig" 2>/dev/null
  "$OPENSSL" dgst -sha256 -verify "$pem" -signature "$WORK/sig" "$WORK/msg" > /dev/null 2>&1 \
    || reply '401 Unauthorized' '{"error":"firma"}'

  # Cada número de un solo uso vale una vez: así no se puede repetir una petición copiada.
  nonces="$RUN/nonces"
  touch "$nonces"
  grep -q " $nonce\$" "$nonces" && reply '401 Unauthorized' '{"error":"repetida"}'
  awk -v min=$((now - 300)) '$1 >= min' "$nonces" > "$WORK/nonces" 2>/dev/null
  printf '%s %s\n' "$now" "$nonce" >> "$WORK/nonces"
  mv "$WORK/nonces" "$nonces"
  # Uso real (no la comprobación periódica de la consola): renueva la sesión.
  case "$REQUEST_URI" in *accion=comprobar*) ;; *) touch "$pem" ;; esac
}

# Registra la llave pública del equipo para esta sesión del servidor. Deja su identificador en
# DEVICE_ID; si la llave no es una ECDSA P-256 válida, falla sin registrar nada.
DEVICE_ID=''
register_device() {
  pub=$1
  DEVICE_ID=''
  printf '%s' "$pub" | grep -Eq '^[A-Za-z0-9+/=]{100,200}$' || return 1
  mkdir -p "$RUN/devices"
  tmp="$WORK/pub.pem"
  { echo '-----BEGIN PUBLIC KEY-----'; printf '%s\n' "$pub" | fold -w 64; echo '-----END PUBLIC KEY-----'; } > "$tmp"
  "$OPENSSL" ec -pubin -in "$tmp" -text -noout 2>/dev/null | grep -Eq 'prime256v1|P-256' || return 1
  id=$(printf '%s' "$pub" | "$OPENSSL" base64 -d -A | sha256_hex | cut -c1-32)
  printf '%s' "$id" | grep -Eq '^[0-9a-f]{32}$' || return 1
  mv "$tmp" "$RUN/devices/$id.pem"
  DEVICE_ID=$id
}
