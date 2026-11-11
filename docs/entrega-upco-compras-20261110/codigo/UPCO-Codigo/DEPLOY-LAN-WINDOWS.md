# UPCO Compras en la red local de la oficina

Esta modalidad funciona en Windows 10 y 11 sin Tailscale. Conserva la base, usuarios,
proveedores y adjuntos existentes en `C:\ProgramData\UPCO\Compras`. El paquete LAN
no contiene datos de proveedores ni contraseñas.

## Preparación

1. En UPCO SERVER, abre la carpeta sincronizada `_UPCO COMPRAS INSTALADOR`.
   Espera a que estén completos el ZIP, su archivo SHA256 y los archivos
   `INSTALAR-UPCO-LAN.cmd`, `install-lan-bootstrap.ps1`,
   `LIMPIAR-UPCO-ANTERIOR.cmd` y `cleanup-lan-windows.ps1`:
   `UPCO-Compras-LAN-20261107.zip` (aprox. 135 MB) y
   `UPCO-Compras-LAN-20261107.sha256`.
2. Haz doble clic en `INSTALAR-UPCO-LAN.cmd` y acepta la solicitud de
   administrador de Windows. La ventana que se abre verifica el ZIP, extrae
   el programa directamente en `C:\UPCO\Compras-LAN` y ejecuta la instalación.
   Puede tardar varios minutos. Deja esa ventana abierta y toma una captura
   del resultado.
3. Cuando el instalador muestre la dirección LAN, ábrela en otro equipo de la
   red de UPCO y comprueba que estén los proveedores. La misma ventana te
   pedirá escribir `BORRAR`: hazlo solo después de esa prueba. Esto envía
   `C:\UPCO\Compras` a la Papelera y apaga la publicación anterior de UPCO
   en Tailscale. Si aún no puedes probar, pulsa Enter; luego ejecuta
   `LIMPIAR-UPCO-ANTERIOR.cmd` para completar la limpieza.

La instalación anterior en `C:\UPCO\Compras` se conserva hasta probar la nueva
desde otro dispositivo. El instalador la detiene y deja un respaldo para volver
atrás si se presenta un error.

El instalador verifica Node.js, detecta la IPv4 de `Ethernet 2`, detiene la tarea
anterior, crea y revisa un respaldo de SQLite y adjuntos, conserva el usuario,
registra la nueva tarea y permite el puerto 3000 solo a la subred local que entra
por `Ethernet 2`. Si falla, intenta restaurar la tarea anterior.

## Probar

En otro equipo conectado a la red normal de UPCO, abre la dirección que imprimió
el instalador. La dirección observada al preparar este paquete fue
`http://192.168.1.152:3000/login`. Usa el usuario y contraseña ya creados.
Comprueba Proveedores y descarga un comprobante o reporte. La red Wi-Fi de
invitados puede impedir la comunicación aunque tenga Internet.

La dirección `192.168.1.152` está asignada por DHCP. Conviene reservarla en el
router de UPCO para que no cambie. Si cambia, usa la nueva IPv4 que muestra
Windows; la regla de firewall sigue limitada a la tarjeta y subred local.

## Celulares y equipos conectados por Tailscale

Estar en el mismo tailnet no equivale a estar en la red física `192.168.1.x`.
En UPCO SERVER, ejecuta una vez `HABILITAR-UPCO-TAILSCALE.cmd` desde la misma
carpeta del instalador. Agrega una segunda regla limitada al adaptador Tailscale,
al puerto 3000 y a las direcciones del tailnet. Conserva la regla LAN.

Con Tailscale conectado en el celular, abre en Safari o Chrome la dirección
`http://100.124.102.124:3000/login`. Usa `http://` y el puerto `:3000`.
Si la IP del servidor cambia, usa la dirección que imprime el lanzador. Esto
usa acceso directo por IP de Tailscale; no necesita Tailscale Serve ni el nombre
`ts.net`. Si falla, revisa que la política del tailnet permita TCP 3000.

## Seguridad y limpieza

Esta modalidad usa HTTP en la red local. El inicio de sesión sigue siendo
obligatorio, pero la contraseña, las sesiones y los datos fiscales viajan sin
cifrado entre el navegador y el servidor. Úsala únicamente en la red confiable
de la oficina. Para cifrado sin depender de Tailscale se necesitará un
certificado HTTPS y configurar su confianza o el dominio de UPCO.

La limpieza solo retira el programa antiguo y su publicación de UPCO en
Tailscale Serve; no desinstala Tailscale para otros usos. Conserva
`C:\ProgramData\UPCO\Compras` y `C:\ProgramData\UPCO\Backups`. La tarea
`UPCO Compras` ya apunta al programa LAN.
