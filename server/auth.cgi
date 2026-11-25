#!/bin/sh
# PIN y equipos autorizados.
#   GET  /api/auth?accion=estado       ¿hay PIN? y la sal para derivarlo
#   POST /api/auth?accion=crear        primer PIN + llave del equipo          {salt, verifier, pub}
#   POST /api/auth?accion=entrar       PIN + llave del equipo                 {verifier, pub}
#   POST /api/auth?accion=comprobar    (firmada) ¿sigue valiendo la sesión? (sin renovarla)
#   POST /api/auth?accion=mantener     (firmada) igual, pero la renueva: la consola lo usa mientras está en vivo
#   POST /api/auth?accion=salir        (firmada) cierra la sesión de este equipo
#   POST /api/auth?accion=cambiar      (firmada) cambia el PIN                {current, salt, verifier}
#   POST /api/auth?accion=nombre       (firmada) cambia el nombre de la iglesia {name}
# El nombre viaja y se guarda en base64url (UTF-8), así nunca hay caracteres raros en el JSON.
#
# El PIN nunca llega aquí: el navegador lo convierte con PBKDF2-SHA256 (210 000 vueltas, sal propia)
# y aquí solo se guarda el SHA-256 de ese resultado. Los equipos autorizados duran lo que dure el
# servidor encendido: al reiniciarlo hay que volver a poner el PIN.
. "$(dirname "$0")/lib.sh"

check_host
check_control

PINFILE="$CONF/pin"
FAILS="$RUN/fails"
action=$(printf '&%s' "$QUERY_STRING" | sed -n 's/.*&accion=\([a-z]*\).*/\1/p')

stored_salt() { cut -d' ' -f1 "$PINFILE" 2>/dev/null; }
stored_hash() { cut -d' ' -f2 "$PINFILE" 2>/dev/null; }
valid_hex() { printf '%s' "$1" | grep -Eq "^[0-9a-f]{$2}\$"; }
valid_name() { printf '%s' "$1" | grep -Eq '^[A-Za-z0-9_-]{1,160}$'; }
NAMEFILE="$CONF/iglesia"
install_id() { cat "$CONF/install.id" 2>/dev/null; }
church_name() { cat "$NAMEFILE" 2>/dev/null; }

# Tras 5 PIN equivocados hay que esperar: 30 s y el doble cada vez, hasta 15 min.
wait_left() {
  [ -f "$FAILS" ] || { echo 0; return; }
  until=$(cut -d' ' -f2 "$FAILS")
  left=$((until - $(date +%s)))
  [ "$left" -gt 0 ] && echo "$left" || echo 0
}
note_failure() {
  count=$(( $( [ -f "$FAILS" ] && cut -d' ' -f1 "$FAILS" || echo 0 ) + 1 ))
  until=0
  if [ "$count" -ge 5 ]; then
    secs=30; i=5
    while [ "$i" -lt "$count" ] && [ "$secs" -lt 900 ]; do secs=$((secs * 2)); i=$((i + 1)); done
    [ "$secs" -gt 900 ] && secs=900
    until=$(( $(date +%s) + secs ))
  fi
  printf '%s %s\n' "$count" "$until" > "$FAILS"
}

