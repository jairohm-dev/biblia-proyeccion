# Cloudflare Quick Tunnel para el puerto de Biblia que el servidor ya abrió.
function Get-CloudflaredPath {
  $installed = Get-Command cloudflared -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($installed) { return $installed.Source }

  $version = '2026.11.2'
  $arch = $env:PROCESSOR_ARCHITECTURE
  if ($env:PROCESSOR_ARCHITEW6432) { $arch = $env:PROCESSOR_ARCHITEW6432 }
  switch ($arch) {
    'AMD64' {
      $asset = 'cloudflared-windows-amd64.exe'
      $checksum = '555b46c85582461d189cac30d14ad05480d612613801be9f110b8ce08c5b2113'
    }
    { $_ -in 'x86', 'ARM64' } {
      $asset = 'cloudflared-windows-386.exe'
      $checksum = '272154d4b8a83a2a9bd55502ab27e721838c42772396751eb5a5fc4739c9f23a'
    }
    default { throw 'No hay una descarga automática de Cloudflare para este equipo.' }
  }

  $target = Join-Path $Conf "$version-$asset"
  if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
    Write-Host 'Descargando Cloudflare para habilitar el acceso por internet…'
    $download = Join-Path $Run $asset
    $tls = [Net.ServicePointManager]::SecurityProtocol
    try {
      [Net.ServicePointManager]::SecurityProtocol = $tls -bor [Net.SecurityProtocolType]::Tls12
      Invoke-WebRequest -UseBasicParsing -TimeoutSec 120 `
        -Uri "https://github.com/cloudflare/cloudflared/releases/download/$version/$asset" -OutFile $download
    } finally {
      [Net.ServicePointManager]::SecurityProtocol = $tls
    }
    if ((Get-FileHash -LiteralPath $download -Algorithm SHA256).Hash -ne $checksum) {
      throw 'La descarga de Cloudflare no pasó la verificación de integridad.'
    }
    Move-Item -LiteralPath $download -Destination $target
  }
  return $target
}

function Start-CloudflareProcess([string]$client) {
  $config = Join-Path $Run 'cloudflared.yml'
  Set-Content -LiteralPath $config -Value '{}' -Encoding ASCII
  $errorLog = Join-Path $Run 'cloudflared.log'
  $outputLog = Join-Path $Run 'cloudflared.out'
  Write-Host 'Creando el enlace de internet con Cloudflare…'
  $arguments = @('tunnel', '--config', ('"{0}"' -f $config), '--no-autoupdate', '--grace-period', '2s',
    '--loglevel', 'info', '--url', "http://127.0.0.1:$Puerto", '--metrics', '127.0.0.1:0')
  $script:CloudflareProcess = Start-Process -FilePath $client -ArgumentList $arguments -NoNewWindow -PassThru `
    -RedirectStandardOutput $outputLog -RedirectStandardError $errorLog
}

function Get-CloudflareOrigin {
  $logs = @((Join-Path $Run 'cloudflared.log'), (Join-Path $Run 'cloudflared.out'))
  $status = (Get-Content -Raw -LiteralPath $logs -ErrorAction SilentlyContinue) -join "`n"
  if ($status.Contains('Registered tunnel connection') -and
      $status -cmatch '\|\s*(https://[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.trycloudflare\.com)\s*\|') {
    return $Matches[1]
  }
}

function Start-CloudflareTunnel {
  Start-CloudflareProcess (Get-CloudflaredPath)
  $deadline = [DateTime]::UtcNow.AddSeconds(35)
  while (-not $script:CloudflareProcess.HasExited -and [DateTime]::UtcNow -lt $deadline) {
    $origin = Get-CloudflareOrigin
    if ($origin) { return $origin }
    Start-Sleep -Milliseconds 250
  }
  throw 'Cloudflare no pudo conectar a tiempo.'
}

function Stop-CloudflareTunnel {
  if ($script:CloudflareProcess) {
    try {
      if (-not $script:CloudflareProcess.HasExited) {
        $script:CloudflareProcess.Kill()
        [void]$script:CloudflareProcess.WaitForExit(2000)
      }
    } catch { }
    $script:CloudflareProcess.Dispose()
    $script:CloudflareProcess = $null
  }
}
