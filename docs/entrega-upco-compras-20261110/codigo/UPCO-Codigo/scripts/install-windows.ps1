param(
  [string]$InstallDir = 'C:\UPCO\Compras',
  [string]$DataDir = 'C:\ProgramData\UPCO\Compras',
  [string]$BackupDir = 'C:\ProgramData\UPCO\Backups',
  [switch]$RegisterTask
)
$ErrorActionPreference = 'Stop'
$InstallDir = [System.IO.Path]::GetFullPath($InstallDir)
$DataDir = [System.IO.Path]::GetFullPath($DataDir)
$BackupDir = [System.IO.Path]::GetFullPath($BackupDir)
if (-not (Test-Path -LiteralPath (Join-Path $InstallDir 'server.js'))) { throw "No está el paquete release en $InstallDir" }
$node = (Get-Command node -ErrorAction Stop).Source
$version = (& $node --version).Trim()
if ([int]($version.TrimStart('v').Split('.')[0]) -lt 24) { throw 'Se requiere Node.js 24 o superior.' }
if ($RegisterTask) {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Ejecute como administrador para registrar la tarea y proteger los datos.' }
}
New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
if ($RegisterTask -and $InstallDir -eq 'C:\UPCO\Compras' -and $DataDir -eq 'C:\ProgramData\UPCO\Compras' -and $BackupDir -eq 'C:\ProgramData\UPCO\Backups') {
  foreach ($target in @($InstallDir, $DataDir, $BackupDir)) {
    $resolved = (Resolve-Path -LiteralPath $target).ProviderPath
    if ($resolved -ne $target) { throw "Ruta inesperada para permisos: $resolved" }
    # Los archivos existentes necesitan un permiso efectivo, además del heredable para archivos futuros.
    & icacls.exe $target /grant:r '*S-1-5-18:F' '*S-1-5-32-544:F' /T | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "No se pudo aplicar permisos efectivos de SYSTEM/Administradores en $target" }
    & icacls.exe $target /grant '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' /T | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "No se pudo aplicar permisos heredables de SYSTEM/Administradores en $target" }
    & icacls.exe $target /inheritance:r /T | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "No se pudo restringir herencia de permisos en $target" }
  }
} elseif ($RegisterTask) {
  Write-Warning 'Se usaron carpetas personalizadas. Revise manualmente los permisos del código, importación y datos antes de cargar información fiscal.'
}
$configJson = @{ dataDir = $DataDir; backupDir = $BackupDir } | ConvertTo-Json -Compress
[IO.File]::WriteAllText((Join-Path $InstallDir 'install-config.json'), $configJson, [Text.UTF8Encoding]::new($false))
$env:UPCO_DATA_DIR = $DataDir
$env:UPCO_BACKUP_DIR = $BackupDir
Push-Location $InstallDir
try {
  & $node 'scripts/migrate.mjs'
  if ($LASTEXITCODE -ne 0) { throw 'Falló la migración.' }
  & $node 'scripts/import-suppliers.mjs'
  if ($LASTEXITCODE -ne 0) { throw 'Falló la importación de proveedores.' }
  & $node 'scripts/create-admin.mjs' '--if-empty'
  if ($LASTEXITCODE -ne 0) { throw 'Falló la creación del usuario administrador.' }
} finally { Pop-Location }
if ($RegisterTask) {
  [Environment]::SetEnvironmentVariable('UPCO_DATA_DIR', $DataDir, 'Machine')
  [Environment]::SetEnvironmentVariable('UPCO_BACKUP_DIR', $BackupDir, 'Machine')
  $action = New-ScheduledTaskAction -Execute $node -Argument ('"' + (Join-Path $InstallDir 'scripts\start.mjs') + '"') -WorkingDirectory $InstallDir
  $trigger = New-ScheduledTaskTrigger -AtStartup
  $settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Seconds 0)
  $taskPrincipal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
  Register-ScheduledTask -TaskName 'UPCO Compras' -Action $action -Trigger $trigger -Settings $settings -Principal $taskPrincipal -Force | Out-Null
  Start-ScheduledTask -TaskName 'UPCO Compras'
  Write-Output 'Tarea UPCO Compras registrada e iniciada en 127.0.0.1:3000.'
}
