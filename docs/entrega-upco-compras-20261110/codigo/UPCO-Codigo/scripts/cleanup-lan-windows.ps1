$ErrorActionPreference = 'Stop'

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  $arguments = '-NoExit -NoProfile -ExecutionPolicy Bypass -File "' + $PSCommandPath + '"'
  Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -Verb RunAs
  return
}

$oldPath = 'C:\UPCO\Compras'
$newPath = 'C:\UPCO\Compras-LAN'
$dataPath = 'C:\ProgramData\UPCO\Compras\upco.sqlite'
$backupPath = 'C:\ProgramData\UPCO\Backups'
$expectedNode = Join-Path $newPath 'runtime\node.exe'
$expectedStart = Join-Path $newPath 'scripts\start.mjs'
$oldItem = Get-Item -LiteralPath $oldPath -ErrorAction SilentlyContinue
if (-not $oldItem) { Write-Output 'La carpeta anterior ya no existe. No hay nada que borrar.'; return }
if ($oldItem.FullName -ne $oldPath -or -not $oldItem.PSIsContainer -or
    (($oldItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {
  throw 'La carpeta anterior no coincide con la ruta esperada. No se borró nada.'
}
foreach ($required in @($expectedNode, $expectedStart, $dataPath)) {
  if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Falta $required. No se borró nada." }
}
if (-not (Test-Path -LiteralPath $backupPath -PathType Container)) { throw 'No hay carpeta de respaldos. No se borró nada.' }
$task = Get-ScheduledTask -TaskName 'UPCO Compras' -ErrorAction Stop
$taskExecute = $task.Actions[0].Execute.Trim('"')
if ($taskExecute -ne $expectedNode -or $task.Actions[0].Arguments -notlike "*$expectedStart*") {
  throw 'La tarea de UPCO no apunta a la instalación LAN. No se borró nada.'
}
$lanRule = Get-NetFirewallRule -Name 'UPCO-Compras-LAN' -ErrorAction Stop
if ($lanRule.Enabled -ne 'True') { throw 'La regla LAN no está habilitada. No se borró nada.' }
$response = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/login' -UseBasicParsing -TimeoutSec 5
if ($response.StatusCode -ne 200) { throw 'La aplicación LAN no responde. No se borró nada.' }

Write-Output 'Pruebe UPCO desde OTRO equipo de la misma red de la oficina.'
Write-Output 'Abra Proveedores y compruebe que aparecen los datos anteriores.'
$answer = Read-Host 'Si ya lo comprobó, escriba BORRAR para retirar el programa anterior; Enter deja todo como está'
if ($answer.Trim().ToUpperInvariant() -ne 'BORRAR') { Write-Output 'Limpieza aplazada. La instalación LAN sigue activa.'; return }

$tailscale = Get-Command 'tailscale.exe' -ErrorAction SilentlyContinue
if ($tailscale) {
  $serveStatus = (& $tailscale.Source serve status 2>&1 | Out-String)
  if ($LASTEXITCODE -eq 0 -and $serveStatus -match '(127\.0\.0\.1|localhost):3000') {
    & $tailscale.Source serve --https=443 off
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo apagar la publicación anterior en Tailscale. No se borró la carpeta.' }
    Write-Output 'Publicación anterior de UPCO en Tailscale apagada.'
  } else {
    Write-Output 'No se detectó una publicación de UPCO en Tailscale; no se modificó Tailscale.'
  }
} else {
  Write-Warning 'No se encontró tailscale.exe. Compruebe manualmente que Serve no publique UPCO.'
}

Add-Type -AssemblyName Microsoft.VisualBasic
[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory(
  $oldPath,
  [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs,
  [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin
)
if (Test-Path -LiteralPath $oldPath) { throw 'Windows no retiró la carpeta anterior. Compruebe la Papelera y la carpeta.' }
Write-Output 'Programa anterior enviado a la Papelera. La base de datos y los respaldos permanecen en C:\ProgramData\UPCO.'
