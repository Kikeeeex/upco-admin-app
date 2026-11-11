# Actualización de UPCO Compras en UPCO SERVER

Esta actualización conserva la base de datos, los 345 proveedores, los usuarios,
los documentos y los adjuntos. Abre el formulario de compra con un CECO listo
para seleccionar al 100 % y permite añadir más. Una compra totalmente exenta
no emite comprobante de retención de IVA. Incorpora el cierre contable por rango
de fechas, con descripciones y distribución por CECO, y la importación de
documentos anteriores que tengas disponibles mediante una vista previa antes de guardar.
Cuando se emiten retenciones de IVA e ISLR juntas, descarga un solo PDF de dos
páginas. Los comprobantes históricos originales no se regeneran; conserva sus
archivos previos como soporte.

## Instalar

1. En la carpeta sincronizada `_UPCO COMPRAS INSTALADOR` de UPCO SERVER,
   comprueba que estén `UPCO-Compras-Actualizacion-20261109.zip`,
   `UPCO-Compras-Actualizacion-20261109.sha256`, `ACTUALIZAR-UPCO.cmd` y
   `update-lan-windows.ps1`.
2. Haz doble clic en `ACTUALIZAR-UPCO.cmd` y acepta el aviso de administrador.
   La extracción puede tardar varios minutos. La plataforma sigue disponible
   durante esa etapa; la ventana avisará antes de detenerla brevemente para
   respaldar y cambiar el programa. Si el título de la ventana dice
   `Seleccionar`, pulsa `Esc` para reanudarla.
3. Espera el mensaje `UPCO actualizado`. Si aparece `ERROR`, deja la ventana
   abierta y envía una captura. El actualizador intenta restaurar la versión
   anterior si la nueva no inicia.

## Comprobar

- En el celular con Tailscale, abre `http://100.124.102.124:3000/login`.
- En la oficina, abre `http://192.168.1.152:3000/login`.
- Abre un documento nuevo: debe aparecer un CECO vacío al 100 %, junto al
  selector de cuenta de pago. Añade un segundo CECO y comprueba que el sistema
  exija repartir exactamente el 100 %.
- Registra una compra de prueba solo con monto exento: el resumen y el documento
  no deben asignarle retención ni comprobante de IVA.
- Emite una compra de prueba con retenciones de IVA e ISLR: debe descargarse un
  PDF de dos páginas, una por cada comprobante.
- En Reportes, usa Cierre contable por fechas con un rango y verifica que el Excel
  incluya documentos, descripciones, cuentas y el reparto por CECO.
- Importa primero una hoja histórica de prueba y revisa la vista previa: las
  filas duplicadas o inválidas deben señalarse antes de confirmar. Comprueba
  que queden los números originales y que no consuman nuevos correlativos.
- Exporta el libro de compras y el TXT de IVA de la quincena: deben incluir los
  documentos históricos que correspondan. Las filas que comparten un mismo
  comprobante de retención se bloquean para revisión manual antes de importar.
  Los documentos exentos quedan en el libro sin retención.

Si una sola factura tiene bases al 16 % y al 8 %, el libro muestra ambas. El
TXT se detiene para esa factura hasta validar con el portal cómo representar
las dos alícuotas sin duplicar el número de control.
También se detiene si una nota de crédito con retención ajusta una factura de
otra quincena o mes, hasta revisar su tratamiento en el portal.

El actualizador deja el código anterior en una carpeta
`C:\UPCO\Compras-LAN-anterior-*` hasta que terminen estas pruebas. Los datos
siguen en `C:\ProgramData\UPCO\Compras`; los respaldos en
`C:\ProgramData\UPCO\Backups`. Las reglas LAN y Tailscale conservan el puerto
3000 porque el programa nuevo ocupa la misma ruta que el anterior.
