<#
.SYNOPSIS
  Biblia - servidor para Windows. Usa PowerShell y .NET, incluidos en Windows 10 y 11.

.DESCRIPTION
  Haz doble clic en «iniciar-windows.cmd» para abrir el menú de Biblia.
  Al iniciar con el menú, Biblia abre http://localhost:3737 o el siguiente puerto disponible.

  SEGURIDAD
  - La llave del enlace da acceso de solo lectura a la proyección en la red local.
  - La consola pide un PIN cada vez que se enciende el servidor o tras 12 horas sin usarla. Si la sesión
    se cierra, lo que está en vivo sigue en pantalla y en OBS. El PIN no viaja ni se guarda tal cual:
    el navegador lo deriva (PBKDF2) y aquí solo queda un resumen.
  - Cada orden lleva la firma de la llave del navegador (ECDSA P-256, no se puede exportar ni copiar):
    una petición capturada no sirve para repetirla ni para cambiarla.
  - Tras 5 PIN equivocados hay que esperar, cada vez más.

.PARAMETER Puerto
  Puerto fijo para la app, el panel HTTPS y el visor. Si se omite, usa 3737 o el siguiente disponible.
.PARAMETER SesionMin
  Minutos sin usar la consola tras los que se vuelve a pedir el PIN. Por defecto 720 (12 horas).
.PARAMETER Red
  Habilita el visor en la red local desde el arranque.
.PARAMETER SoloLocal
  Limita el acceso al equipo que ejecuta el servidor.
.PARAMETER Internet
  Crea un enlace HTTPS temporal con Cloudflare para acceder al panel desde fuera de la red.
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
  [switch]$Red = ($env:BIBLIA_RED -eq '1'),
  [string]$OrigenRemoto = $env:BIBLIA_ORIGEN_REMOTO,
  [switch]$RestablecerPin,
  [Alias('Reset', 'BorrarTodo')][switch]$Reiniciar,
  [switch]$NoAbrir,
  [Alias('h', 'help')][switch]$Ayuda,
  [switch]$SoloLocal,
  [switch]$Menu,
  [switch]$PanelRed,
  [int]$PuertoPanel,
  [string]$CertificadoPanel,
  [switch]$Internet
)

Set-StrictMode -Version 2
$ErrorActionPreference = 'Stop'
$interactive = -not [Console]::IsInputRedirected
$pauseOnError = $interactive -and ($Menu -or $PSBoundParameters.Count -eq 0) -and $env:BIBLIA_LANZADOR_CMD -ne '1'

trap {
  Write-Host ''
  Write-Host 'Biblia se detuvo.' -ForegroundColor Red
  Write-Host $_.Exception.Message
  if ($pauseOnError) { [void](Read-Host 'Pulsa Intro para cerrar') }
  exit 1
}

