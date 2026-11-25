#!/bin/sh
# Se ejecuta bajo el bloqueo de ajustes para comparar la revisión y publicar el archivo.
set -eu
umask 077

settings=$1
body=$2
expected=$3
openssl=$4
current=0
if [ -f "$settings" ]; then
  current=$("$openssl" dgst -sha256 -hex < "$settings")
  current=${current##*= }
fi
[ "$current" = "$expected" ] || exit 3

pending=$(mktemp "$(dirname "$settings")/.ajustes.XXXXXX")
trap 'rm -f "$pending"' EXIT
cp "$body" "$pending"
mv -f "$pending" "$settings"
