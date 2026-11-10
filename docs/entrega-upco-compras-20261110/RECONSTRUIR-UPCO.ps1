param(
  [string]$Carpeta = $PSScriptRoot
)

$ErrorActionPreference = 'Stop'
$nombre = 'UPCO-Entrega-Integral-20261110.zip'
$esperado = '1bdcfa10fb5124acb43e9882aec5dc3978e25cd688fd051645f2d23b8da2938f'
$partes = @(Get-ChildItem -LiteralPath $Carpeta -Filter "$nombre.*" -File |
  Where-Object { $_.Name -match '\.\d{3}$' } | Sort-Object Name)
if ($partes.Count -ne 7) { throw "Se esperaban 7 partes; se encontraron $($partes.Count)." }
for ($i = 0; $i -lt $partes.Count; $i++) {
  $sufijo = '{0:D3}' -f ($i + 1)
  if (-not $partes[$i].Name.EndsWith(".$sufijo")) { throw "Falta la parte $sufijo." }
}

$destino = Join-Path $Carpeta $nombre
$salida = [System.IO.File]::Open($destino, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
try {
  foreach ($parte in $partes) {
    $entrada = [System.IO.File]::OpenRead($parte.FullName)
    try { $entrada.CopyTo($salida) } finally { $entrada.Dispose() }
  }
} finally { $salida.Dispose() }

$real = (Get-FileHash -LiteralPath $destino -Algorithm SHA256).Hash.ToLowerInvariant()
if ($real -ne $esperado) { throw "SHA-256 distinto: $real. No uses el ZIP." }
Write-Host "ZIP reconstruido y verificado: $destino"

