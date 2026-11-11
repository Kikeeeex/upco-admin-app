$ErrorActionPreference = 'Stop'

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  $arguments = '-NoExit -NoProfile -ExecutionPolicy Bypass -File "' + $PSCommandPath + '"'
  Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -Verb RunAs
  return
}

try {
  $installPath = 'C:\UPCO\Compras-LAN'
  $node = Join-Path $installPath 'runtime\node.exe'
  $start = Join-Path $installPath 'scripts\start.mjs'
  if (-not (Test-Path -LiteralPath $node -PathType Leaf) -or -not (Test-Path -LiteralPath $start -PathType Leaf)) {
    throw 'No se encontró la instalación LAN en C:\UPCO\Compras-LAN.'
  }
  $task = Get-ScheduledTask -TaskName 'UPCO Compras' -ErrorAction Stop
  if ($task.Actions[0].Execute.Trim('"') -ne $node -or $task.Actions[0].Arguments -notlike "*$start*") {
    throw 'La tarea UPCO Compras todavía no apunta a la versión LAN.'
  }
  $listening = @(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalAddress -eq '0.0.0.0' })
  if ($listening.Count -eq 0) { throw 'UPCO no está escuchando para conexiones de red en el puerto 3000.' }

  $tailscale = Get-Command 'tailscale.exe' -ErrorAction SilentlyContinue
  if (-not $tailscale -and (Test-Path -LiteralPath 'C:\Program Files\Tailscale\tailscale.exe')) {
    $tailscale = Get-Command 'C:\Program Files\Tailscale\tailscale.exe'
  }
  if (-not $tailscale) { throw 'No se encontró Tailscale en UPCO SERVER.' }
  $tailIp = [string]((& $tailscale.Source ip -4) | Select-Object -First 1)
  if ($LASTEXITCODE -ne 0) { throw 'Tailscale no entregó la IP del servidor.' }
  $tailIp = $tailIp.Trim()
  $octets = $tailIp -split '\.'
  if ($octets.Count -ne 4 -or $octets[0] -ne '100' -or [int]$octets[1] -lt 64 -or [int]$octets[1] -gt 127) {
    throw "La IP de Tailscale no tiene el formato esperado: $tailIp"
  }
  $tailAddress = @(Get-NetIPAddress -IPAddress $tailIp -AddressFamily IPv4 -ErrorAction Stop)
  if ($tailAddress.Count -ne 1) { throw 'No se pudo identificar una sola interfaz Tailscale.' }
  $adapter = Get-NetAdapter -InterfaceIndex $tailAddress[0].InterfaceIndex -ErrorAction Stop
  if ($adapter.InterfaceDescription -notmatch 'Tailscale' -and $adapter.Name -notmatch 'Tailscale') {
    throw 'La IP indicada no corresponde al adaptador Tailscale.'
  }

  $ruleName = 'UPCO-Compras-Tailnet'
  if (Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue) {
    throw "Ya existe la regla $ruleName. No se modificó el firewall."
  }
  New-NetFirewallRule -Name $ruleName -DisplayName 'UPCO Compras - Tailscale' `
    -Enabled True -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 `
    -LocalAddress $tailIp -RemoteAddress '100.64.0.0/10' -Program $node `
    -InterfaceAlias $tailAddress[0].InterfaceAlias -Profile Any | Out-Null
  if (-not (Get-NetFirewallRule -Name $ruleName -PolicyStore ActiveStore -ErrorAction SilentlyContinue)) {
    Remove-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue
    throw 'La regla no quedó activa. No se mantuvo el cambio.'
  }
  Write-Output "Acceso Tailscale directo habilitado: http://${tailIp}:3000/login"
  Write-Output 'En el celular, conecte Tailscale y abra exactamente esa dirección en Safari o Chrome.'
  Write-Output 'El acceso normal de la oficina por 192.168.1.x permanece disponible.'
} catch {
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host 'Envíeme una captura de esta ventana.'
}
