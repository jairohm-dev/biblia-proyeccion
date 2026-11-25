#!/bin/sh
# Ajustes de la consola. Las dos operaciones requieren la firma del dispositivo.
. "$(dirname "$0")/lib.sh"

check_host
check_control
[ "$REQUEST_METHOD" = POST ] || reply '405 Method Not Allowed' '{"error":"metodo"}'
check_origin
action=$(printf '&%s' "$QUERY_STRING" | sed -n 's/.*&accion=\([a-z]*\).*/\1/p')
settings="$CONF/ajustes.json"

case "$action" in
  leer)
    read_body 64
    verify_signature
    # La copia y su revisión corresponden a la misma escritura del documento.
    revision=0
    if [ -f "$settings" ]; then
      cp "$settings" "$WORK/ajustes.json" || reply '503 Service Unavailable' '{"error":"ajustes"}'
      revision=$(sha256_hex < "$WORK/ajustes.json")
    else
      printf '{}' > "$WORK/ajustes.json"
    fi
    printf 'Content-Type: application/json\r\nCache-Control: no-store\r\nETag: "%s"\r\n\r\n' "$revision"
    cat "$WORK/ajustes.json" ;;
  guardar)
    read_body 16777216
    verify_signature
    revision=$(printf '&%s' "$QUERY_STRING" | sed -n 's/.*&revision=\([0-9a-f]*\).*/\1/p')
    printf '%s' "$revision" | grep -Eq '^(0|[0-9a-f]{64})$' || reply '400 Bad Request' '{"error":"revision"}'
    [ "$(head -c 1 "$BODY")" = '{' ] && [ "$(tail -c 1 "$BODY")" = '}' ] || reply '400 Bad Request' '{"error":"ajustes"}'
    writer="$(dirname "$0")/settings-write.sh"
    if command -v lockf >/dev/null; then
      lockf -k -t 5 "$CONF/ajustes.lock" sh "$writer" "$settings" "$BODY" "$revision" "$OPENSSL"
    else
      flock -w 5 "$CONF/ajustes.lock" sh "$writer" "$settings" "$BODY" "$revision" "$OPENSSL"
    fi
    result=$?
    case "$result" in
      0) reply '200 OK' "{\"revision\":\"$(sha256_hex < "$BODY")\"}" ;;
      3) reply '409 Conflict' '{"error":"revision"}' ;;
      *) reply '503 Service Unavailable' '{"error":"ajustes"}' ;;
    esac ;;
  *) reply '404 Not Found' '{"error":"accion"}' ;;
esac
