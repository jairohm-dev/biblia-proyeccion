<#
.SYNOPSIS
  Biblia - servidor local para Windows. No instala nada: usa PowerShell y .NET, que ya vienen en Windows 10 y 11.

.DESCRIPTION
  Abre la app en http://localhost:3737. Lo más fácil es hacer doble clic en «iniciar-windows.cmd».

  SEGURIDAD
  - Por defecto solo escucha en este equipo: un escaneo de la red no encuentra el puerto.
  - La consola pide un PIN cada vez que se enciende el servidor o tras 12 horas sin usarla. Si la sesión
    se cierra, lo que está en vivo sigue en pantalla y en OBS. El PIN no viaja ni se guarda tal cual:
    el navegador lo deriva (PBKDF2) y aquí solo queda un resumen.
  - Cada orden lleva la firma de la llave del navegador (ECDSA P-256, no se puede exportar ni copiar):
    una petición capturada no sirve para repetirla ni para cambiarla.
  - Tras 5 PIN equivocados hay que esperar, cada vez más.
  - Con -Red, otro equipo de la red solo puede VER la salida para OBS (con la llave de visor);
    el control sigue siendo solo de este equipo.

.PARAMETER Puerto
  Puerto (entre 1024 y 65535). Por defecto 3737.
.PARAMETER SesionMin
  Minutos sin usar la consola tras los que se vuelve a pedir el PIN. Por defecto 720 (12 horas).
.PARAMETER Red
  Deja que otro equipo de la red vea la salida para OBS.
.PARAMETER RestablecerPin
  Borra el PIN si lo olvidaste. Al abrir la app pedirá uno nuevo.
.PARAMETER Reiniciar
  Deja todo como recién instalado: borra el PIN, el nombre de la iglesia y la llave de visor, y la
  próxima vez que se abra la app borra también lo guardado en el navegador. Pide confirmación.
.PARAMETER NoAbrir
  No abre el navegador al arrancar.
.PARAMETER Ayuda
  Muestra esta ayuda.

.EXAMPLE
  .\serve.ps1
.EXAMPLE
  .\serve.ps1 -Puerto 4000
.EXAMPLE
  .\serve.ps1 -Red
.EXAMPLE
  .\serve.ps1 -RestablecerPin
#>
[CmdletBinding()]
param(
  [int]$Puerto = 3737,
  [int]$SesionMin = 720,
  [switch]$Red,
  [switch]$RestablecerPin,
  [Alias('Reset', 'BorrarTodo')][switch]$Reiniciar,
  [switch]$NoAbrir,
  [Alias('h', 'help', 'ayuda')][switch]$Ayuda
)

Set-StrictMode -Version 2
$ErrorActionPreference = 'Stop'

function Show-Ayuda {
  Write-Host @"
Biblia - servidor local para Windows

USO
  iniciar-windows.cmd [opciones]      (o: powershell -File serve.ps1 [opciones])

OPCIONES
  (sin nada)        Abre la app en http://localhost:3737, solo en este equipo.
  -Puerto 4000      Usa otro puerto (entre 1024 y 65535).
  -SesionMin 30     Minutos sin usar la consola antes de volver a pedir el PIN
                    (por defecto 720 = 12 horas).
  -Red              Deja que otro equipo de la red vea la salida para OBS.
                    Desde la red solo se puede VER (con la llave de visor que se
                    muestra al arrancar); el control sigue siendo solo de este equipo.
  -RestablecerPin   Borra el PIN si lo olvidaste. Al abrir la app pedirá uno nuevo.
  -Reiniciar        Deja todo como recién instalado: borra el PIN, el nombre de la
                    iglesia y la llave de visor, y la próxima vez que se abra la app
                    borra también lo guardado en el navegador (canciones,
                    presentaciones, imágenes, apariencia...). Pide confirmación.
  -NoAbrir          No abre el navegador al arrancar.
  -Ayuda            Muestra esta ayuda.

SEGURIDAD
  - Por defecto el servidor solo escucha en este equipo: un escaneo de la red no lo ve.
  - La consola no se entrega sin PIN: antes de entrar solo existe la portada.
  - La consola pide un PIN cada vez que se enciende el servidor o tras 12 horas sin usarla.
    Si la sesión se cierra, lo que está en vivo sigue en pantalla y en OBS; al volver a
    entrar, todo continúa. El PIN no viaja ni se guarda tal cual: el navegador lo deriva
    (PBKDF2) y aquí solo queda un resumen.
  - Cada orden lleva la firma de la llave de este navegador (ECDSA P-256, no se puede
    exportar ni copiar). Una petición capturada no sirve para repetirla ni para cambiarla.
  - Tras 5 PIN equivocados hay que esperar, cada vez más.

DETENER
  Ctrl+C o cierra esta ventana.
"@
}

if ($Ayuda) { Show-Ayuda; exit 0 }
if ($Puerto -lt 1024 -or $Puerto -gt 65535) { Write-Host "Puerto inválido: $Puerto (usa uno entre 1024 y 65535)"; exit 1 }

$Root = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\')
$Conf = Join-Path $env:APPDATA 'Biblia'
if ($env:BIBLIA_CONF_DIR) { $Conf = $env:BIBLIA_CONF_DIR }
New-Item -ItemType Directory -Force -Path $Conf | Out-Null
$PinFile = Join-Path $Conf 'pin'
$ViewerFile = Join-Path $Conf 'viewer.key'