case "$REQUEST_METHOD:$action" in
  GET:estado)
    if [ -s "$PINFILE" ]; then reply '200 OK' "{\"configured\":true,\"salt\":\"$(stored_salt)\",\"name\":\"$(church_name)\",\"install\":\"$(install_id)\"}"
    else
      registro_local=false
      if is_panel || [ "$HTTP_HOST" = "${BIBLIA_REMOTE_HOST:-}" ]; then registro_local=true; fi
      reply '200 OK' "{\"configured\":false,\"install\":\"$(install_id)\",\"registroLocal\":$registro_local}"
    fi ;;

  POST:crear)
    if is_panel || [ "$HTTP_HOST" = "${BIBLIA_REMOTE_HOST:-}" ]; then
      reply '403 Forbidden' '{"error":"registro-local"}'
    fi
    check_origin
    read_body 4096
    salt=$(json_field salt); ver=$(json_field verifier); pub=$(json_field pub); name=$(json_field name)
    valid_hex "$salt" 32 && valid_hex "$ver" 64 || reply '400 Bad Request' '{"error":"datos"}'
    [ -z "$name" ] || valid_name "$name" || reply '400 Bad Request' '{"error":"nombre"}'
    # Primero se comprueba que aún no haya PIN (con cerrojo): nunca se registra un equipo sin PIN.
    mkdir "$CONF/.crear" 2>/dev/null || reply '409 Conflict' '{"error":"ocupado"}'
    if [ -s "$PINFILE" ]; then rmdir "$CONF/.crear"; reply '409 Conflict' '{"error":"ya-hay-pin"}'; fi
    if ! register_device "$pub"; then rmdir "$CONF/.crear"; reply '400 Bad Request' '{"error":"llave"}'; fi
    printf '%s %s\n' "$salt" "$(printf '%s' "$ver" | sha256_hex)" > "$CONF/pin.tmp" && mv "$CONF/pin.tmp" "$PINFILE"
    [ -n "$name" ] && printf '%s' "$name" > "$NAMEFILE"
    rmdir "$CONF/.crear"
    reply '200 OK' "{\"ok\":true,\"device\":\"$DEVICE_ID\"}" ;;

  POST:entrar)
    check_origin
    read_body 4096
    [ -s "$PINFILE" ] || reply '409 Conflict' '{"error":"sin-pin"}'
    left=$(wait_left)
    [ "$left" -gt 0 ] && reply '429 Too Many Requests' "{\"error\":\"espera\",\"wait\":$left}"
    ver=$(json_field verifier); pub=$(json_field pub)
    valid_hex "$ver" 64 || reply '400 Bad Request' '{"error":"datos"}'
    if [ "$(printf '%s' "$ver" | sha256_hex)" != "$(stored_hash)" ]; then
      note_failure
      left=$(wait_left)
      reply '401 Unauthorized' "{\"error\":\"pin\",\"wait\":$left}"
    fi
    rm -f "$FAILS"
    register_device "$pub" || reply '400 Bad Request' '{"error":"llave"}'
    reply '200 OK' "{\"ok\":true,\"device\":\"$DEVICE_ID\"}" ;;

  POST:comprobar|POST:mantener)
    check_origin
    read_body 64
    verify_signature
    lan_urls='[]'
    panel_urls='[]'
    if [ -n "${BIBLIA_LAN_HOST:-}" ] && [ "$HTTP_HOST" != "${BIBLIA_REMOTE_HOST:-}" ]; then
      lan_origin="${BIBLIA_PANEL_ORIGIN:-http://$BIBLIA_LAN_HOST:$SERVER_PORT}"
      lan_urls="[\"$lan_origin\"]"
      if [ -n "${BIBLIA_PANEL_ORIGIN:-}" ]; then panel_urls=$lan_urls; fi
    fi
    if [ -n "${BIBLIA_REMOTE_ACCESS:-}" ] && [ "$HTTP_HOST" != "$BIBLIA_REMOTE_HOST" ]; then
      public_url="\"$BIBLIA_REMOTE_ORIGIN/#acceso=$BIBLIA_REMOTE_ACCESS\""
      if [ "$panel_urls" = '[]' ]; then panel_urls="[$public_url]"
      else panel_urls="${panel_urls%\]},$public_url]"; fi
    fi
    reply '200 OK' "{\"ok\":true,\"viewer\":\"$(cat "$CONF/viewer.key")\",\"lanUrls\":$lan_urls,\"panelUrls\":$panel_urls}" ;;

  POST:compartir|POST:abrirred|POST:cerrarred|POST:abririnternet|POST:cerrarinternet|POST:certificadored)
    is_loopback && ! is_panel && [ "$HTTP_HOST" != "${BIBLIA_REMOTE_HOST:-}" ] ||
      reply '403 Forbidden' '{"error":"solo-este-equipo"}'
    check_origin
    read_body 64
    verify_signature
    case "$action" in
      compartir)
        if [ -d "$RUN/compartir" ]; then reply '200 OK' '{"pending":true}'; fi
        reply '200 OK' "$(cat "$RUN/compartir.json" 2>/dev/null || printf '{}')" ;;
      certificadored)
        cert="$CONF/Biblia-autoridad-red.cer"
        [ -n "${BIBLIA_PANEL_ORIGIN:-}" ] && [ -s "$cert" ] || reply '404 Not Found' '{"error":"certificado"}'
        printf 'Content-Type: application/x-x509-ca-cert\r\nCache-Control: no-store\r\n\r\n'
        cat "$cert" ;;
      *)
        mkdir "$RUN/compartir" 2>/dev/null || reply '409 Conflict' '{"error":"ocupado"}'
        if ! { printf '%s\n' "$action" > "$WORK/accion" && mv "$WORK/accion" "$RUN/compartir/accion"; }; then
          rmdir "$RUN/compartir"
          reply '503 Service Unavailable' '{"error":"conexion"}'
        fi
        reply '202 Accepted' '{"pending":true}' ;;
    esac ;;

  POST:salir)
    check_origin
    read_body 64
    verify_signature
    rm -f "$RUN/devices/$HTTP_X_BIBLIA_DEVICE.pem"
    reply '200 OK' '{"ok":true}' ;;

  POST:cambiar)
    check_origin
    read_body 4096
    verify_signature
    cur=$(json_field current); salt=$(json_field salt); ver=$(json_field verifier)
    valid_hex "$cur" 64 && valid_hex "$salt" 32 && valid_hex "$ver" 64 || reply '400 Bad Request' '{"error":"datos"}'
    left=$(wait_left)
    [ "$left" -gt 0 ] && reply '429 Too Many Requests' "{\"error\":\"espera\",\"wait\":$left}"
    if [ "$(printf '%s' "$cur" | sha256_hex)" != "$(stored_hash)" ]; then
      note_failure
      reply '401 Unauthorized' "{\"error\":\"pin\",\"wait\":$(wait_left)}"
    fi
    rm -f "$FAILS"
    printf '%s %s\n' "$salt" "$(printf '%s' "$ver" | sha256_hex)" > "$CONF/pin.tmp" && mv "$CONF/pin.tmp" "$PINFILE"
    # Con el PIN nuevo, los demás equipos tienen que volver a entrar.
    find "$RUN/devices" -name '*.pem' ! -name "$HTTP_X_BIBLIA_DEVICE.pem" -exec rm -f {} + 2>/dev/null
    reply '200 OK' '{"ok":true}' ;;

  POST:nombre)
    check_origin
    read_body 1024
    verify_signature
    name=$(json_field name)
    valid_name "$name" || reply '400 Bad Request' '{"error":"nombre"}'
    printf '%s' "$name" > "$NAMEFILE"
    reply '200 OK' '{"ok":true}' ;;

  *) reply '404 Not Found' '{"error":"accion"}' ;;
esac
