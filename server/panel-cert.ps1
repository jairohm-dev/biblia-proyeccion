# El certificado público de Biblia se exporta para los dispositivos que usarán el panel.
# Windows guarda las llaves privadas fuera del proyecto, en el almacén del usuario.
function Get-PanelCertificate([string[]]$Ips, [string]$ConfigDir, [string]$PfxPath) {
  if ($PfxPath) {
    $password = Read-Host 'Contraseña del certificado PFX' -AsSecureString
    $file = (Get-Item -LiteralPath $PfxPath).FullName
    $cert = [Security.Cryptography.X509Certificates.X509Certificate2]::new($file, $password)
    if (-not $cert.HasPrivateKey -or $cert.NotAfter -le [DateTime]::Now -or $cert.NotBefore -gt [DateTime]::Now) {
      $cert.Dispose()
      throw 'El PFX debe tener una llave privada y un certificado vigente para las IP del panel.'
    }
    return @{ Cert = $cert; TrustFile = '' }
  }

  $lockFile = Join-Path $ConfigDir 'panel-cert.lock'
  $certLock = [IO.File]::Open($lockFile, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::Write, [IO.FileShare]::None)
  try {
    $store = 'Cert:\CurrentUser\My'
    $trustFile = Join-Path $ConfigDir 'Biblia-autoridad-red.cer'
    $now = [DateTime]::Now
    $authority = $null
    if (Test-Path -LiteralPath $trustFile) {
      try {
        $saved = [Security.Cryptography.X509Certificates.X509Certificate2]::new($trustFile)
        try { $authority = Get-Item -LiteralPath (Join-Path $store $saved.Thumbprint) -ErrorAction SilentlyContinue }
        finally { $saved.Dispose() }
      } catch [Security.Cryptography.CryptographicException] { $authority = $null }
    }

    $keyOptions = @{ CertStoreLocation = $store; KeyAlgorithm = 'RSA'; KeyLength = 2048;
      HashAlgorithm = 'SHA256'; KeyExportPolicy = 'NonExportable'; NotBefore = $now.AddMinutes(-5) }
    if (-not $authority -or -not $authority.HasPrivateKey -or $authority.NotAfter -lt $now.AddDays(366)) {
      $suffix = [Guid]::NewGuid().ToString('N').Substring(0, 8)
      $constraints = [Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($true, $true, 0, $true)
      $authority = New-SelfSignedCertificate @keyOptions -Type Custom -Subject "CN=Biblia Red $suffix" `
        -KeyUsage CertSign -Extension @($constraints) -NotAfter $now.AddYears(5)
      $publicCert = $authority.Export([Security.Cryptography.X509Certificates.X509ContentType]::Cert)
      $pendingFile = "$trustFile.tmp"
      [IO.File]::WriteAllBytes($pendingFile, $publicCert)
      if ([IO.File]::Exists($trustFile)) { [IO.File]::Replace($pendingFile, $trustFile, [NullString]::Value) }
      else { [IO.File]::Move($pendingFile, $trustFile) }
    }

    $san = ($Ips | Sort-Object | ForEach-Object { "IPAddress=$_" }) -join '&'
    $name = "Biblia $($authority.Thumbprint) $san"
    $leaf = Get-ChildItem -Path $store | Where-Object {
      $_.FriendlyName -eq $name -and $_.HasPrivateKey -and $_.NotAfter -gt $now.AddDays(1) -and $_.NotBefore -le $now
    } | Select-Object -First 1
    if (-not $leaf) {
      $leaf = New-SelfSignedCertificate @keyOptions -Type SSLServerAuthentication -Signer $authority `
        -Subject 'CN=Biblia Panel' -FriendlyName $name -TextExtension @("2.5.29.17={text}$san") `
        -NotAfter $now.AddDays(365)
    }
    return @{ Cert = $leaf; TrustFile = $trustFile }
  } finally {
    $certLock.Dispose()
  }
}