function Show-Ayuda {
  Write-Host @"
Biblia - servidor local para Windows

USO
  iniciar-windows.cmd [opciones]      (o: powershell -File serve.ps1 [opciones])

OPCIONES
  (sin nada)        Muestra el menú y ofrece iniciar Biblia en http://localhost:3737
                    o en el siguiente puerto disponible.
  -Menu             Abre el menú de inicio.
  -PanelRed         Habilita el panel con PIN por HTTPS en las IP de este equipo.
  -Internet         Crea un enlace HTTPS temporal con Cloudflare para entrar desde fuera.
  -CertificadoPanel Ruta de un certificado PFX para las IP del panel.
                    Introduce su contraseña cuando el programa la solicite.
  -Puerto 4000      Usa un puerto fijo para la app, el panel HTTPS y el visor.
  -SesionMin 30     Minutos sin usar la consola antes de volver a pedir el PIN
                    (por defecto 720 = 12 horas).
  -Red              Habilita el visor en la red local desde el arranque.
  -SoloLocal        Limita el acceso al equipo que ejecuta el servidor.
  -OrigenRemoto https://biblia.tu-dominio.com
                    Autoriza ese dominio HTTPS por un túnel local; requiere PIN previo.
  -RestablecerPin   Borra el PIN si lo olvidaste. Al abrir la app pedirá uno nuevo.
  -Reiniciar        Deja todo como recién instalado: borra el PIN, el nombre de la
                    iglesia y la llave de visor, y la próxima vez que se abra la app
                    borra también lo guardado en el navegador (canciones,
                    presentaciones, imágenes, apariencia...). Pide confirmación.
  -NoAbrir          No abre el navegador al arrancar.
  -Ayuda            Muestra esta ayuda.

SEGURIDAD
  - La llave del enlace da acceso de solo lectura a la proyección en la red local.
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
$changePinOnStart = $false
if ($Menu -or ($PSBoundParameters.Count -eq 0 -and $interactive -and -not $OrigenRemoto)) {
  while ($true) {
    Write-Host ''
    Write-Host 'Biblia'
    Write-Host '  1. Iniciar'
    Write-Host '  2. Cambiar PIN'
    $opcion = Read-Host 'Elige una opción [1]'
    if ($null -eq $opcion -or $opcion -eq '0') { exit 0 }
    if ($opcion -in '', '1', '2') { break }
    Write-Host 'Elige una de las opciones del menú.'
  }
  if ($opcion -eq '2') { $changePinOnStart = $true }
}
if ($PanelRed -and $SoloLocal) {
  throw 'Elige -PanelRed para compartir el panel o -SoloLocal para usar solo esta PC.'
}
if ($PanelRed) { $Red = $true }
if ($SoloLocal) { $Red = $false }
if ($Internet -and -not $PanelRed -and -not $PSBoundParameters.ContainsKey('Red')) { $Red = $false }
# Compatibilidad con los comandos anteriores que fijaban solo el puerto del panel.
$fixedPort = $PSBoundParameters.ContainsKey('Puerto')
if ($PanelRed -and -not $fixedPort -and $PSBoundParameters.ContainsKey('PuertoPanel')) {
  $Puerto = $PuertoPanel
  $fixedPort = $true
}
if ($Puerto -lt 1024 -or $Puerto -gt 65535) {
  throw "Puerto inválido: $Puerto (usa uno entre 1024 y 65535)"
}

$RemoteHost = ''
$RemoteAccess = ''
$PublicPanelUrl = ''
if ($Internet) { $OrigenRemoto = '' }
if ($OrigenRemoto) {
  if ($OrigenRemoto.Length -gt 261 -or $OrigenRemoto -cnotmatch '^https://([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?$') {
    throw 'OrigenRemoto debe ser https://dominio exacto, en minúsculas, sin ruta, puerto ni comodines.'
  }
  $RemoteHost = $OrigenRemoto.Substring(8)
}

$Separator = [IO.Path]::DirectorySeparatorChar
$Root = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd($Separator)
$Conf = $env:BIBLIA_CONF_DIR
if (-not $Conf) {
  $appData = [Environment]::GetFolderPath([Environment+SpecialFolder]::ApplicationData)
  if (-not $appData) { throw 'Windows no proporcionó la carpeta de la configuración de esta cuenta.' }
  $Conf = Join-Path $appData 'Biblia'
}
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

if ($OrigenRemoto -and (-not (Test-Path $PinFile) -or (Get-Item $PinFile).Length -eq 0)) {
  throw 'Crea primero el PIN entrando por localhost, sin -OrigenRemoto ni BIBLIA_ORIGEN_REMOTO.'
}

$webFiles = @('index.html', 'console.html', 'app.js', 'auth.js', 'studio.js', 'styles.css', 'icon.svg',
  'bible_rvr1960.json', 'himnarios.json')
$missing = @($webFiles | Where-Object { -not [IO.File]::Exists((Join-Path $Root $_)) })
if ($missing.Count) {
  throw "Faltan archivos de Biblia ($($missing -join ', ')). Extrae el ZIP completo y abre iniciar-windows.cmd desde esa carpeta."
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

function Read-ConfigText([string]$path) {
  if ([IO.File]::Exists($path)) { return [IO.File]::ReadAllText($path).Trim() }
  return ''
}

function Get-OrCreateLocalId([string]$path) {
  $value = Read-ConfigText $path
  if ($value -cnotmatch '^[0-9a-f]{32}$') {
    $value = New-RandomHex 16
    Set-Content -NoNewline -LiteralPath $path -Value $value
  }
  return $value
}

$Viewer = Get-OrCreateLocalId $ViewerFile
# Identifica esta instalación para que el navegador reconozca un restablecimiento.
$Install = Get-OrCreateLocalId (Join-Path $Conf 'install.id')
$NameFile = Join-Path $Conf 'iglesia'
function Get-ChurchName { return (Read-ConfigText $NameFile) }

# ───────────── Estado del servidor (en memoria; dura lo que dure encendido) ─────────────
$Run = Join-Path ([IO.Path]::GetTempPath()) ('biblia-' + (New-RandomHex 6))
$Devices = @{}            # id → @{ Ec = verificador ECDSA; Since = hora de entrada }
if ($SesionMin -lt 1) { throw 'SesionMin debe ser 1 o más minutos.' }
$Nonces = @{}             # número de un solo uso → hora
$Media = @{}              # id → @{ Path; Type }
$script:LiveJson = 'null'
$script:Rev = 0
$script:FailCount = 0
$script:FailUntil = [DateTime]::MinValue

function Get-LanIps {
  try {
    return @([Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() |
      Where-Object { $_.OperationalStatus -eq 'Up' } |
      ForEach-Object { $_.GetIPProperties().UnicastAddresses } |
      ForEach-Object { $_.Address } |
      Where-Object { $_.AddressFamily -eq 'InterNetwork' -and -not [Net.IPAddress]::IsLoopback($_) } |
      ForEach-Object { $_.ToString() } |
      Select-Object -Unique)
  } catch { return @() }
}

$LanIps = @()
if ($Red) { $LanIps = @(Get-LanIps) }

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
  foreach ($d in @($c.File, $c.BodyFile, $c.BodyMem, $c.Head, $c.Hasher, $c.Stream, $c.Client)) { if ($d) { try { $d.Dispose() } catch {} } }
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
function Test-ConsoleAccess($c) { return $c.Panel -or (Test-Loopback $c) }
function Test-Remote($c) { return -not $c.Panel -and $RemoteHost -and $c.Headers['host'] -eq $RemoteHost }
function Test-Origin($c) {
  if ($c.Panel) { return $c.Headers['origin'] -ceq "https://$($c.Headers['host'])" }
  if (Test-Remote $c) { return $c.Headers['origin'] -ceq $OrigenRemoto }
  return $AllowedOrigins -contains $c.Headers['origin']
}

function Get-WaitLeft {
  $left = ($script:FailUntil - [DateTime]::UtcNow).TotalSeconds
  if ($left -gt 0) { return [int][Math]::Ceiling($left) }
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
  $parts = (Read-ConfigText $PinFile).Split(' ')
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
  if (-not (Test-ConsoleAccess $c)) { Send-Json $c 403 'Forbidden' '{"error":"solo-este-equipo"}'; return }
  $action = Get-Query $c 'accion'
  $pin = Get-StoredPin
  if ($c.Method -eq 'GET' -and $action -eq 'estado') {
    if ($pin) { Send-Json $c 200 'OK' ('{"configured":true,"salt":"' + $pin.Salt + '","name":"' + (Get-ChurchName) + '","install":"' + $Install + '"}') }
    else {
      $status = @{ configured = $false; install = $Install; registroLocal = ($c.Panel -or (Test-Remote $c)) }
      Send-Json $c 200 'OK' (ConvertTo-Json -Compress -InputObject $status)
    }
    return
  }
  if ($c.Method -ne 'POST') { Send-Json $c 404 'Not Found' '{"error":"accion"}'; return }
  if (-not (Test-Origin $c)) { Send-Json $c 403 'Forbidden' '{"error":"origen"}'; return }
  switch ($action) {
    'crear' {
      if ($c.Panel -or (Test-Remote $c)) { Send-Json $c 403 'Forbidden' '{"error":"registro-local"}'; return }
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
      $session = @{ ok = $true; viewer = $Viewer; lanUrls = @(); panelUrls = @() }
      if (-not (Test-Remote $c)) {
        $session.lanUrls = $LanUrls
        $session.panelUrls = $PanelUrls
        if ($PublicPanelUrl) { $session.panelUrls += $PublicPanelUrl }
      }
      Send-Json $c 200 'OK' (ConvertTo-Json -Compress -InputObject $session)
    }
    { $_ -in 'compartir', 'abrirred', 'cerrarred', 'abririnternet', 'cerrarinternet', 'certificadored' } {
      if ($c.Panel -or (Test-Remote $c) -or -not (Test-Loopback $c)) {
        Send-Json $c 403 'Forbidden' '{"error":"solo-este-equipo"}'
        return
      }
      $why = Test-Signature $c
      if ($why) { Send-Json $c 401 'Unauthorized' ('{"error":"' + $why + '"}'); return }
      switch ($action) {
        'compartir' {
          if ($SharingAction) { Send-Json $c 200 'OK' '{"pending":true}' }
          else { Send-Json $c 200 'OK' $SharingResult }
        }
        'certificadored' {
          if ($PanelRed -and $panelCertificate.TrustFile) {
            $bytes = [IO.File]::ReadAllBytes($panelCertificate.TrustFile)
            Send-Bytes $c 200 'OK' @{ 'Content-Type' = 'application/x-x509-ca-cert'; 'Cache-Control' = 'no-store' } $bytes
          } else { Send-Json $c 404 'Not Found' '{"error":"certificado"}' }
        }
        default {
          if ($SharingAction) { Send-Json $c 409 'Conflict' '{"error":"ocupado"}'; return }
          $script:SharingAction = $action
          Send-Json $c 202 'Accepted' '{"pending":true}'
        }
      }
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
  if ((Test-Loopback $c) -and -not (Test-Remote $c)) { return $true }
  return ((Get-Query $c 'k') -eq $Viewer)
}

function Send-Live($c) {
  Send-Json $c 200 'OK' ('{"rev":' + $script:Rev + ',"state":' + $script:LiveJson + '}')
}

function Invoke-Live($c) {
  if ($c.Method -eq 'POST') {
    if (-not (Test-ConsoleAccess $c)) { Send-Json $c 403 'Forbidden' '{"error":"solo-este-equipo"}'; return }
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
    if (-not (Test-ConsoleAccess $c)) { Send-Json $c 403 'Forbidden' '{"error":"solo-este-equipo"}'; return }
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
  if (-not (Test-ConsoleAccess $c)) { Send-Json $c 403 'Forbidden' '{"error":"solo-este-equipo"}'; return }
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
  $full = [IO.Path]::GetFullPath((Join-Path $Root ($path.TrimStart('/').Replace([char]'/', $Separator))))
  $ext = [IO.Path]::GetExtension($full).ToLowerInvariant()
  if (-not $full.StartsWith($Root + $Separator, [StringComparison]::OrdinalIgnoreCase) -or -not $Mime.ContainsKey($ext) -or -not (Test-Path -LiteralPath $full -PathType Leaf)) {
    Send-Json $c 404 'Not Found' '{"error":"no-existe"}'; return
  }
  Send-File $c $full $Mime[$ext] 'no-cache' $null
}

function Read-Settings {
  $path = Join-Path $Conf 'ajustes.json'
  if (Test-Path -LiteralPath $path) {
    $body = [IO.File]::ReadAllBytes($path)
    return @{ Body = $body; Revision = (Get-Sha256Hex $body) }
  }
  return @{ Body = [Text.Encoding]::UTF8.GetBytes('{}'); Revision = '0' }
}

function Invoke-Settings($c) {
  if (-not (Test-ConsoleAccess $c)) { Send-Json $c 403 'Forbidden' '{"error":"solo-este-equipo"}'; return }
  if ($c.Method -ne 'POST') { Send-Json $c 405 'Method Not Allowed' '{"error":"metodo"}'; return }
  if (-not (Test-Origin $c)) { Send-Json $c 403 'Forbidden' '{"error":"origen"}'; return }
  $why = Test-Signature $c
  if ($why) { Send-Json $c 401 'Unauthorized' ('{"error":"' + $why + '"}'); return }

  switch (Get-Query $c 'accion') {
    'leer' {
      $snapshot = Read-Settings
      Send-Bytes $c 200 'OK' @{ 'Content-Type' = 'application/json'; 'Cache-Control' = 'no-store';
        'ETag' = ('"' + $snapshot.Revision + '"') } $snapshot.Body
    }
    'guardar' {
      $revision = Get-Query $c 'revision'
      if ($revision -cnotmatch '^(0|[0-9a-f]{64})$') { Send-Json $c 400 'Bad Request' '{"error":"revision"}'; return }
      try { $settings = ConvertFrom-Json -InputObject $c.BodyText }
      catch { Send-Json $c 400 'Bad Request' '{"error":"ajustes"}'; return }
      if ($settings -isnot [pscustomobject]) { Send-Json $c 400 'Bad Request' '{"error":"ajustes"}'; return }

      try {
        $lock = [IO.File]::Open((Join-Path $Conf 'ajustes.lock'), [IO.FileMode]::OpenOrCreate,
          [IO.FileAccess]::Write, [IO.FileShare]::None)
      } catch [IO.IOException] {
        Send-Json $c 503 'Service Unavailable' '{"error":"ajustes"}'
        return
      }
      try {
        if ((Read-Settings).Revision -cne $revision) { Send-Json $c 409 'Conflict' '{"error":"revision"}'; return }
        $path = Join-Path $Conf 'ajustes.json'
        $pending = "$path.tmp"
        [IO.File]::WriteAllBytes($pending, $c.BodyMem.ToArray())
        if ([IO.File]::Exists($path)) { [IO.File]::Replace($pending, $path, [NullString]::Value) }
        else { [IO.File]::Move($pending, $path) }
      } finally {
        $lock.Dispose()
      }
      Send-Json $c 200 'OK' ('{"revision":"' + $c.BodyHash + '"}')
    }
    default { Send-Json $c 404 'Not Found' '{"error":"accion"}' }
  }
}

function Test-RequestHost($c) {
  # Contra el «DNS rebinding»: solo se responde si se pide por el nombre de este equipo.
  $hostsForConnection = if ($c.Panel) { $PanelHosts } else { $AllowedHosts }
  if ($hostsForConnection -notcontains $c.Headers['host']) { Send-Json $c 421 'Misdirected Request' '{"error":"host"}'; return $false }
  if (Test-Remote $c) {
    if (-not (Test-Loopback $c)) { Send-Json $c 403 'Forbidden' '{"error":"tunel-local"}'; return $false }
    if ($c.Headers['x-forwarded-proto'] -cne 'https') { Send-Json $c 403 'Forbidden' '{"error":"https"}'; return $false }
    $control = $c.Path -in '/api/auth', '/api/app', '/api/settings' -or
      ($c.Method -eq 'POST' -and $c.Path -in '/api/live', '/api/media')
    if ($RemoteAccess -and $c.Path -notin '/', '/index.html', '/styles.css', '/icon.svg', '/auth.js',
        '/app.js', '/studio.js', '/bible_rvr1960.json', '/himnarios.json', '/api/auth', '/api/app',
        '/api/live', '/api/media', '/api/settings') {
      Send-Json $c 404 'Not Found' '{"error":"no-existe"}'
      return $false
    }
    if ($RemoteAccess -and $control -and $c.Headers['x-biblia-access'] -cne $RemoteAccess) {
      Send-Json $c 403 'Forbidden' '{"error":"enlace"}'
      return $false
    }
  } elseif ($c.Headers['x-forwarded-for'] -or $c.Headers['x-forwarded-host'] -or $c.Headers['x-forwarded-proto'] -or $c.Headers['forwarded']) {
    Send-Json $c 421 'Misdirected Request' '{"error":"host"}'; return $false
  }
  # El modo local solo acepta conexiones de loopback.
  if (-not $Red -and -not $PanelRed -and -not (Test-Loopback $c)) { Send-Json $c 403 'Forbidden' '{"error":"solo-este-equipo"}'; return $false }
  return $true
}

function Invoke-Request($c) {
  if ($PanelRed -and -not $c.Panel -and $c.Method -eq 'GET' -and $c.Path -eq '/' -and -not $c.Query -and
      $LanUrls -contains "http://$($c.Headers['host'])") {
    Send-Bytes $c 302 'Found' @{ Location = "https://$($c.Headers['host'])/"; 'Cache-Control' = 'no-store' } (New-Object byte[] 0)
    return
  }
  switch ($c.Path) {
    '/api/auth' { Invoke-Auth $c }
    '/api/live' { Invoke-Live $c }
    '/api/media' { Invoke-Media $c }
    '/api/app' { Invoke-App $c }
    '/api/settings' { Invoke-Settings $c }
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
  if (-not (Test-RequestHost $c)) { return }
  $len = 0
  if ($c.Headers.ContainsKey('content-length')) {
    if ($c.Headers['content-length'] -notmatch '^[0-9]{1,10}$') { Send-Json $c 400 'Bad Request' '{"error":"longitud"}'; return }
    $len = [long]$c.Headers['content-length']
  }
  if ($c.Headers.ContainsKey('transfer-encoding')) { Send-Json $c 411 'Length Required' '{"error":"longitud"}'; return }
  $limit = 1048576
  if ($c.Path -eq '/api/media') { $limit = 1073741824 }
  if ($c.Path -in '/api/live', '/api/settings') { $limit = 16777216 }   # lleva la imagen de fondo en base64
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

function Read-Conn($c, [int]$size) {
  # SslStream puede tener datos descifrados aunque el socket no tenga más bytes pendientes.
  if ($null -eq $c.ReadTask) {
    $c.ReadBuffer = New-Object byte[] $size
    $c.ReadTask = $c.Stream.ReadAsync($c.ReadBuffer, 0, $size)
  }
  if (-not $c.ReadTask.IsCompleted) { return -1 }
  $count = $c.ReadTask.GetAwaiter().GetResult()
  $c.ReadTask = $null
  return $count
}

$protocolByte = New-Object byte[] 1

function Step-Conn($c) {
  $did = $false
  switch ($c.Phase) {
    'protocol' {
      $socket = $c.Client.Client
      if ($socket.Poll(0, [Net.Sockets.SelectMode]::SelectRead)) {
        if ($socket.Receive($protocolByte, 0, 1, [Net.Sockets.SocketFlags]::Peek) -eq 0) {
          Close-Conn $c
          return $true
        }
        $c.Phase = 'head'
        # El primer registro TLS es un handshake. Peek deja el byte disponible para SslStream.
        if ($protocolByte[0] -eq 0x16) {
          $c.Stream = [Net.Security.SslStream]::new($c.Stream, $false)
          $c.Handshake = $c.Stream.AuthenticateAsServerAsync($panelCertificate.Cert, $false,
            [Security.Authentication.SslProtocols]::Tls12, $false)
          $c.Phase = 'tls'
        }
        $c.Since = [DateTime]::UtcNow
        $did = $true
      } elseif (([DateTime]::UtcNow - $c.Since).TotalSeconds -gt 10) { Close-Conn $c }
    }
    'tls' {
      if ($c.Handshake.IsCompleted) {
        [void]$c.Handshake.GetAwaiter().GetResult()
        $c.Handshake = $null
        $c.Panel = $true
        $c.Phase = 'head'
        $c.Since = [DateTime]::UtcNow
        $did = $true
      } elseif (([DateTime]::UtcNow - $c.Since).TotalSeconds -gt 10) { Close-Conn $c }
    }
    'head' {
      $n = Read-Conn $c 8192
      if ($n -ge 0) {
        if ($n -eq 0) { Close-Conn $c; return $true }
        $c.Head.Write($c.ReadBuffer, 0, $n)
        $data = $c.Head.ToArray()
        $text = [Text.Encoding]::ASCII.GetString($data)
        $end = $text.IndexOf("`r`n`r`n")
        if ($end -ge 0) { Start-Request $c $data $end }
        elseif ($data.Length -gt $MaxHeader) { Send-Json $c 431 'Request Header Fields Too Large' '{"error":"cabecera"}' }
        $did = $true
      } elseif (([DateTime]::UtcNow - $c.Since).TotalSeconds -gt 10) { Close-Conn $c }
    }
    'body' {
      $n = Read-Conn $c ([int][Math]::Min(262144, $c.Remaining))
      if ($n -ge 0) {
        if ($n -eq 0) { Close-Conn $c; return $true }
        Add-Body $c $c.ReadBuffer 0 $n
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
function Open-Listeners([Net.IPAddress[]]$addresses, [int]$firstPort, [bool]$fixedPort) {
  $lastPort = 65535
  if ($fixedPort) { $lastPort = $firstPort }
  for ($port = $firstPort; $port -le $lastPort; $port++) {
    $active = @()
    try {
      foreach ($address in $addresses) {
        $listener = New-Object Net.Sockets.TcpListener($address, $port)
        try {
          $listener.ExclusiveAddressUse = $true
          $listener.Start()
        } catch {
          $listener.Stop()
          $errorFromSocket = $_.Exception.GetBaseException()
          if ($address.Equals([Net.IPAddress]::IPv6Loopback) -and
              $errorFromSocket -is [Net.Sockets.SocketException] -and
              $errorFromSocket.SocketErrorCode -in 'AddressNotAvailable', 'AddressFamilyNotSupported', 'ProtocolNotSupported') {
            continue
          }
          throw
        }
        $active += $listener
      }
      return @{ Port = $port; Listeners = $active }
    } catch {
      $cause = $_.Exception.GetBaseException()
      foreach ($listener in $active) { try { $listener.Stop() } catch {} }
      # Windows también puede devolver AccessDenied para un puerto reservado.
      if ($cause -isnot [Net.Sockets.SocketException] -or $cause.SocketErrorCode -notin 'AddressAlreadyInUse', 'AccessDenied') { throw }
    }
  }
  throw "No se pudo abrir un puerto a partir del $firstPort. Indica uno disponible con -Puerto."
}

function Set-PanelNetwork {
  $ips = @(Get-LanIps)
  if (-not $ips.Count) { throw 'Conecta esta PC a la red para habilitar el panel por IP.' }
  . (Join-Path $Root 'server/panel-cert.ps1')
  $certificate = Get-PanelCertificate $ips $Conf $CertificadoPanel
  try {
    if (-not $Red) {
      $addresses = @($ips | ForEach-Object { [Net.IPAddress]::Parse($_) })
      $script:PanelListeners = (Open-Listeners $addresses $Puerto $true).Listeners
    }
  } catch {
    $certificate.Cert.Dispose()
    throw
  }
  $script:panelCertificate = $certificate
  $script:LanIps = $ips
  $script:PanelHosts = @($ips | ForEach-Object { "${_}:$Puerto" })
  $script:PanelUrls = @($PanelHosts | ForEach-Object { "https://$_" })
  $script:LanUrls = @($PanelHosts | ForEach-Object { "http://$_" })
  $script:AllowedHosts = @($AllowedHosts + $PanelHosts | Select-Object -Unique)
  $script:PanelRed = $true
}

function Close-PanelNetwork {
  if (-not $PanelRed) { return }
  foreach ($listener in $PanelListeners) { $listener.Stop() }
  $script:PanelListeners = @()
  foreach ($conn in @($conns)) {
    if ($conn.Client.Client -and -not [Net.IPAddress]::IsLoopback($conn.Client.Client.LocalEndPoint.Address)) {
      Close-Conn $conn
    }
  }
  if (-not $Red) {
    $script:AllowedHosts = @($AllowedHosts | Where-Object { $_ -notin $PanelHosts })
    $script:LanUrls = @()
    $script:LanIps = @()
  }
  $script:PanelRed = $false
  $script:PanelHosts = @()
  $script:PanelUrls = @()
  $panelCertificate.Cert.Dispose()
  $script:panelCertificate = $null
}

function Set-PublicPanel([string]$origin) {
  $script:RemoteAccess = New-RandomHex 32
  $script:OrigenRemoto = $origin
  $script:RemoteHost = $origin.Substring(8)
  $script:AllowedHosts += $RemoteHost
  $script:PublicPanelUrl = "$origin/#acceso=$RemoteAccess"
}

function Close-PublicPanel {
  Stop-CloudflareTunnel
  $script:AllowedHosts = @($AllowedHosts | Where-Object { $_ -ne $RemoteHost })
  $script:OrigenRemoto = ''
  $script:RemoteHost = ''
  $script:RemoteAccess = ''
  $script:PublicPanelUrl = ''
}

function Update-Sharing {
  if (-not $SharingAction) { return }
  try {
    switch ($SharingAction) {
      'abrirred' { if (-not $PanelRed) { Set-PanelNetwork } }
      'cerrarred' { Close-PanelNetwork }
      'cerrarinternet' { if ($RemoteAccess) { Close-PublicPanel } }
      'abririnternet' {
        if ($RemoteAccess) { break }
        if ($OrigenRemoto) { throw 'Ya hay un túnel configurado.' }
        if (-not [IO.File]::Exists($cloudflareScript)) { throw 'Extrae el ZIP completo para usar Cloudflare.' }
        if (-not $CloudflareProcess) {
          if (-not $CloudflareDownload) {
            $script:CloudflareDownload = [PowerShell]::Create()
            [void]$CloudflareDownload.AddScript({
              param($Directory, $Conf, $Run)
              $ErrorActionPreference = 'Stop'
              . (Join-Path $Directory 'server/cloudflare.ps1')
              Get-CloudflaredPath
            }).AddArgument($Root).AddArgument($Conf).AddArgument($Run)
            $script:CloudflareDownloadResult = $CloudflareDownload.BeginInvoke()
          }
          if (-not $CloudflareDownloadResult.IsCompleted) { return }
          try { $client = @($CloudflareDownload.EndInvoke($CloudflareDownloadResult))[0] }
          finally {
            $CloudflareDownload.Dispose()
            $script:CloudflareDownload = $null
          }
          Start-CloudflareProcess $client
          $script:CloudflareNextPoll = [DateTime]::UtcNow
          $script:CloudflareDeadline = $CloudflareNextPoll.AddSeconds(35)
        }
        if ($CloudflareProcess.HasExited -or [DateTime]::UtcNow -ge $CloudflareDeadline) {
          throw 'Cloudflare no pudo conectar a tiempo.'
        }
        if ([DateTime]::UtcNow -lt $CloudflareNextPoll) { return }
        $script:CloudflareNextPoll = [DateTime]::UtcNow.AddMilliseconds(250)
        $origin = Get-CloudflareOrigin
        if (-not $origin) { return }
        Set-PublicPanel $origin
      }
    }
    $script:SharingResult = '{"ok":true}'
  } catch {
    if ($CloudflareProcess -and $SharingAction -eq 'abririnternet') { Stop-CloudflareTunnel }
    Write-Host $_.Exception.Message
    $script:SharingResult = '{"error":"conexion"}'
  }
  $script:SharingAction = ''
}

$requestedPort = $Puerto
$bindAddr = [Net.IPAddress]::Loopback
if ($Red) { $bindAddr = [Net.IPAddress]::Any }
$bindAddresses = @($bindAddr)
# localhost puede resolverse por IPv4 o IPv6. Reserva el mismo puerto para ambos.
if ([Net.Sockets.Socket]::OSSupportsIPv6) { $bindAddresses += [Net.IPAddress]::IPv6Loopback }

$listeners = @()
$PanelHosts = @()
$PanelUrls = @()
$panelCertificate = $null
$CloudflareProcess = $null
$CloudflareDownload = $null
$CloudflareDownloadResult = $null
$CloudflareDeadline = [DateTime]::MinValue
$CloudflareNextPoll = [DateTime]::MinValue
$SharingAction = ''
$SharingResult = '{}'
$PanelListeners = @()
$cloudflareScript = Join-Path $Root 'server/cloudflare.ps1'
if ([IO.File]::Exists($cloudflareScript)) { . $cloudflareScript }
$conns = New-Object Collections.ArrayList
try {
  if ($PanelRed -and -not $LanIps.Count) {
    throw 'Conecta esta PC a la red para habilitar el acceso al panel por IP.'
  }

  $binding = Open-Listeners $bindAddresses $Puerto $fixedPort
  $Puerto = $binding.Port
  $listeners = $binding.Listeners
  $Url = "http://localhost:$Puerto"
  $lanHosts = @($LanIps | ForEach-Object { "${_}:$Puerto" })
  $LanUrls = @($lanHosts | ForEach-Object { "http://$_" })
  $AllowedHosts = @("localhost:$Puerto", "127.0.0.1:$Puerto", "[::1]:$Puerto") + $lanHosts
  $AllowedOrigins = @($Url, "http://127.0.0.1:$Puerto", "http://[::1]:$Puerto")
  if ($RemoteHost) { $AllowedHosts += $RemoteHost }

  if ($PanelRed) { Set-PanelNetwork }
  New-Item -ItemType Directory -Force -Path $Run | Out-Null
  if ($Internet) {
    try {
      if (-not [IO.File]::Exists($cloudflareScript)) { throw 'Extrae el ZIP completo para usar Cloudflare.' }
      Set-PublicPanel (Start-CloudflareTunnel)
    } catch {
      if ($CloudflareProcess) { Stop-CloudflareTunnel }
      Write-Host $_.Exception.Message
      Write-Host 'No se pudo crear el enlace de internet. Biblia sigue disponible en este equipo.'
    }
  }

  if ($Puerto -ne $requestedPort) { Write-Host "El puerto $requestedPort está ocupado o reservado. Biblia usará el $Puerto." }
  Write-Host '=============================================='
  Write-Host '  Biblia · by @jairohm.dev'
  Write-Host '=============================================='
  $openUrl = $Url
  if ($changePinOnStart -and (Get-StoredPin)) { $openUrl = "$Url/?cambiar-pin" }
  Write-Host "  App       : $openUrl"
  if ($PanelRed) {
    foreach ($panelUrl in $PanelUrls) { Write-Host "  Acceso al panel con PIN: $panelUrl" }
    if ($panelCertificate.TrustFile) {
      Write-Host "  Certificado público de Biblia: $($panelCertificate.TrustFile)"
      Write-Host '  Instala ese certificado como autoridad de confianza en los dispositivos que usarán el panel.'
    }
  }
  if ($PublicPanelUrl) {
    Write-Host "  Panel por internet: $PublicPanelUrl"
    Write-Host '  Comparte el enlace completo con quienes tengan el PIN. Se cierra con Ctrl+C.'
  } elseif ($OrigenRemoto) {
    Write-Host "  Panel por túnel: $OrigenRemoto (requiere PIN)"
  }
  Write-Host "  OBS       : $Url/?salida&obs"
  Write-Host '  OBS (solo texto, fondo transparente):'
  Write-Host "              $Url/?salida&obs&transparente"
  if ($Red) {
    foreach ($base in $LanUrls) { Write-Host "  Ver en otro dispositivo de la red:`n              $base/?salida&obs&k=$Viewer" }
    Write-Host '  Si Windows pregunta por el firewall, permite el acceso solo en redes PRIVADAS.'
  }
  Write-Host "  Sesión    : se pide el PIN tras $SesionMin min sin usar la consola"
  Write-Host '  Ayuda     : iniciar-windows.cmd -Ayuda'
  Write-Host '  Detener   : Ctrl+C o cierra esta ventana'
  Write-Host '=============================================='
  if (-not $NoAbrir) {
    try { Start-Process -FilePath $openUrl }
    catch {
      Write-Host 'Biblia sigue encendida. Abre esta dirección en tu navegador:' -ForegroundColor Yellow
      Write-Host "  $openUrl"
    }
  }
  while ($true) {
    Update-Sharing
    $busy = $false
    foreach ($l in ($listeners + $PanelListeners)) {
      while ($l.Pending() -and $conns.Count -lt $MaxConns) {
        $client = $l.AcceptTcpClient()
        $client.NoDelay = $true
        $client.SendTimeout = 15000
        $phase = 'head'
        if ($PanelRed -and $LanIps -contains $client.Client.LocalEndPoint.Address.ToString()) { $phase = 'protocol' }
        $c = @{
          Client = $client; Stream = $client.GetStream(); Head = New-Object IO.MemoryStream; Phase = $phase; Since = [DateTime]::UtcNow
          Method = ''; Target = ''; Path = ''; Query = ''; Headers = @{}; Remaining = 0; Hasher = $null; BodyMem = $null
          BodyFile = $null; BodyPath = $null; BodyText = ''; BodyHash = ''; File = $null; WaitRev = 0; Deadline = [DateTime]::MinValue
          Panel = $false; Handshake = $null; ReadTask = $null; ReadBuffer = $null
        }
        [void]$conns.Add($c)
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
  if ($CloudflareDownload) { $CloudflareDownload.Stop(); $CloudflareDownload.Dispose() }
  if ($CloudflareProcess) { Stop-CloudflareTunnel }
  foreach ($c in @($conns)) { Close-Conn $c }
  foreach ($l in ($listeners + $PanelListeners)) { try { $l.Stop() } catch {} }
  if ($panelCertificate) { $panelCertificate.Cert.Dispose() }
  Remove-Item -Recurse -Force $Run -ErrorAction SilentlyContinue
}