if ($Reiniciar) {
  Write-Host 'Esto deja la app como recién instalada:'
  Write-Host '  - se borran el PIN, el nombre de la iglesia y la llave de visor de OBS;'
  Write-Host '  - la próxima vez que se abra la app en este equipo se borrará también lo guardado'
  Write-Host '    en el navegador: canciones, carpetas, presentaciones, imágenes, videos y apariencia.'
  $ok = Read-Host 'Para confirmar escribe BORRAR'
  if ($ok -ceq 'BORRAR') { Remove-Item -Recurse -Force $Conf; Write-Host 'Hecho. Abre iniciar-windows.cmd y la app empezará desde cero.' } else { Write-Host 'No se borró nada.' }
  exit 0
}

if ($RestablecerPin) {
  if (-not (Test-Path $PinFile)) { Write-Host 'No hay ningún PIN guardado.'; exit 0 }
  $ok = Read-Host '¿Seguro que quieres borrar el PIN? La próxima vez que abras la app tendrás que crear otro. (s/N)'
  if ($ok -match '^(s|si|sí)$') { Remove-Item -Force $PinFile; Write-Host 'PIN borrado.' } else { Write-Host 'No se borró nada.' }
  exit 0
}

# ───────────── Criptografía (.NET de Windows) ─────────────
$Rng = [Security.Cryptography.RandomNumberGenerator]::Create()
function ConvertTo-Hex([byte[]]$b) { return ([BitConverter]::ToString($b)).Replace('-', '').ToLowerInvariant() }
function New-RandomHex([int]$n) { $b = New-Object byte[] $n; $Rng.GetBytes($b); return (ConvertTo-Hex $b) }
function Get-Sha256Hex([byte[]]$b) {
  $h = [Security.Cryptography.SHA256]::Create()
  try { return (ConvertTo-Hex $h.ComputeHash($b)) } finally { $h.Dispose() }
}
function ConvertFrom-Hex([string]$s) {
  $b = New-Object byte[] ($s.Length / 2)
  for ($i = 0; $i -lt $b.Length; $i++) { $b[$i] = [Convert]::ToByte($s.Substring($i * 2, 2), 16) }
  return , $b
}

# Llave pública P-256 en formato SPKI (91 bytes): cabecera fija + 0x04 + X + Y.
$SpkiPrefix = ConvertFrom-Hex '3059301306072a8648ce3d020106082a8648ce3d030107034200'
function New-Verifier([byte[]]$spki) {
  if ($spki.Length -ne 91 -or $spki[26] -ne 4) { return $null }
  for ($i = 0; $i -lt 26; $i++) { if ($spki[$i] -ne $SpkiPrefix[$i]) { return $null } }
  $x = New-Object byte[] 32; $y = New-Object byte[] 32
  [Array]::Copy($spki, 27, $x, 0, 32); [Array]::Copy($spki, 59, $y, 0, 32)
  try {
    # CNG (todas las versiones de Windows con PowerShell 5.1).
    $blob = New-Object byte[] 72
    [Array]::Copy([BitConverter]::GetBytes([uint32]0x31534345), 0, $blob, 0, 4)   # «ECS1»
    [Array]::Copy([BitConverter]::GetBytes([uint32]32), 0, $blob, 4, 4)
    [Array]::Copy($x, 0, $blob, 8, 32); [Array]::Copy($y, 0, $blob, 40, 32)
    $key = [Security.Cryptography.CngKey]::Import($blob, [Security.Cryptography.CngKeyBlobFormat]::EccPublicBlob)
    $ec = New-Object Security.Cryptography.ECDsaCng($key)
    $ec.HashAlgorithm = [Security.Cryptography.CngAlgorithm]::Sha256
    return $ec
  } catch {
    $p = New-Object Security.Cryptography.ECParameters
    $p.Curve = [Security.Cryptography.ECCurve]::CreateFromFriendlyName('nistP256')
    $q = New-Object Security.Cryptography.ECPoint
    $q.X = $x; $q.Y = $y
    $p.Q = $q
    return [Security.Cryptography.ECDsa]::Create($p)
  }
}

# Firma DER (r, s) → r‖s de 64 bytes, que es lo que espera .NET.
function ConvertFrom-DerSignature([byte[]]$der) {
  try {
    if ($der[0] -ne 0x30) { return $null }
    $pos = 2
    $out = New-Object byte[] 64
    for ($part = 0; $part -lt 2; $part++) {
      if ($der[$pos] -ne 0x02) { return $null }
      $len = $der[$pos + 1]; $pos += 2
      $start = $pos; $n = $len
      while ($n -gt 32 -and $der[$start] -eq 0) { $start++; $n-- }
      if ($n -gt 32) { return $null }
      [Array]::Copy($der, $start, $out, $part * 32 + (32 - $n), $n)
      $pos += $len
    }
    return , $out
  } catch { return $null }
}

function Test-EcSignature($ec, [byte[]]$data, [byte[]]$sig) {
  if ($ec -is [Security.Cryptography.ECDsaCng]) { return $ec.VerifyData($data, $sig) }
  return $ec.VerifyData($data, $sig, [Security.Cryptography.HashAlgorithmName]::SHA256)
}

