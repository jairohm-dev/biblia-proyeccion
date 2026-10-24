#!/bin/sh
# Imágenes, videos y audios para OBS.
#   POST /api/media?id=X   (firmada, solo este equipo) guarda el archivo enviado por la consola.
#   GET  /api/media?id=X   lo sirve. Desde otro equipo de la red hace falta la llave de visor (&k=…).
# Solo se aceptan tipos de imagen, video y audio: un archivo nunca se sirve como página web.
. "$(dirname "$0")/lib.sh"

check_host
dir="$RUN/media"
mkdir -p "$dir"
id=$(printf '&%s' "$QUERY_STRING" | sed -n 's/.*&id=\([A-Za-z0-9-]\{1,64\}\).*/\1/p')
[ -n "$id" ] || reply '400 Bad Request' '{"error":"id"}'

if [ "$REQUEST_METHOD" = "POST" ]; then
  is_loopback || reply '403 Forbidden' '{"error":"solo-este-equipo"}'
  check_origin
  type=$(printf '%s' "${CONTENT_TYPE:-}" | tr 'A-Z' 'a-z' | sed 's/;.*//')
  case "$type" in
    image/png|image/jpeg|image/gif|image/webp|image/avif|\
    video/mp4|video/webm|video/quicktime|video/ogg|\
    audio/mpeg|audio/mp4|audio/x-m4a|audio/aac|audio/wav|audio/x-wav|audio/ogg|audio/webm|audio/flac) ;;
    *) reply '415 Unsupported Media Type' '{"error":"tipo"}' ;;
  esac
  read_body 1073741824
  verify_signature
  mv "$BODY" "$dir/$id"
  printf '%s' "$type" > "$dir/$id.type"
  printf 'Status: 204 No Content\r\n\r\n'
  exit 0
fi

[ "$REQUEST_METHOD" = "GET" ] || reply '405 Method Not Allowed' '{"error":"metodo"}'
check_viewer
[ -f "$dir/$id" ] || reply '404 Not Found' '{"error":"no-existe"}'
printf 'Content-Type: %s\r\nContent-Length: %s\r\nCache-Control: private, max-age=3600\r\nX-Content-Type-Options: nosniff\r\nContent-Security-Policy: sandbox; default-src '"'none'"'\r\nContent-Disposition: inline\r\n\r\n' \
  "$(cat "$dir/$id.type" 2>/dev/null || echo application/octet-stream)" "$(wc -c < "$dir/$id" | tr -d ' ')"
cat "$dir/$id"
