$ErrorActionPreference = 'Stop'

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  $arguments = '-NoExit -NoProfile -ExecutionPolicy Bypass -File "' + $PSCommandPath + '"'
  Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -Verb RunAs
  return
}

try {
  $zipPath = Join-Path $PSScriptRoot 'UPCO-Compras-LAN-20261107.zip'
  $checksumPath = Join-Path $PSScriptRoot 'UPCO-Compras-LAN-20261107.sha256'
  foreach ($required in @($zipPath, $checksumPath)) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Falta el archivo $required. Espere a que termine de sincronizarse." }
  }
  $expectedHash = ((Get-Content -LiteralPath $checksumPath -Raw).Trim() -split '\s+')[0]
  if ($expectedHash -notmatch '^[0-9A-Fa-f]{64}$') { throw 'El archivo de verificación SHA256 no es válido.' }
  $actualHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash
  if ($actualHash -ne $expectedHash) { throw 'El ZIP no coincide con su verificación SHA256. Espere a que termine de sincronizarse.' }

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [IO.Compression.ZipFile]::OpenRead($zipPath)
  try {
    $roots = @($archive.Entries | ForEach-Object { ($_.FullName -split '/')[0] } | Sort-Object -Unique)
    if ($roots.Count -ne 1 -or $roots[0] -notmatch '^upco-compras-lan-[0-9]{8}-[0-9]{6}$') {
      throw 'La estructura del ZIP no corresponde al instalador LAN de UPCO.'
    }
    $archiveRoot = $roots[0]
    foreach ($file in @('server.js', 'runtime/node.exe', 'scripts/install-lan-windows.ps1')) {
      if (-not $archive.GetEntry("$archiveRoot/$file")) { throw "Falta $file dentro del ZIP." }
    }
  } finally {
    $archive.Dispose()
  }

  $upcoRoot = 'C:\UPCO'
  $unpackedPath = Join-Path $upcoRoot $archiveRoot
  $installPath = Join-Path $upcoRoot 'Compras-LAN'
  if (Test-Path -LiteralPath $installPath) { throw "Ya existe $installPath. No se sobrescribirá una instalación existente." }
  if (Test-Path -LiteralPath $unpackedPath) { throw "Ya existe una extracción incompleta en $unpackedPath. No se sobrescribirá." }
  New-Item -ItemType Directory -Path $upcoRoot -Force | Out-Null
  Write-Output 'Verificación correcta. Extrayendo el programa en C:\UPCO; puede tardar varios minutos...'
  [IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $upcoRoot)
  Move-Item -LiteralPath $unpackedPath -Destination $installPath
  Write-Output 'Programa extraído. Iniciando respaldo y cambio a la red local...'
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $installPath 'scripts\install-lan-windows.ps1')
  if ($LASTEXITCODE -ne 0) { throw 'El instalador LAN informó un error. La carpeta anterior y los datos siguen disponibles.' }
  Write-Output 'Instalación LAN terminada. Pruebe la dirección mostrada desde otro equipo de la oficina.'
  $cleanupScript = Join-Path $PSScriptRoot 'cleanup-lan-windows.ps1'
  if (Test-Path -LiteralPath $cleanupScript -PathType Leaf) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $cleanupScript
    if ($LASTEXITCODE -ne 0) { Write-Warning 'La versión LAN funciona, pero no terminó la limpieza del programa anterior.' }
  } else {
    Write-Warning 'Falta cleanup-lan-windows.ps1. Puede retirar el programa anterior más tarde.'
  }
} catch {
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host 'Envíeme una captura de esta ventana antes de volver a intentarlo.'
}