if (-not (Test-Path $ViewerFile) -or (Get-Content -Raw $ViewerFile).Trim().Length -ne 32) { Set-Content -NoNewline -Path $ViewerFile -Value (New-RandomHex 16) }
$Viewer = (Get-Content -Raw $ViewerFile).Trim()
# Identifica esta instalación: si cambia (tras -Reiniciar), la app borra lo guardado en el navegador.
$InstallFile = Join-Path $Conf 'install.id'
if (-not (Test-Path $InstallFile) -or (Get-Content -Raw $InstallFile).Trim().Length -ne 32) { Set-Content -NoNewline -Path $InstallFile -Value (New-RandomHex 16) }
$Install = (Get-Content -Raw $InstallFile).Trim()
$NameFile = Join-Path $Conf 'iglesia'
function Get-ChurchName { if (Test-Path $NameFile) { return (Get-Content -Raw $NameFile).Trim() } return '' }

# ───────────── Estado del servidor (en memoria; dura lo que dure encendido) ─────────────
$Run = Join-Path ([IO.Path]::GetTempPath()) ('biblia-' + (New-RandomHex 6))
New-Item -ItemType Directory -Force -Path $Run | Out-Null
$Devices = @{}            # id → @{ Ec = verificador ECDSA; Since = hora de entrada }
if ($SesionMin -lt 1) { Write-Host 'SesionMin debe ser 1 o más minutos.'; exit 1 }
$Nonces = @{}             # número de un solo uso → hora
$Media = @{}              # id → @{ Path; Type }
$script:LiveJson = 'null'
$script:Rev = 0
$script:FailCount = 0
$script:FailUntil = [DateTime]::MinValue

$LanIps = @()
if ($Red) {
  try {
    $LanIps = @([Net.Dns]::GetHostAddresses([Net.Dns]::GetHostName()) |
      Where-Object { $_.AddressFamily -eq 'InterNetwork' -and -not [Net.IPAddress]::IsLoopback($_) } |
      ForEach-Object { $_.ToString() })
  } catch { $LanIps = @() }
}
$AllowedHosts = @("localhost:$Puerto", "127.0.0.1:$Puerto", "[::1]:$Puerto") + @($LanIps | ForEach-Object { "${_}:$Puerto" })
$AllowedOrigins = @("http://localhost:$Puerto", "http://127.0.0.1:$Puerto", "http://[::1]:$Puerto")

$Csp = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' data: blob:; connect-src 'self' https://itunes.apple.com https://lrclib.net https://raw.githubusercontent.com; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
$SecHeaders = [ordered]@{
  'X-Content-Type-Options' = 'nosniff'
  'X-Frame-Options' = 'DENY'
  'Referrer-Policy' = 'no-referrer'
  'Permissions-Policy' = 'camera=(), microphone=(), geolocation=(), usb=(), payment=()'
  'Cross-Origin-Opener-Policy' = 'same-origin'
  'Cross-Origin-Resource-Policy' = 'same-origin'
  'Content-Security-Policy' = $Csp
}
$Mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'application/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'; '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'
  '.jpeg' = 'image/jpeg'; '.gif' = 'image/gif'; '.webp' = 'image/webp'; '.ico' = 'image/x-icon'; '.woff2' = 'font/woff2'
  '.txt' = 'text/plain; charset=utf-8'
}
$MediaTypes = @('image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'video/mp4', 'video/webm', 'video/quicktime', 'video/ogg',
  'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/flac')

# ───────────── HTTP mínimo sobre TCP ─────────────
# Un solo hilo con un bucle de eventos: pocos recursos y sin dependencias. Cada conexión es un
# pequeño autómata (leer cabecera → leer cuerpo → responder / esperar / enviar archivo).
$MaxHeader = 16384
$MaxConns = 64

function Close-Conn($c) {
  if ($c.Phase -eq 'closed') { return }
  $c.Phase = 'closed'
  foreach ($d in @($c.File, $c.BodyFile, $c.Stream, $c.Client)) { if ($d) { try { $d.Dispose() } catch {} } }
  if ($c.BodyPath -and (Test-Path $c.BodyPath)) { Remove-Item -Force $c.BodyPath -ErrorAction SilentlyContinue }
}

function Send-Head($c, [int]$code, [string]$reason, $headers, [long]$length) {
  $sb = New-Object Text.StringBuilder
  [void]$sb.Append("HTTP/1.1 $code $reason`r`n")
  foreach ($k in $SecHeaders.Keys) { [void]$sb.Append("${k}: $($SecHeaders[$k])`r`n") }
  foreach ($k in $headers.Keys) { [void]$sb.Append("${k}: $($headers[$k])`r`n") }
  [void]$sb.Append("Content-Length: $length`r`nConnection: close`r`n`r`n")
  $bytes = [Text.Encoding]::ASCII.GetBytes($sb.ToString())
  $c.Stream.Write($bytes, 0, $bytes.Length)
}

function Send-Bytes($c, [int]$code, [string]$reason, $headers, [byte[]]$body) {
  try {
    Send-Head $c $code $reason $headers $body.Length
    if ($body.Length) { $c.Stream.Write($body, 0, $body.Length) }
  } catch {}
  Close-Conn $c
}

