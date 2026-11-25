#!/usr/bin/env bash
# Cloudflare Quick Tunnel para el puerto de Biblia que Apache ya abrió.

cloudflared_path() {
  if command -v cloudflared >/dev/null; then command -v cloudflared; return; fi
  local version=2026.11.2 asset checksum actual target
  case "$(uname -s)-$(uname -m)" in
    Darwin-arm64) asset=cloudflared-darwin-arm64.tgz; checksum=f6d58eeec91ad1ec5fd1f7e4a587303772929b2625be5d24068033851c36ff55 ;;
    Darwin-x86_64) asset=cloudflared-darwin-amd64.tgz; checksum=6153d9ec629174882a3adbff2f7dc5a24b4f3bdd7ccc38eaa84fba26eb890311 ;;
    Linux-x86_64) asset=cloudflared-linux-amd64; checksum=56f13335143ec0e22772963290683a84a04114a35ec64cbc794a4d39ff9bb8cf ;;
    Linux-aarch64|Linux-arm64) asset=cloudflared-linux-arm64; checksum=04a7b7f08bce85d56b26ffe1fdbfbb21a074495a363d16f0783c40e25b5c5281 ;;
    Linux-i[36]86) asset=cloudflared-linux-386; checksum=6bfb8ee3731194223d9a07f4a70f52c203525db5cccccbd55647a0d3c01641b1 ;;
    Linux-armv7l) asset=cloudflared-linux-armhf; checksum=ab8dda127892266ef25d9787ea43be2314832204e2e32272901ae36010454684 ;;
    *) echo 'No hay una descarga automática de Cloudflare para este equipo.' >&2; return 1 ;;
  esac
  target="$CONF/cloudflared-$version-${asset#cloudflared-}"
  target="${target%.tgz}"
  if [ ! -x "$target" ]; then
    echo 'Descargando Cloudflare para habilitar el acceso por internet…' >&2
    if ! curl -fsSL --proto '=https' --proto-redir '=https' --connect-timeout 10 --max-time 120 \
      "https://github.com/cloudflare/cloudflared/releases/download/$version/$asset" -o "$RUN/$asset"; then return 1; fi
    actual=$("$OPENSSL" dgst -sha256 -hex < "$RUN/$asset") || return 1
    if [ "${actual##*= }" != "$checksum" ]; then
      echo 'La descarga de Cloudflare no pasó la verificación de integridad.' >&2
      return 1
    fi
    case "$asset" in
      *.tgz) tar -xzf "$RUN/$asset" -C "$RUN" || return 1 ;;
      *) mv "$RUN/$asset" "$RUN/cloudflared" || return 1 ;;
    esac
    chmod 700 "$RUN/cloudflared" && mv -f "$RUN/cloudflared" "$target" || return 1
  fi
  printf '%s\n' "$target"
}

start_cloudflare() {
  local client elapsed origin
  client=$(cloudflared_path) || return 1
  # Mantiene el túnel aparte de cualquier configuración previa de Cloudflare del usuario.
  printf '{}\n' > "$RUN/cloudflared.yml" || return 1
  echo 'Creando el enlace de internet con Cloudflare…'
  "$client" tunnel --config "$RUN/cloudflared.yml" --no-autoupdate --grace-period 2s --loglevel info \
    --url "http://127.0.0.1:$PORT" --metrics 127.0.0.1:0 > "$RUN/cloudflared.log" 2>&1 &
  TUNNEL_PID=$!
  printf '%s\n' "$TUNNEL_PID" > "$RUN/cloudflared.pid" || return 1
  for ((elapsed=0; elapsed<140; elapsed++)); do
    kill -0 "$TUNNEL_PID" 2>/dev/null || return 1
    if grep -q 'Registered tunnel connection' "$RUN/cloudflared.log" 2>/dev/null; then
      origin=$(sed -nE 's/^.*\|[[:space:]]*(https:\/\/[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.trycloudflare\.com)[[:space:]]*\|.*$/\1/p' "$RUN/cloudflared.log" | head -1)
      if [ -n "$origin" ]; then
        REMOTE_ACCESS=$("$OPENSSL" rand -hex 32) || return 1
        REMOTE_ORIGIN=$origin
        REMOTE_HOST=${origin#https://}
        return 0
      fi
    fi
    sleep 0.25
  done
  return 1
}
