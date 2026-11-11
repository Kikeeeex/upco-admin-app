param(
  [string]$InstallDir = 'C:\UPCO\Compras-LAN',
  [string]$DataDir = 'C:\ProgramData\UPCO\Compras',
  [string]$BackupDir = 'C:\ProgramData\UPCO\Backups',
  [string]$LanInterfaceAlias = 'Ethernet 2'
)

$ErrorActionPreference = 'Stop'
$InstallDir = [IO.Path]::GetFullPath($InstallDir)
$DataDir = [IO.Path]::GetFullPath($DataDir)
$BackupDir = [IO.Path]::GetFullPath($BackupDir)
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Abra PowerShell como administrador para instalar UPCO en la red local.'
}
$node = Join-Path $InstallDir 'runtime\node.exe'
$server = Join-Path $InstallDir 'server.js'
$database = Join-Path $DataDir 'upco.sqlite'
foreach ($required in @($node, $server, $database)) {
  if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Falta el archivo requerido: $required" }
}
$nodeHash = (Get-FileHash -LiteralPath $node -Algorithm SHA256).Hash
if ($nodeHash -ne '1C331340FA6CAC5E4294725959070A143FA0507195A78AD77EED7943F719AAC9') {
  throw 'El ejecutable Node.js no coincide con el archivo oficial verificado.'
}
$nodeVersion = & $node --version
if ($LASTEXITCODE -ne 0 -or $nodeVersion -ne 'v24.22.2') {
  throw 'Node.js no se puede ejecutar o tiene una versión inesperada. La instalación anterior no se ha detenido.'
}
$lanAddresses = @(Get-NetIPAddress -InterfaceAlias $LanInterfaceAlias -AddressFamily IPv4 |
  Where-Object { $_.AddressState -eq 'Preferred' -and $_.IPAddress -notlike '169.254.*' })
if ($lanAddresses.Count -ne 1) { throw "Se esperaba una sola dirección IPv4 activa en $LanInterfaceAlias." }
$lanIp = $lanAddresses[0].IPAddress
$lanConfiguration = Get-NetIPConfiguration -InterfaceAlias $LanInterfaceAlias
if (-not $lanConfiguration.IPv4DefaultGateway) { throw "La interfaz $LanInterfaceAlias no tiene puerta de enlace IPv4." }
$profile = (Get-NetConnectionProfile -InterfaceAlias $LanInterfaceAlias).NetworkCategory
$taskName = 'UPCO Compras'
$previousTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if (-not $previousTask) { throw "No existe la tarea $taskName. Esta instalación LAN requiere la base y la instalación anterior." }
$firewallName = 'UPCO-Compras-LAN'
if (Get-NetFirewallRule -Name $firewallName -ErrorAction SilentlyContinue) {
  throw "Ya existe la regla $firewallName. Revise la instalación LAN anterior antes de repetirla."
}
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
$previousTaskXml = Export-ScheduledTask -TaskName $taskName
$taskBackup = Join-Path $BackupDir ("UPCO-Compras-task-before-LAN-{0}.xml" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
[IO.File]::WriteAllText($taskBackup, $previousTaskXml, [Text.UTF8Encoding]::new($false))
$taskReplaced = $false
$firewallCreated = $false
try {
  Stop-ScheduledTask -TaskName $taskName
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    if (-not (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)) { break }
    Start-Sleep -Seconds 1
  }
  if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) {
    throw 'La instalación anterior sigue escuchando en el puerto 3000. No se puede respaldar con seguridad.'
  }
  $env:UPCO_DATA_DIR = $DataDir
  $env:UPCO_BACKUP_DIR = $BackupDir
  $backupOutput = & $node (Join-Path $InstallDir 'scripts\backup.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'Falló el respaldo previo a la instalación LAN.' }
  $backupPath = [string]($backupOutput | Select-Object -Last 1)
  $manifestPath = Join-Path $backupPath 'manifest.json'
  if (-not (Test-Path -LiteralPath $manifestPath)) { throw 'El respaldo no produjo manifest.json.' }
  $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  if ($manifest.counts.vendors -lt 345 -or $manifest.counts.users -lt 1) {
    throw 'El respaldo no contiene los proveedores y el usuario esperados.'
  }
  Write-Output "Respaldo verificado: $backupPath ($($manifest.counts.vendors) proveedores)."
  $installConfig = @{ dataDir = $DataDir; backupDir = $BackupDir; listenHost = '0.0.0.0' } | ConvertTo-Json -Compress
  [IO.File]::WriteAllText((Join-Path $InstallDir 'install-config.json'), $installConfig, [Text.UTF8Encoding]::new($false))
  Push-Location $InstallDir
  try {
    & $node 'scripts\migrate.mjs'
    if ($LASTEXITCODE -ne 0) { throw 'Falló la migración de la base.' }
  } finally { Pop-Location }
  New-NetFirewallRule -Name $firewallName -DisplayName 'UPCO Compras - red local' -Enabled True -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -Program $node -InterfaceAlias $LanInterfaceAlias -RemoteAddress LocalSubnet -Profile Any | Out-Null
  $firewallCreated = $true
  $action = New-ScheduledTaskAction -Execute $node -Argument ('"' + (Join-Path $InstallDir 'scripts\start.mjs') + '"') -WorkingDirectory $InstallDir
  $trigger = New-ScheduledTaskTrigger -AtStartup
  $settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Seconds 0)
  $taskPrincipal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
  $taskReplaced = $true
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $taskPrincipal -Force | Out-Null
  Start-ScheduledTask -TaskName $taskName
  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
      $response = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/login' -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -eq 200) { $ready = $true; break }
    } catch { Start-Sleep -Seconds 1 }
  }
  if (-not $ready) { throw 'La nueva tarea inició, pero UPCO no respondió en el puerto 3000.' }
  $lanResponse = Invoke-WebRequest -Uri "http://${lanIp}:3000/login" -UseBasicParsing -TimeoutSec 5
  if ($lanResponse.StatusCode -ne 200) { throw 'UPCO no respondió en la dirección local del servidor.' }
  Write-Output "UPCO LAN listo: http://${lanIp}:3000/login"
  Write-Output "Interfaz: $LanInterfaceAlias ($profile). Firewall: solo subred local."
  Write-Output 'Pruebe esa dirección desde otro equipo de la misma red antes de retirar los archivos anteriores.'
} catch {
  $failure = $_
  if ($taskReplaced) {
    try { Register-ScheduledTask -TaskName $taskName -Xml $previousTaskXml -Force | Out-Null }
    catch { Write-Warning "No se pudo restaurar la tarea anterior: $_" }
  }
  if ($firewallCreated) {
    try { Remove-NetFirewallRule -Name $firewallName }
    catch { Write-Warning "No se pudo retirar la regla de firewall nueva: $_" }
  }
  try { Start-ScheduledTask -TaskName $taskName }
  catch { Write-Warning "No se pudo iniciar la tarea anterior: $_" }
  throw $failure
}