function Send-Json($c, [int]$code, [string]$reason, [string]$json) {
  Send-Bytes $c $code $reason @{ 'Content-Type' = 'application/json'; 'Cache-Control' = 'no-store' } ([Text.Encoding]::UTF8.GetBytes($json))
}

function Send-File($c, [string]$path, [string]$type, [string]$cache, $extra) {
  $c.File = [IO.File]::OpenRead($path)
  $h = @{ 'Content-Type' = $type; 'Cache-Control' = $cache }
  if ($extra) { foreach ($k in $extra.Keys) { $h[$k] = $extra[$k] } }
  try { Send-Head $c 200 'OK' $h $c.File.Length } catch { Close-Conn $c; return }
  $c.Phase = 'send'
}

function Get-Query($c, [string]$name) {
  foreach ($pair in $c.Query.Split('&')) {
    $kv = $pair.Split('=', 2)
    if ($kv[0] -eq $name -and $kv.Length -eq 2) { return [Uri]::UnescapeDataString($kv[1]) }
  }
  return ''
}

function Get-JsonField($c, [string]$name) {
  $m = [regex]::Match($c.BodyText, '"' + $name + '"\s*:\s*"([A-Za-z0-9+/=_-]*)"')
  if ($m.Success) { return $m.Groups[1].Value }
  return ''
}

function Test-Loopback($c) { return [Net.IPAddress]::IsLoopback($c.Client.Client.RemoteEndPoint.Address) }
function Test-Origin($c) { return $AllowedOrigins -contains $c.Headers['origin'] }

function Get-WaitLeft {
  $left = [int][Math]::Ceiling(($script:FailUntil - [DateTime]::UtcNow).TotalSeconds)
  if ($left -gt 0) { return $left }
  return 0
}
function Add-Failure {
  $script:FailCount++
  if ($script:FailCount -ge 5) {
    $secs = [Math]::Min(900, 30 * [Math]::Pow(2, $script:FailCount - 5))
    $script:FailUntil = [DateTime]::UtcNow.AddSeconds($secs)
  }
}

function Get-StoredPin {
  if (-not (Test-Path $PinFile)) { return $null }
  $parts = (Get-Content -Raw $PinFile).Trim().Split(' ')
  if ($parts.Length -ne 2) { return $null }
  return @{ Salt = $parts[0]; Hash = $parts[1] }
}
function Set-StoredPin([string]$salt, [string]$verifier) {
  $tmp = "$PinFile.tmp"
  Set-Content -NoNewline -Path $tmp -Value ("$salt " + (Get-Sha256Hex ([Text.Encoding]::ASCII.GetBytes($verifier))))
  Move-Item -Force $tmp $PinFile
}

function Register-Device([string]$pub) {
  if ($pub -notmatch '^[A-Za-z0-9+/=]{100,200}$') { return $null }
  try { $spki = [Convert]::FromBase64String($pub) } catch { return $null }
  $ec = New-Verifier $spki
  if (-not $ec) { return $null }
  $id = (Get-Sha256Hex $spki).Substring(0, 32)
  $Devices[$id] = @{ Ec = $ec; Since = [DateTime]::UtcNow }
  return $id
}

# Firma de la petición: MÉTODO · ruta con consulta · hora · número de un solo uso · SHA-256 del cuerpo.
function Test-Signature($c) {
  $dev = [string]$c.Headers['x-biblia-device']; $ts = [string]$c.Headers['x-biblia-time']
  $nonce = [string]$c.Headers['x-biblia-nonce']; $sig = [string]$c.Headers['x-biblia-signature']
  if ($dev -notmatch '^[0-9a-f]{32}$' -or $nonce -notmatch '^[0-9a-f]{32}$' -or $ts -notmatch '^[0-9]{9,11}$' -or $sig -notmatch '^[A-Za-z0-9+/=]{60,120}$') { return 'firma' }
  if (-not $Devices.ContainsKey($dev)) { return 'sesion' }
  if (([DateTime]::UtcNow - $Devices[$dev].Since).TotalMinutes -gt $SesionMin) { $Devices.Remove($dev); return 'caducada' }
  $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  if ([Math]::Abs($now - [long]$ts) -gt 120) { return 'hora' }
  if ($Nonces.ContainsKey($nonce)) { return 'repetida' }
  $raw = ConvertFrom-DerSignature ([Convert]::FromBase64String($sig))
  if (-not $raw) { return 'firma' }
  $msg = [Text.Encoding]::UTF8.GetBytes("$($c.Method)`n$($c.Target)`n$ts`n$nonce`n$($c.BodyHash)")
  if (-not (Test-EcSignature $Devices[$dev].Ec $msg $raw)) { return 'firma' }
  if ($Nonces.Count -gt 2000) { foreach ($k in @($Nonces.Keys)) { if ($now - $Nonces[$k] -gt 300) { $Nonces.Remove($k) } } }
  $Nonces[$nonce] = $now
  # Uso real (no la comprobación periódica de la consola): renueva la sesión.
  if ($c.Query -notmatch 'accion=comprobar') { $Devices[$dev].Since = [DateTime]::UtcNow }
  return ''
}

