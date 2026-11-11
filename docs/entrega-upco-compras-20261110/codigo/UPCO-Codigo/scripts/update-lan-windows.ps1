$ErrorActionPreference = 'Stop'
$stageRoot = $null
$upcoRoot = 'C:\UPCO'

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  $arguments = '-NoExit -NoProfile -ExecutionPolicy Bypass -File "' + $PSCommandPath + '"'
  Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -Verb RunAs
  return
}

try {
  $installPath = Join-Path $upcoRoot 'Compras-LAN'
  $oldNode = Join-Path $installPath 'runtime\node.exe'
  $oldConfig = Join-Path $installPath 'install-config.json'
  $oldStart = Join-Path $installPath 'scripts\start.mjs'
  $zipPath = Join-Path $PSScriptRoot 'UPCO-Compras-Actualizacion-Continua-20261109.zip'
  $checksumPath = Join-Path $PSScriptRoot 'UPCO-Compras-Actualizacion-Continua-20261109.sha256'
  foreach ($required in @($oldNode, $oldConfig, $oldStart, $zipPath, $checksumPath)) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Falta $required. No se cambió la instalación." }
  }
  $oldItem = Get-Item -LiteralPath $installPath
  if ($oldItem.FullName -ne $installPath -or -not $oldItem.PSIsContainer -or
      (($oldItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {
    throw 'La instalación actual no coincide con la carpeta esperada.'
  }
  $config = Get-Content -LiteralPath $oldConfig -Raw | ConvertFrom-Json
  if ($config.listenHost -ne '0.0.0.0' -or -not $config.dataDir) {
    throw 'La configuración LAN actual no tiene los datos esperados.'
  }
  $dataDir = [IO.Path]::GetFullPath([string]$config.dataDir)
  $backupDir = if ($config.backupDir) { [IO.Path]::GetFullPath([string]$config.backupDir) } else { 'C:\ProgramData\UPCO\Backups' }
  if (-not (Test-Path -LiteralPath (Join-Path $dataDir 'upco.sqlite') -PathType Leaf)) {
    throw 'No se encontró la base actual. No se cambió la instalación.'
  }
  $task = Get-ScheduledTask -TaskName 'UPCO Compras' -ErrorAction Stop
  if ($task.Actions[0].Execute.Trim('"') -ne $oldNode -or $task.Actions[0].Arguments -notlike "*$oldStart*") {
    throw 'La tarea de UPCO no apunta a C:\UPCO\Compras-LAN. No se cambió la instalación.'
  }
  foreach ($rule in @('UPCO-Compras-LAN', 'UPCO-Compras-Tailnet')) {
    if (-not (Get-NetFirewallRule -Name $rule -PolicyStore ActiveStore -ErrorAction SilentlyContinue)) {
      throw "La regla de acceso $rule no está activa. No se cambió la instalación."
    }
  }
  $expectedHash = ((Get-Content -LiteralPath $checksumPath -Raw).Trim() -split '\s+')[0]
  if ($expectedHash -notmatch '^[0-9A-Fa-f]{64}$') { throw 'La verificación SHA256 del ZIP no es válida.' }
  $actualHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash
  if ($actualHash -ne $expectedHash) { throw 'El ZIP está incompleto o no coincide con su verificación SHA256.' }

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [IO.Compression.ZipFile]::OpenRead($zipPath)
  try {
    $roots = @($archive.Entries | ForEach-Object { ($_.FullName -split '/')[0] } | Sort-Object -Unique)
    if ($roots.Count -ne 1 -or $roots[0] -notmatch '^upco-compras-lan-[0-9]{8}-[0-9]{6}$') {
      throw 'La estructura del ZIP no corresponde a UPCO Compras LAN.'
    }
    $releaseRoot = $roots[0]
    foreach ($file in @('server.js', 'runtime/node.exe', 'scripts/start.mjs', 'scripts/migrate.mjs',
        'drizzle/0005_vendor_fiscal_machines.sql', 'drizzle/0007_continuous_certificates.sql',
        'drizzle/0008_igtf_amount.sql', 'import/suppliers.json', 'public/upco-logo.png',
        'assets/retention/upco-signature.png', 'assets/retention/upco-seal.png')) {
      if (-not $archive.GetEntry("$releaseRoot/$file")) { throw "Falta $file en el ZIP." }
    }
  } finally {
    $archive.Dispose()
  }
  $stageRoot = Join-Path $upcoRoot ('UPCO-actualizacion-' + [Guid]::NewGuid().ToString('N'))
  $stagedPath = Join-Path $stageRoot $releaseRoot
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $rollbackPath = Join-Path $upcoRoot "Compras-LAN-anterior-$stamp"
  $failedPath = Join-Path $upcoRoot "Compras-LAN-fallida-$stamp"
  foreach ($path in @($installPath, $stageRoot, $rollbackPath, $failedPath)) {
    if ([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($path)).TrimEnd('\') -ne $upcoRoot.TrimEnd('\')) {
      throw 'Ruta de actualización fuera de C:\UPCO.'
    }
  }
  if ([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($stagedPath)).TrimEnd('\') -ne $stageRoot.TrimEnd('\')) {
    throw 'Ruta de extracción fuera del directorio de actualización.'
  }
  foreach ($path in @($stageRoot, $rollbackPath, $failedPath)) {
    if (Test-Path -LiteralPath $path) { throw "Ya existe $path. No se sobrescribirá." }
  }
  Write-Output 'ZIP verificado. Extrayendo la actualización; UPCO sigue disponible mientras tanto...'
  [IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $stageRoot)
  $newNode = Join-Path $stagedPath 'runtime\node.exe'
  $newNodeHash = (Get-FileHash -LiteralPath $newNode -Algorithm SHA256).Hash
  if ($newNodeHash -ne '1C331340FA6CAC5E4294725959070A143FA0507195A78AD77EED7943F719AAC9') {
    throw 'Node.js de la actualización no coincide con el ejecutable oficial.'
  }
  $nodeVersion = & $newNode --version
  if ($LASTEXITCODE -ne 0 -or $nodeVersion -ne 'v24.22.2') {
    throw 'Node.js nuevo no se pudo ejecutar. La instalación actual sigue activa.'
  }
  Copy-Item -LiteralPath $oldConfig -Destination (Join-Path $stagedPath 'install-config.json')

  $serviceStopped = $false
  $oldMoved = $false
  $newMoved = $false
  try {
    Write-Output 'Deteniendo UPCO para respaldar los datos y activar la actualización...'
    $serviceStopped = $true
    Stop-ScheduledTask -TaskName 'UPCO Compras'
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
      if (-not (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)) { break }
      Start-Sleep -Seconds 1
    }
    if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) {
      throw 'UPCO sigue escuchando en el puerto 3000. No se actualizaron los datos.'
    }
    $env:UPCO_DATA_DIR = $dataDir
    $env:UPCO_BACKUP_DIR = $backupDir
    $backupOutput = & $oldNode (Join-Path $installPath 'scripts\backup.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Falló el respaldo de la instalación actual.' }
    $snapshotPath = [string]($backupOutput | Select-Object -Last 1)
    $manifestPath = Join-Path $snapshotPath 'manifest.json'
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw 'Falta el manifiesto del respaldo.' }
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    if ($manifest.counts.vendors -lt 345 -or $manifest.counts.users -lt 1) {
      throw 'El respaldo no contiene los proveedores y el usuario esperados.'
    }
    Write-Output "Respaldo verificado: $($manifest.counts.vendors) proveedores."

    Move-Item -LiteralPath $installPath -Destination $rollbackPath
    $oldMoved = $true
    Move-Item -LiteralPath $stagedPath -Destination $installPath
    $newMoved = $true
    Push-Location $installPath
    try {
      & (Join-Path $installPath 'runtime\node.exe') 'scripts\migrate.mjs'
      if ($LASTEXITCODE -ne 0) { throw 'Falló la migración de la actualización.' }
      $importResult = & (Join-Path $installPath 'runtime\node.exe') 'scripts\import-suppliers.mjs'
      if ($LASTEXITCODE -ne 0) { throw 'Falló la incorporación de los proveedores nuevos.' }
      $importSummary = $importResult | Select-Object -Last 1 | ConvertFrom-Json
      Write-Output "Proveedores incorporados: $($importSummary.inserted)."
    } finally { Pop-Location }
    Start-ScheduledTask -TaskName 'UPCO Compras'
    $ready = $false
    for ($attempt = 0; $attempt -lt 45; $attempt++) {
      try {
        $response = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/login' -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -eq 200) { $ready = $true; break }
      } catch { Start-Sleep -Seconds 1 }
    }
    if (-not $ready) { throw 'La actualización no respondió en el puerto 3000.' }
    Write-Output 'UPCO actualizado. En el celular, abre la dirección Tailscale habitual y revisa un proveedor.'
    Write-Output "Versión anterior conservada temporalmente en $rollbackPath."
  } catch {
    $failure = $_
    Write-Warning "La actualización falló: $($failure.Exception.Message). Intentando restaurar la versión anterior."
    if ($newMoved) {
      try {
        Stop-ScheduledTask -TaskName 'UPCO Compras' -ErrorAction SilentlyContinue
        for ($attempt = 0; $attempt -lt 15; $attempt++) {
          if (-not (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)) { break }
          Start-Sleep -Seconds 1
        }
        Move-Item -LiteralPath $installPath -Destination $failedPath
      } catch { Write-Warning "No se pudo separar la versión fallida: $_" }
    }
    if ($oldMoved -and (Test-Path -LiteralPath $rollbackPath) -and -not (Test-Path -LiteralPath $installPath)) {
      try { Move-Item -LiteralPath $rollbackPath -Destination $installPath }
      catch { Write-Warning "No se pudo restaurar la carpeta anterior: $_" }
    }
    if ($serviceStopped -and (Test-Path -LiteralPath (Join-Path $installPath 'runtime\node.exe'))) {
      try { Start-ScheduledTask -TaskName 'UPCO Compras' }
      catch { Write-Warning "No se pudo reiniciar UPCO: $_" }
    }
    throw $failure
  }
} catch {
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host 'No repita el proceso. Envíeme una captura de esta ventana.'
} finally {
  if ($stageRoot -and (Test-Path -LiteralPath $stageRoot)) {
    $fullStageRoot = [IO.Path]::GetFullPath($stageRoot)
    if ([IO.Path]::GetDirectoryName($fullStageRoot).TrimEnd('\') -eq $upcoRoot.TrimEnd('\') -and
        [IO.Path]::GetFileName($fullStageRoot) -match '^UPCO-actualizacion-[0-9a-f]{32}$' -and
        ((Get-Item -LiteralPath $fullStageRoot).Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) {
      try { Remove-Item -LiteralPath $fullStageRoot -Recurse -Force }
      catch { Write-Warning "No se pudo limpiar la extracción temporal: $_" }
    }
  }
}
