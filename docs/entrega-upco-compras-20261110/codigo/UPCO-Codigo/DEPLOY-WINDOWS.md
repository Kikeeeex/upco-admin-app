# Instalar UPCO Compras en el servidor Windows

Esta guía es para un servidor físico Windows 10/11 x64. La aplicación corre en el servidor y se usa desde el navegador. [Next.js admite servidores Node](https://nextjs.org/docs/app/getting-started/deploying); [Tailscale Serve publica un servicio local solo dentro de la tailnet](https://tailscale.com/docs/features/tailscale-serve), usando HTTPS y las reglas de acceso de esa red.

## 1. Preparar el paquete

Si ya recibiste `UPCO-Compras-Windows-20261107.zip`, extráelo. Dentro encontrarás la carpeta `upco-compras-20261107-004315`. Copia **el contenido de esa carpeta** al servidor en `C:\UPCO\Compras`; la carpeta final debe contener `server.js` y `scripts\install-windows.ps1` directamente.

Para reconstruir un paquete nuevo desde el código fuente, dentro de `upco-compras`:

```powershell
pnpm install --frozen-lockfile
pnpm build
pnpm package:windows
```

El último comando muestra una carpeta nueva `release/upco-compras-<fecha>`. El paquete incluye 345 proveedores consolidados en `import/suppliers.json`; excluye las bases locales, `.test-data`, contraseñas y adjuntos. Transfiérelo por un canal privado porque el padrón contiene datos fiscales.

## 2. Instalar en el servidor

Instala [Tailscale para Windows](https://tailscale.com/download/windows) desde su sitio oficial y conecta el servidor a la tailnet de UPCO. Se requiere Node.js 24 o superior. Si el servidor ya usa Node 22 para otros programas, conserva esa versión e instala **Node 24 portátil solo para UPCO Compras**:

1. Crea `C:\UPCO\Compras\runtime` y guarda allí, con el nombre `node.exe`, el [binario oficial de Node.js 24.22.2 para Windows x64](https://nodejs.org/dist/v24.22.2/win-x64/node.exe). La [publicación oficial](https://nodejs.org/en/blog/release/v24.22.2) identifica el archivo y su SHA-256.
2. Abre PowerShell **como administrador**. Verifica el archivo descargado y selecciona Node 24 para esta ventana antes de ejecutar el instalador:

```powershell
$UpcoNode24 = 'C:\UPCO\Compras\runtime\node.exe'
$UpcoHash = (Get-FileHash -LiteralPath $UpcoNode24 -Algorithm SHA256).Hash
if ($UpcoHash -ne '1C331340FA6CAC5E4294725959070A143FA0507195A78AD77EED7943F719AAC9') { throw 'El SHA-256 de Node 24 no coincide con el publicado.' }
$env:Path = 'C:\UPCO\Compras\runtime;' + $env:Path
node --version
(Get-Command node).Source
cd C:\UPCO\Compras
.\scripts\install-windows.ps1 -RegisterTask
```

La versión debe mostrar `v24.22.2` y la ruta de `Get-Command` debe ser `C:\UPCO\Compras\runtime\node.exe`. El instalador registra la tarea con la ruta absoluta de ese ejecutable, de modo que Node 22 sigue disponible para las demás aplicaciones. Al proteger `C:\UPCO\Compras`, el instalador también restringe el acceso al ejecutable portátil. Utiliza el instalador actualizado: sus permisos efectivos mantienen ejecutables los archivos existentes después de restringir la carpeta.

Como alternativa, si el servidor no necesita conservar su versión actual, puedes [instalar Node.js 24 de forma global](https://nodejs.org/en/download). En ese caso, verifica `node --version` y ejecuta desde PowerShell como administrador:

```powershell
cd C:\UPCO\Compras
.\scripts\install-windows.ps1 -RegisterTask
```

El instalador crea `C:\ProgramData\UPCO\Compras\upco.sqlite`, importa los 345 proveedores sin repetir RIF, solicita el primer usuario y contraseña en la terminal, guarda las rutas persistentes en `install-config.json` y registra la tarea de inicio **UPCO Compras**. Solo requiere Node.js en el servidor; no requiere pnpm ni Docker. La app escucha únicamente en `127.0.0.1:3000`.

Si la política de PowerShell impide ejecutar el archivo, ejecuta sus comandos manualmente o configura una política de ejecución adecuada según las reglas de TI de UPCO. No desactives la protección para todo el equipo por este proyecto.

Con las rutas predeterminadas y `-RegisterTask`, el instalador restringe los permisos de `C:\UPCO\Compras`, `C:\ProgramData\UPCO\Compras` y `C:\ProgramData\UPCO\Backups` a **SYSTEM** y administradores. Otorga acceso efectivo a los archivos existentes y acceso heredable a los nuevos. Esto protege también el padrón fiscal incluido en el paquete. Si eliges rutas personalizadas, revisa manualmente sus permisos antes de importar. Las facturas adjuntas y la base contable se guardan en ProgramData. Si usas Node portátil, conserva `C:\UPCO\Compras\runtime` al actualizar: la tarea de inicio apunta a ese `node.exe`.

## 3. Abrir por Tailscale

En el servidor, con Tailscale conectado:

```powershell
tailscale serve --bg 3000
tailscale serve status
```

Tailscale mostrará una dirección `https://<servidor>.<tailnet>.ts.net/`. Abre esa dirección desde un equipo autorizado conectado a la misma tailnet e ingresa con el usuario creado. Restringe el acceso al servidor a las personas de UPCO mediante las [reglas de acceso de Tailscale](https://tailscale.com/docs/features/access-control/grants). Usa **Serve**; Funnel publica en Internet y no se necesita aquí.

Comprueba que la URL no abre al desconectar Tailscale en un equipo remoto. El servicio debe permanecer encendido y conectado para que otros usuarios accedan.

## 4. Validar la importación

En Proveedores debe aparecer el total indicado por el consolidado después de la primera instalación. Todos quedan marcados para revisar la condición de contribuyente, porque los PDF antiguos no la identifican de forma confiable. Revisa también los proveedores cuyo porcentaje de retención IVA se dejó provisional. Confirma esos datos en la ficha antes de usar el proveedor para una nueva retención.

Si necesitas repetir la carga sin perder correcciones manuales, abre PowerShell como administrador. Con Node portátil, selecciona su ruta en esta nueva ventana antes de ejecutar `node`:

```powershell
cd C:\UPCO\Compras
$env:Path = 'C:\UPCO\Compras\runtime;' + $env:Path
$env:UPCO_DATA_DIR='C:\ProgramData\UPCO\Compras'
node scripts\import-suppliers.mjs
```

El programa omitirá los RIF existentes. `--update-existing` reemplaza sus datos con el consolidado y debe usarse solo tras revisar el impacto.

## 5. Respaldar y restaurar

Para un respaldo coherente de SQLite y adjuntos, detén la tarea antes de ejecutarlo:

```powershell
Stop-ScheduledTask -TaskName 'UPCO Compras'
cd C:\UPCO\Compras
$env:Path = 'C:\UPCO\Compras\runtime;' + $env:Path
$env:UPCO_DATA_DIR='C:\ProgramData\UPCO\Compras'
$env:UPCO_BACKUP_DIR='C:\ProgramData\UPCO\Backups'
node scripts\backup.mjs
Start-ScheduledTask -TaskName 'UPCO Compras'
```

Cada carpeta de respaldo contiene `upco.sqlite`, `attachments/` y `manifest.json`. Guarda una copia cifrada fuera del servidor y prueba periódicamente la restauración en otro equipo.

Para restaurar, detén la tarea; conserva la carpeta de datos actual con otro nombre; crea de nuevo `C:\ProgramData\UPCO\Compras`; copia allí `upco.sqlite` y `attachments/` desde **un mismo respaldo**; inicia la tarea y verifica proveedores, documentos y archivos. No combines bases y adjuntos de respaldos distintos. No sustituyas una base activa.

## 6. Actualizar

Respalda primero. Detén la tarea y reemplaza el contenido de `C:\UPCO\Compras` por un paquete nuevo **sin borrar `runtime\node.exe`** ni tocar `C:\ProgramData\UPCO\Compras`. Abre PowerShell como administrador; si usas Node portátil, antepón `C:\UPCO\Compras\runtime` a `$env:Path` en esa ventana. Vuelve a ejecutar `node scripts\migrate.mjs` con `UPCO_DATA_DIR` establecido e inicia la tarea. Revisa la página de inicio y una descarga de prueba.