function Invoke-Auth($c) {
  if (-not (Test-Loopback $c)) { Send-Json $c 403 'Forbidden' '{"error":"solo-este-equipo"}'; return }
  $action = Get-Query $c 'accion'
  $pin = Get-StoredPin
  if ($c.Method -eq 'GET' -and $action -eq 'estado') {
    if ($pin) { Send-Json $c 200 'OK' ('{"configured":true,"salt":"' + $pin.Salt + '","name":"' + (Get-ChurchName) + '","install":"' + $Install + '"}') }
    else { Send-Json $c 200 'OK' ('{"configured":false,"install":"' + $Install + '"}') }
    return
  }
  if ($c.Method -ne 'POST') { Send-Json $c 404 'Not Found' '{"error":"accion"}'; return }
  if (-not (Test-Origin $c)) { Send-Json $c 403 'Forbidden' '{"error":"origen"}'; return }
  switch ($action) {
    'crear' {
      $salt = Get-JsonField $c 'salt'; $ver = Get-JsonField $c 'verifier'; $pub = Get-JsonField $c 'pub'; $name = Get-JsonField $c 'name'
      if ($salt -notmatch '^[0-9a-f]{32}$' -or $ver -notmatch '^[0-9a-f]{64}$') { Send-Json $c 400 'Bad Request' '{"error":"datos"}'; return }
      if ($name -and $name -cnotmatch '^[A-Za-z0-9_-]{1,160}$') { Send-Json $c 400 'Bad Request' '{"error":"nombre"}'; return }
      # Nunca se registra un equipo si ya hay PIN.
      if ($pin) { Send-Json $c 409 'Conflict' '{"error":"ya-hay-pin"}'; return }
      $id = Register-Device $pub
      if (-not $id) { Send-Json $c 400 'Bad Request' '{"error":"llave"}'; return }
      Set-StoredPin $salt $ver
      if ($name) { Set-Content -NoNewline -Path $NameFile -Value $name }
      Send-Json $c 200 'OK' ('{"ok":true,"device":"' + $id + '"}')
    }
    'nombre' {
      $why = Test-Signature $c
      if ($why) { Send-Json $c 401 'Unauthorized' ('{"error":"' + $why + '"}'); return }
      $name = Get-JsonField $c 'name'
      if ($name -cnotmatch '^[A-Za-z0-9_-]{1,160}$') { Send-Json $c 400 'Bad Request' '{"error":"nombre"}'; return }
      Set-Content -NoNewline -Path $NameFile -Value $name
      Send-Json $c 200 'OK' '{"ok":true}'
    }
    'entrar' {
      if (-not $pin) { Send-Json $c 409 'Conflict' '{"error":"sin-pin"}'; return }
      $left = Get-WaitLeft
      if ($left -gt 0) { Send-Json $c 429 'Too Many Requests' ('{"error":"espera","wait":' + $left + '}'); return }
      $ver = Get-JsonField $c 'verifier'; $pub = Get-JsonField $c 'pub'
      if ($ver -notmatch '^[0-9a-f]{64}$') { Send-Json $c 400 'Bad Request' '{"error":"datos"}'; return }
      if ((Get-Sha256Hex ([Text.Encoding]::ASCII.GetBytes($ver))) -ne $pin.Hash) {
        Add-Failure
        Send-Json $c 401 'Unauthorized' ('{"error":"pin","wait":' + (Get-WaitLeft) + '}'); return
      }
      $script:FailCount = 0
      $id = Register-Device $pub
      if (-not $id) { Send-Json $c 400 'Bad Request' '{"error":"llave"}'; return }
      Send-Json $c 200 'OK' ('{"ok":true,"device":"' + $id + '"}')
    }
    { $_ -in 'comprobar', 'mantener' } {
      $why = Test-Signature $c
      if ($why) { Send-Json $c 401 'Unauthorized' ('{"error":"' + $why + '"}'); return }
      Send-Json $c 200 'OK' ('{"ok":true,"viewer":"' + $Viewer + '"}')
    }
    'salir' {
      $why = Test-Signature $c
      if ($why) { Send-Json $c 401 'Unauthorized' ('{"error":"' + $why + '"}'); return }
      $Devices.Remove([string]$c.Headers['x-biblia-device'])
      Send-Json $c 200 'OK' '{"ok":true}'
    }
    'cambiar' {
      $why = Test-Signature $c
      if ($why) { Send-Json $c 401 'Unauthorized' ('{"error":"' + $why + '"}'); return }
      $cur = Get-JsonField $c 'current'; $salt = Get-JsonField $c 'salt'; $ver = Get-JsonField $c 'verifier'
      if ($cur -notmatch '^[0-9a-f]{64}$' -or $salt -notmatch '^[0-9a-f]{32}$' -or $ver -notmatch '^[0-9a-f]{64}$') { Send-Json $c 400 'Bad Request' '{"error":"datos"}'; return }
      $left = Get-WaitLeft
      if ($left -gt 0) { Send-Json $c 429 'Too Many Requests' ('{"error":"espera","wait":' + $left + '}'); return }
      if ((Get-Sha256Hex ([Text.Encoding]::ASCII.GetBytes($cur))) -ne $pin.Hash) {
        Add-Failure
        Send-Json $c 401 'Unauthorized' ('{"error":"pin","wait":' + (Get-WaitLeft) + '}'); return
      }
      $script:FailCount = 0
      Set-StoredPin $salt $ver
      # Con el PIN nuevo, los demás equipos tienen que volver a entrar.
      $me = [string]$c.Headers['x-biblia-device']
      foreach ($k in @($Devices.Keys)) { if ($k -ne $me) { $Devices.Remove($k) } }
      Send-Json $c 200 'OK' '{"ok":true}'
    }
    default { Send-Json $c 404 'Not Found' '{"error":"accion"}' }
  }
}

