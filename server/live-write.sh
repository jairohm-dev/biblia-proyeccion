#!/bin/sh
# Se llama bajo el bloqueo de publicación. La revisión y la diapositiva van en el mismo archivo.
set -eu
state=$1
body=$2
current=0
if [ -f "$state" ]; then
  IFS= read -r line < "$state"
  current=${line#*:}
  current=${current%,}
fi
pending="$(dirname "$body")/live.next"
{
  printf '{"rev":%s,\n"state":' "$((current + 1))"
  cat "$body"
  printf '}\n'
} > "$pending"
mv -f "$pending" "$state"
