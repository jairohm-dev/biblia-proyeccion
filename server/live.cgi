#!/bin/sh
# Estado «En vivo» compartido entre la consola y OBS.
#   POST /api/live          (firmada, solo este equipo) guarda el estado y sube la revisión.
#   GET  /api/live?rev=N    espera hasta 20 s a que la revisión cambie y la devuelve.
#                           Desde otro equipo de la red hace falta la llave de visor (&k=…).
. "$(dirname "$0")/lib.sh"

check_host
state="$RUN/live.json"
rev="$RUN/live.rev"
[ -f "$rev" ] || echo 0 > "$rev"

if [ "$REQUEST_METHOD" = "POST" ]; then
  is_loopback || reply '403 Forbidden' '{"error":"solo-este-equipo"}'
  check_origin
  read_body 262144
  verify_signature
  mv "$BODY" "$state"
  echo $(( $(cat "$rev") + 1 )) > "$RUN/live.rev.$$" && mv "$RUN/live.rev.$$" "$rev"
  printf 'Status: 204 No Content\r\n\r\n'
  exit 0
fi

[ "$REQUEST_METHOD" = "GET" ] || reply '405 Method Not Allowed' '{"error":"metodo"}'
check_viewer
want=$(printf '&%s' "$QUERY_STRING" | sed -n 's/.*&rev=\([0-9][0-9]*\).*/\1/p')
# Espera a que cambie lo que está en vivo (hasta 20 s). Mira cada décima de segundo y lee la revisión
# con «read» (no lanza procesos): el proyector y OBS ven el cambio casi al instante sin cargar el equipo.
i=0
read -r cur < "$rev"
while [ -n "$want" ] && [ "$cur" = "$want" ] && [ "$i" -lt 200 ]; do
  sleep 0.1
  i=$((i + 1))
  read -r cur < "$rev"
done

printf 'Content-Type: application/json\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\n\r\n'
printf '{"rev":%s,"state":' "$(cat "$rev")"
if [ -s "$state" ]; then cat "$state"; else printf 'null'; fi
printf '}'