function Test-Viewer($c) {
  if (Test-Loopback $c) { return $true }
  return ((Get-Query $c 'k') -eq $Viewer)
}

function Send-Live($c) {
  Send-Json $c 200 'OK' ('{"rev":' + $script:Rev + ',"state":' + $script:LiveJson + '}')
}

function Invoke-Live($c) {
  if ($c.Method -eq 'POST') {
    if (-not (Test-Loopback $c)) { Send-Json $c 403 'Forbidden' '{"error":"solo-este-equipo"}'; return }
    if (-not (Test-Origin $c)) { Send-Json $c 403 'Forbidden' '{"error":"origen"}'; return }
    $why = Test-Signature $c
    if ($why) { Send-Json $c 401 'Unauthorized' ('{"error":"' + $why + '"}'); return }
    $script:LiveJson = $c.BodyText
    $script:Rev++
    Send-Bytes $c 204 'No Content' @{} (New-Object byte[] 0)
    return
  }
  if ($c.Method -ne 'GET') { Send-Json $c 405 'Method Not Allowed' '{"error":"metodo"}'; return }
  if (-not (Test-Viewer $c)) { Send-Json $c 403 'Forbidden' '{"error":"visor"}'; return }
  $want = Get-Query $c 'rev'
  if ($want -match '^[0-9]+$' -and [int]$want -eq $script:Rev) {
    # OBS espera hasta 20 s a que cambie lo que está en vivo.
    $c.Phase = 'wait'; $c.WaitRev = $script:Rev; $c.Deadline = [DateTime]::UtcNow.AddSeconds(20)
    return
  }
  Send-Live $c
}

function Invoke-Media($c) {
  $id = Get-Query $c 'id'
  if ($id -notmatch '^[A-Za-z0-9-]{1,64}$') { Send-Json $c 400 'Bad Request' '{"error":"id"}'; return }
  if ($c.Method -eq 'POST') {
    if (-not (Test-Loopback $c)) { Send-Json $c 403 'Forbidden' '{"error":"solo-este-equipo"}'; return }
    if (-not (Test-Origin $c)) { Send-Json $c 403 'Forbidden' '{"error":"origen"}'; return }
    $type = ([string]$c.Headers['content-type']).Split(';')[0].Trim().ToLowerInvariant()
    if ($MediaTypes -notcontains $type) { Send-Json $c 415 'Unsupported Media Type' '{"error":"tipo"}'; return }
    $why = Test-Signature $c
    if ($why) { Send-Json $c 401 'Unauthorized' ('{"error":"' + $why + '"}'); return }
    $dest = Join-Path $Run "media-$id"
    $c.BodyFile.Dispose(); $c.BodyFile = $null
    Move-Item -Force $c.BodyPath $dest
    $c.BodyPath = $null
    $Media[$id] = @{ Path = $dest; Type = $type }
    Send-Bytes $c 204 'No Content' @{} (New-Object byte[] 0)
    return
  }
  if ($c.Method -ne 'GET') { Send-Json $c 405 'Method Not Allowed' '{"error":"metodo"}'; return }
  if (-not (Test-Viewer $c)) { Send-Json $c 403 'Forbidden' '{"error":"visor"}'; return }
  if (-not $Media.ContainsKey($id)) { Send-Json $c 404 'Not Found' '{"error":"no-existe"}'; return }
  Send-File $c $Media[$id].Path $Media[$id].Type 'private, max-age=3600' @{ 'Content-Security-Policy' = "sandbox; default-src 'none'"; 'Content-Disposition' = 'inline' }
}

# La consola (su HTML) solo se entrega a un equipo que entró con el PIN.
function Invoke-App($c) {
  if (-not (Test-Loopback $c)) { Send-Json $c 403 'Forbidden' '{"error":"solo-este-equipo"}'; return }
  if ($c.Method -ne 'POST') { Send-Json $c 405 'Method Not Allowed' '{"error":"metodo"}'; return }
  if (-not (Test-Origin $c)) { Send-Json $c 403 'Forbidden' '{"error":"origen"}'; return }
  $why = Test-Signature $c
  if ($why) { Send-Json $c 401 'Unauthorized' ('{"error":"' + $why + '"}'); return }
  Send-File $c (Join-Path $Root 'console.html') 'text/html; charset=utf-8' 'no-store' $null
}

