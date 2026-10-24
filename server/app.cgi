#!/bin/sh
# La consola (su HTML) solo se entrega a un equipo que entró con el PIN: sin sesión no hay nada que
# desocultar desde el inspector del navegador.
#   POST /api/app   (firmada, solo este equipo) → console.html
. "$(dirname "$0")/lib.sh"

check_host
is_loopback || reply '403 Forbidden' '{"error":"solo-este-equipo"}'
[ "$REQUEST_METHOD" = "POST" ] || reply '405 Method Not Allowed' '{"error":"metodo"}'
check_origin
read_body 64
verify_signature
printf 'Content-Type: text/html; charset=utf-8\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\n\r\n'
cat "${BIBLIA_APP_DIR:?}/console.html"
