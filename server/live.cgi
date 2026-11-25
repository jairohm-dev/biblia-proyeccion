#!/bin/sh
# Estado «En vivo» compartido entre la consola y OBS.
#   POST /api/live          (firmada) guarda el estado y sube la revisión.
#   GET  /api/live?rev=N    espera hasta 20 s a que la revisión cambie y la devuelve.
#                           Desde otro equipo de la red hace falta la llave de visor (&k=…).
. "$(dirname "$0")/lib.sh"

check_host
state="$RUN/proyeccion.json"

if [ "$REQUEST_METHOD" = "POST" ]; then
  check_control
  check_origin
  # Lleva la imagen de fondo en base64: una foto de 1920 px puede pesar varios MB.
  read_body 16777216
  verify_signature
  writer="$(dirname "$0")/live-write.sh"
  if command -v lockf >/dev/null; then
    lockf -k -t 5 "$RUN/live.lock" sh "$writer" "$state" "$BODY" || reply '503 Service Unavailable' '{"error":"proyeccion"}'
  else
    flock -w 5 "$RUN/live.lock" sh "$writer" "$state" "$BODY" || reply '503 Service Unavailable' '{"error":"proyeccion"}'
  fi
  printf 'Status: 204 No Content\r\n\r\n'
  exit 0
fi

[ "$REQUEST_METHOD" = "GET" ] || reply '405 Method Not Allowed' '{"error":"metodo"}'
check_viewer
want=$(printf '&%s' "$QUERY_STRING" | sed -n 's/.*&rev=\([0-9][0-9]*\).*/\1/p')
# Espera a que cambie lo que está en vivo (hasta 20 s). Mira cada décima de segundo y lee la revisión
# con «read» (no lanza procesos): el proyector y OBS ven el cambio casi al instante sin cargar el equipo.
i=0
read_revision() {
  cur=0
  if [ -f "$state" ] && IFS= read -r line < "$state"; then
    cur=${line#*:}
    cur=${cur%,}
  fi
}
read_revision
while [ -n "$want" ] && [ "$cur" = "$want" ] && [ "$i" -lt 200 ]; do
  sleep 0.1
  i=$((i + 1))
  read_revision
done

printf 'Content-Type: application/json\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\n\r\n'
if [ -f "$state" ]; then cat "$state"; else printf '{"rev":0,"state":null}'; fi