function Invoke-Static($c) {
  if ($c.Method -ne 'GET' -and $c.Method -ne 'HEAD') { Send-Json $c 405 'Method Not Allowed' '{"error":"metodo"}'; return }
  $path = [Uri]::UnescapeDataString($c.Path)
  if ($path -eq '/') { $path = '/index.html' }
  $segments = $path.TrimStart('/').Split('/')
  $denied = $path.Contains('\') -or $path.Contains(':') -or $path.Contains([char]0) -or
    ($segments | Where-Object { $_ -eq '' -or $_.StartsWith('.') }) -or $segments[0] -eq 'server' -or
    $path -match '\.(sh|ps1|cmd|bat|md|bak|log)$' -or $path -eq '/console.html'
  if ($denied) { Send-Json $c 403 'Forbidden' '{"error":"prohibido"}'; return }
  $full = [IO.Path]::GetFullPath((Join-Path $Root ($path.TrimStart('/').Replace('/', '\'))))
  $ext = [IO.Path]::GetExtension($full).ToLowerInvariant()
  if (-not $full.StartsWith($Root + '\', [StringComparison]::OrdinalIgnoreCase) -or -not $Mime.ContainsKey($ext) -or -not (Test-Path -LiteralPath $full -PathType Leaf)) {
    Send-Json $c 404 'Not Found' '{"error":"no-existe"}'; return
  }
  Send-File $c $full $Mime[$ext] 'no-cache' $null
}

function Invoke-Request($c) {
  # Contra el «DNS rebinding»: solo se responde si se pide por el nombre de este equipo.
  if ($AllowedHosts -notcontains $c.Headers['host']) { Send-Json $c 421 'Misdirected Request' '{"error":"host"}'; return }
  # Sin -Red, nada de otros equipos (el puerto ni siquiera escucha en la red, pero por si acaso).
  if (-not $Red -and -not (Test-Loopback $c)) { Send-Json $c 403 'Forbidden' '{"error":"solo-este-equipo"}'; return }
  switch ($c.Path) {
    '/api/auth' { Invoke-Auth $c }
    '/api/live' { Invoke-Live $c }
    '/api/media' { Invoke-Media $c }
    '/api/app' { Invoke-App $c }
    default { Invoke-Static $c }
  }
}

# Cabecera completa: método, destino, cabeceras y cómo leer el cuerpo.
function Start-Request($c, [byte[]]$data, [int]$headEnd) {
  $text = [Text.Encoding]::ASCII.GetString($data, 0, $headEnd)
  $lines = $text.Split("`n") | ForEach-Object { $_.TrimEnd("`r") }
  $first = $lines[0].Split(' ')
  if ($first.Length -ne 3 -or -not $first[1].StartsWith('/')) { Send-Json $c 400 'Bad Request' '{"error":"peticion"}'; return }
  $c.Method = $first[0]; $c.Target = $first[1]
  $q = $c.Target.IndexOf('?')
  if ($q -ge 0) { $c.Path = $c.Target.Substring(0, $q); $c.Query = $c.Target.Substring($q + 1) } else { $c.Path = $c.Target; $c.Query = '' }
  $c.Headers = @{}
  foreach ($line in ($lines | Select-Object -Skip 1)) {
    $i = $line.IndexOf(':')
    if ($i -gt 0) { $c.Headers[$line.Substring(0, $i).Trim().ToLowerInvariant()] = $line.Substring($i + 1).Trim() }
  }
  $len = 0
  if ($c.Headers.ContainsKey('content-length')) {
    if ($c.Headers['content-length'] -notmatch '^[0-9]{1,10}$') { Send-Json $c 400 'Bad Request' '{"error":"longitud"}'; return }
    $len = [long]$c.Headers['content-length']
  }
  if ($c.Headers.ContainsKey('transfer-encoding')) { Send-Json $c 411 'Length Required' '{"error":"longitud"}'; return }
  $limit = 1048576
  if ($c.Path -eq '/api/media') { $limit = 1073741824 }
  if ($len -gt $limit) { Send-Json $c 413 'Payload Too Large' '{"error":"grande"}'; return }
  $c.Remaining = $len
  $c.Hasher = [Security.Cryptography.SHA256]::Create()
  if ($c.Path -eq '/api/media' -and $len -gt 0) {
    $c.BodyPath = Join-Path $Run ('up-' + (New-RandomHex 8))
    $c.BodyFile = [IO.File]::Create($c.BodyPath)
  } else {
    $c.BodyMem = New-Object IO.MemoryStream
  }
  $c.Phase = 'body'
  $rest = $data.Length - ($headEnd + 4)
  if ($rest -gt 0) { Add-Body $c $data ($headEnd + 4) ([int][Math]::Min($rest, $len)) }
  if ($c.Remaining -le 0) { Complete-Body $c }
}

function Add-Body($c, [byte[]]$buf, [int]$offset, [int]$count) {
  if ($count -le 0) { return }
  [void]$c.Hasher.TransformBlock($buf, $offset, $count, $null, 0)
  if ($c.BodyFile) { $c.BodyFile.Write($buf, $offset, $count) } else { $c.BodyMem.Write($buf, $offset, $count) }
  $c.Remaining -= $count
}

function Complete-Body($c) {
  [void]$c.Hasher.TransformFinalBlock((New-Object byte[] 0), 0, 0)
  $c.BodyHash = ConvertTo-Hex $c.Hasher.Hash
  $c.Hasher.Dispose()
  if ($c.BodyFile) { $c.BodyFile.Flush() } else { $c.BodyText = [Text.Encoding]::UTF8.GetString($c.BodyMem.ToArray()) }
  $c.Phase = 'handle'
  try { Invoke-Request $c } catch { Send-Json $c 500 'Internal Server Error' '{"error":"servidor"}' }
}

function Step-Conn($c) {
  $did = $false
  switch ($c.Phase) {
    'head' {
      if ($c.Stream.DataAvailable) {
        $buf = New-Object byte[] 8192
        $n = $c.Stream.Read($buf, 0, $buf.Length)
        if ($n -le 0) { Close-Conn $c; return $true }
        $c.Head.Write($buf, 0, $n)
        $data = $c.Head.ToArray()
        $text = [Text.Encoding]::ASCII.GetString($data)
        $end = $text.IndexOf("`r`n`r`n")
        if ($end -ge 0) { Start-Request $c $data $end }
        elseif ($data.Length -gt $MaxHeader) { Send-Json $c 431 'Request Header Fields Too Large' '{"error":"cabecera"}' }
        $did = $true
      } elseif (([DateTime]::UtcNow - $c.Since).TotalSeconds -gt 10) { Close-Conn $c }
    }
    'body' {
      if ($c.Stream.DataAvailable) {
        $buf = New-Object byte[] 262144
        $n = $c.Stream.Read($buf, 0, [int][Math]::Min($buf.Length, $c.Remaining))
        if ($n -le 0) { Close-Conn $c; return $true }
        Add-Body $c $buf 0 $n
        if ($c.Remaining -le 0) { Complete-Body $c }
        $c.Since = [DateTime]::UtcNow
        $did = $true
      } elseif (([DateTime]::UtcNow - $c.Since).TotalSeconds -gt 30) { Close-Conn $c }
    }
    'wait' {
      if ($script:Rev -ne $c.WaitRev -or [DateTime]::UtcNow -gt $c.Deadline) { Send-Live $c; $did = $true }
    }
    'send' {
      $buf = New-Object byte[] 262144
      $n = $c.File.Read($buf, 0, $buf.Length)
      if ($n -gt 0) { try { $c.Stream.Write($buf, 0, $n) } catch { Close-Conn $c; return $true } }
      if ($n -lt $buf.Length) { Close-Conn $c }
      $did = $true
    }
  }
  return $did
}

# ───────────── Arranque ─────────────
$listeners = @()
$bindAddr = [Net.IPAddress]::Loopback
if ($Red) { $bindAddr = [Net.IPAddress]::Any }
try {
  $l4 = New-Object Net.Sockets.TcpListener($bindAddr, $Puerto)
  $l4.Server.ExclusiveAddressUse = $true
  $l4.Start()
  $listeners += $l4
} catch {
  Write-Host "El puerto $Puerto ya está en uso. Prueba con otro: iniciar-windows.cmd -Puerto $($Puerto + 1)"
  exit 1
}
try {
  $l6 = New-Object Net.Sockets.TcpListener([Net.IPAddress]::IPv6Loopback, $Puerto)
  $l6.Start()
  $listeners += $l6
} catch {}

$Url = "http://localhost:$Puerto"
Write-Host '=============================================='
Write-Host '  Biblia · by @jairohm.dev'
Write-Host '=============================================='
Write-Host "  App       : $Url"
Write-Host "  OBS       : $Url/?salida&obs"
Write-Host '  OBS (solo texto, fondo transparente):'
Write-Host "              $Url/?salida&obs&transparente"
if ($Red) {
  foreach ($ip in $LanIps) { Write-Host "  OBS en otro equipo de la red (solo ver):`n              http://${ip}:$Puerto/?salida&obs&k=$Viewer" }
  Write-Host '  Si Windows pregunta por el firewall, permite el acceso solo en redes PRIVADAS.'
}
Write-Host "  Sesión    : se pide el PIN tras $SesionMin min sin usar la consola"
Write-Host '  Ayuda     : iniciar-windows.cmd -Ayuda'
Write-Host '  Detener   : Ctrl+C o cierra esta ventana'
Write-Host '=============================================='
if (-not $NoAbrir) { Start-Process $Url }

$conns = New-Object Collections.ArrayList
try {
  while ($true) {
    $busy = $false
    foreach ($l in $listeners) {
      while ($l.Pending() -and $conns.Count -lt $MaxConns) {
        $client = $l.AcceptTcpClient()
        $client.NoDelay = $true
        $client.SendTimeout = 15000
        [void]$conns.Add(@{
            Client = $client; Stream = $client.GetStream(); Head = New-Object IO.MemoryStream; Phase = 'head'; Since = [DateTime]::UtcNow
            Method = ''; Target = ''; Path = ''; Query = ''; Headers = @{}; Remaining = 0; Hasher = $null; BodyMem = $null
            BodyFile = $null; BodyPath = $null; BodyText = ''; BodyHash = ''; File = $null; WaitRev = 0; Deadline = [DateTime]::MinValue
          })
        $busy = $true
      }
    }
    foreach ($c in @($conns)) {
      try { if (Step-Conn $c) { $busy = $true } } catch { Close-Conn $c }
      if ($c.Phase -eq 'closed') { $conns.Remove($c) }
    }
    if (-not $busy) { Start-Sleep -Milliseconds 15 }
  }
} finally {
  foreach ($c in @($conns)) { Close-Conn $c }
  foreach ($l in $listeners) { try { $l.Stop() } catch {} }
  Remove-Item -Recurse -Force $Run -ErrorAction SilentlyContinue
}
