#!/usr/bin/env bash
# Prepara el certificado de la red bajo el bloqueo que toma serve.sh.
set -euo pipefail
umask 077

openssl_bin=$1
conf=$2
run=$3
ip=$4
authority="$conf/panel-autoridad.pem"
work=$(mktemp -d "$conf/panel-cert.XXXXXX")
trap 'rm -rf "$work"' EXIT

# Guarda la autoridad y su llave juntas para publicar ambas de forma atómica.
if [ ! -s "$authority" ] || ! "$openssl_bin" x509 -in "$authority" -checkend 31622400 -noout >/dev/null 2>&1; then
  suffix=$("$openssl_bin" rand -hex 4)
  "$openssl_bin" req -x509 -newkey rsa:2048 -nodes -sha256 -days 1825 -subj "/CN=Biblia Red $suffix" \
    -addext 'basicConstraints=critical,CA:TRUE,pathlen:0' \
    -addext 'keyUsage=critical,keyCertSign,cRLSign' \
    -keyout "$work/authority.key" -out "$work/authority.crt" 2>"$run/cert.log"
  cat "$work/authority.crt" "$work/authority.key" > "$work/authority.pem"
  mv -f "$work/authority.pem" "$authority"
fi

cat > "$work/panel.ext" <<EOF
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=IP:$ip
EOF
"$openssl_bin" req -new -newkey rsa:2048 -nodes -sha256 -subj "/CN=$ip" \
  -keyout "$run/panel.key" -out "$work/panel.csr" 2>"$run/cert.log"
serial=$("$openssl_bin" rand -hex 16)
"$openssl_bin" x509 -req -in "$work/panel.csr" -CA "$authority" -CAkey "$authority" \
  -sha256 -days 365 -set_serial "0x$serial" -extfile "$work/panel.ext" -out "$run/panel.pem" 2>"$run/cert.log"
"$openssl_bin" x509 -in "$authority" -outform DER -out "$work/autoridad.cer"
mv -f "$work/autoridad.cer" "$conf/Biblia-autoridad-red.cer"
