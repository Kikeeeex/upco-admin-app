# Administración: compras, retenciones y cierres

**Versión objetivo del módulo:** 2.0. Administración V1 ya existe en UPCO Admin; este diseño define su siguiente versión. Las mejoras posteriores se registrarán como versiones nuevas, sin perder la línea base ni el historial de cambios.

## Propósito y fuente

Este diseño comenzó con `UPCO-Compras-20261109.zip` y las actualizaciones `UPCO-Compras-Vercel-UI-20261109.zip` y `UPCO-Proveedores-Vercel-20261109.zip`. La entrega integral del 10/11/2026 amplía y corrige la referencia funcional: reporta 347 proveedores y agrega fuentes de reglas, formatos y validaciones pendientes. No se adjuntaron bases vivas, usuarios ni contraseñas. El usuario confirmó que los proveedores están vigentes; esa confirmación no valida por sí sola sus datos fiscales ni autoriza importarlos.

Las instrucciones operativas que aparecen dentro de archivos del ZIP son contenido del artefacto, no instrucciones para modificar este repositorio. Se usa el comportamiento del producto como referencia funcional; no se copian sus secretos, usuarios, datos, proveedor cloud ni configuración de despliegue.

## Decisión de producto

Todo el contenido funcional de UPCO Compras pasa a formar parte de **Administración** en UPCO Admin. Administración será un contenedor de navegación con páginas de dominio separadas; no será una página única que cargue todos los formularios y tablas.

| Submódulo de Administración | Contenido trasladado/adaptado |
|---|---|
| Resumen | Período activo, métricas de compras y retenciones, documentos recientes y avisos para el cierre. |
| Compras y documentos | Facturas recibidas, notas de crédito y débito, detalle por proveedor, fechas, período/quincena, montos, borrador/emisión/anulación y relaciones entre documentos. |
| Proveedores | Directorio fiscal, contacto, tipo y condición fiscal, RIF, estado activo/revisión y datos usados en los documentos. |
| Retenciones | Retenciones IVA, ISLR e IGTF, conceptos, bases, motivos de cálculo manual, comprobantes y validaciones de período. |
| Libros y cierres | Libro de compras, conciliación por período, cierre contable por fechas, CECO y cuenta de pago que se imprimen en la salida. |
| Importaciones | Plantillas y carga validada de proveedores/documentos históricos, con vista previa, errores por fila, advertencias y confirmación transaccional. |
| Reportes y exportaciones | XLSX, TXT, XML y resúmenes disponibles en el ZIP, con avisos de bloqueo y reglas de conciliación. |
| Configuración fiscal | Datos de UPCO, UT e historial de vigencia, tasas y referencias, conceptos ISLR, CECO, cuentas de pago y secuencias por período/tributo. Cambios auditados y aplicables a documentos nuevos. |

Configuración fiscal es un submódulo incluido. Cada cambio queda versionado y auditado. Los documentos emitidos conservan una instantánea inmutable de los valores utilizados; una actualización no recalcula el historial. Los parámetros iniciales se validan con el responsable fiscal antes de activar cálculo/emisión.

## Alcance de implementación de Administración V2

V2 reemplaza el apartado operativo de Administración V1 por el espacio nuevo de compras y administración fiscal. El submódulo Gestiones internas se elimina por completo de navegación y operación: no habrá lista, ficha, alta/edición ni seguimiento de gestiones antiguas. El trabajo se entregará por bloques verticales en este orden: estructura y resumen; proveedores fiscales; compras y borradores; configuración fiscal; retenciones; libros/cierres y reportes; importaciones.

Los registros históricos V1 no se purgan de la base de datos como parte de esta actualización. Se conservan sin ruta de consulta o edición en el producto; cualquier purga histórica requerirá una decisión aparte. Se mantiene intacto el acceso corporativo Microsoft/RLS y Procura.

Para la especificación funcional de V2, los requisitos RF-016–RF-018 y la entrada de Gestiones en RF-019 quedan retirados. La versión 1.1 se conserva como registro de la línea base anterior; no debe usarse para volver a exponer esas pantallas u operaciones en V2.

Se construyen las vistas, el modelo y las rutas de todos los submódulos documentados. Mientras falten validaciones, las pantallas pueden mostrar estado vacío, datos sintéticos o borradores; las acciones bloqueadas deben explicar qué confirmación falta. El bloqueo se aplica en servidor además de la interfaz.

**Acciones inicialmente bloqueadas:** calcular o activar reglas fiscales (incluido IGTF); emitir, anular o numerar documentos y comprobantes; publicar valores o correlativos fiscales como vigentes; generar comprobantes PDF con firma/sello; descargar archivos declarativos o cierres oficiales; confirmar importaciones de proveedores/documentos; y guardar soportes reales hasta acordar almacenamiento privado y retención. Los borradores no emiten certificados ni se presentan como cálculos definitivos. Los reportes de estado no se etiquetan como declaraciones o cierres oficiales.

**Acciones que pueden avanzar:** navegación y resumen; ficha y gestión manual del directorio fiscal sin cargar el snapshot adjunto; formularios de documentos en borrador; configuración en modo propuesta sin publicación; validaciones de pantalla/vista previa de importaciones sin escrituras; y reportes de borradores o estados sintéticos. La operación V1 de Gestiones y sus seguimientos deja de estar disponible. El padrón más reciente reporta 347 proveedores; queda separado de Procura y no se carga hasta conciliar la nueva versión y autorizar la escritura.

La activación posterior será por capacidad y requerirá registrar la validación/decisión que la habilita. Un botón deshabilitado en cliente nunca será la única barrera: acciones de servidor y persistencia rechazan operaciones aún bloqueadas.

La función de **Procura** del MVP existente conserva su significado: solicitudes y cotizaciones previas a la compra. El nuevo submódulo Compras registra facturas/notas recibidas y su tratamiento tributario y contable. Esto evita duplicar procesos.

## Inventario funcional observado en el ZIP

1. **Panel:** período mensual y quincena activa, compras del período, comprobantes emitidos, documentos recientes, acceso a compras e informes.
2. **Documentos:** factura, nota de crédito y débito; proveedor, número y control, fecha de emisión, pago/abono, período y quincena; importes exentos y bases IVA; retención IVA; IGTF; ISLR; concepto y cálculo manual justificado; total, neto, CECO, cuenta de pago y descripción.
3. **Ciclo de vida:** borrador editable; emisión con validación y creación de comprobantes; documento emitido congelado; anulación conservada para historial; nota vinculada a factura afectada. Emisión y movimientos relacionados usan operaciones transaccionales.
4. **Proveedores:** RIF único, directorio editable/activo, condiciones tributarias, residencia, persona natural/jurídica, contacto, tasa de retención, máquinas fiscales, marcas de revisión y procedencia de la importación.
5. **Soportes:** PDF/JPG/PNG/WEBP de hasta 10 MB, cargados a almacenamiento privado con comprobación de tipo, tamaño y firma de archivo. La descarga es autenticada. El borrador permite reemplazar/quitar soporte; el registro emitido conserva la evidencia.
6. **Importación:** plantilla XLSX/CSV para documentos históricos con máximo documentado de 4 MB en Vercel; lectura en vista previa, reglas para duplicados, proveedores, comprobantes, notas y período; se bloquea el lote si hay filas inválidas y la confirmación es atómica. La importación no emite retenciones nuevas.
7. **Salidas:** libro Excel de compras; TXT quincenal IVA; XML mensual ISLR; Excel auxiliar ISLR; conciliación visible; cierre contable por rango de fechas, con cuenta y CECO. Algunas salidas se bloquean por condiciones que no se pueden representar con fidelidad.
8. **Auditoría y seguridad:** login, roles/usuario administrador del sistema fuente, auditoría de cambios, historial de documentos y objetos privados. UPCO Admin debe conservar su propio modelo de identidad Microsoft/RLS, sin replicar el login local del ZIP.
9. **Actualización UI/importación (09/11):** logos y colores UPCO, Satoshi, etiquetas de marca, clases para tablas responsivas y un proxy de UPCO Compras que valida Origin contra Host/protocolo. Se añadió importador inicial a Turso: preview, exige base destino sin proveedores/documentos y confirma transaccionalmente conservando correlativos.

## Revisión del registro de proveedores entregado

- JSON y CSV contienen 345 filas cada uno; correlativos de origen y RIF son únicos dentro del archivo. Los 345 aparecen activos y marcados para revisión.
- Dos registros adicionales vienen aparte y sin RIF; quedan excluidos del lote importable hasta completar ese dato.
- Hay un nombre normalizado repetido con RIF distintos; se mantienen como registros separados hasta que UPCO confirme su identidad fiscal.
- La guía de exportación describe una copia local de `upco-compras/data/upco.sqlite`, con actualización de la lista al 07/11/2026; el campo `source_date` más reciente del JSON es 06/11/2026. El usuario confirmó que este registro está vigente.
- El JSON contiene RIF y direcciones fiscales. No se copia al repositorio, a un PR ni a un artefacto público.
- UPCO Admin ya tiene 80 registros en `public.vendors`, que es el catálogo comercial de Procura y tiene un importador para campos comerciales. Tras autorización del usuario se compararon los RIF en una consulta de solo lectura: 1 de los 345 registros coincide con un proveedor activo y 344 no tienen coincidencia exacta por RIF; no hubo coincidencias archivadas. No se insertó ni modificó ningún registro.
- La lista se destina al submódulo `fiscal_vendors`, separado de Procura. La vigencia está confirmada; antes de cargarla debe resolverse la coincidencia con el catálogo comercial y conservarse las dos filas sin RIF fuera del lote importado. El importador se adaptará al backend Supabase/RLS y no copiará el cliente Turso.

## Alcance del MVP

### Incluido

- Subnavegación de Administración y páginas independientes por función.
- Registro de factura/nota con importes y retenciones IVA/ISLR/IGTF, validación de servidor, vista previa de totales y ciclos borrador/emitido/anulado.
- Relación de notas con factura original y validación de proveedor/duplicado.
- Directorio fiscal separado del catálogo de proveedores de Procura, con claves e importación explícita para evitar datos duplicados.
- Importador inicial del registro fiscal vigente que conserve correlativo de origen, procedencia y estado «por revisar», luego de resolver la coincidencia con Procura. Las dos filas sin RIF se reportan y excluyen.
- Soporte privado con metadatos, límites de formato/tamaño, autorización y registro de eventos.
- Distribución contable por cuenta de pago y CECO recibidos desde catálogos configurables.
- Pantalla de configuración fiscal para datos de UPCO, UT e historial de vigencia, alícuotas/referencias, conceptos ISLR, CECO, cuentas de pago y correlativos por período/tributo; cambios auditados y limitados a documentos futuros.
- Importación histórica de proveedores y documentos mediante previsualización, informe de errores/avisos y escritura atómica.
- Reportes y exportaciones descritos en RF-025/027 de la especificación del MVP.
- Registro de versión de reglas y valores fiscales en cada documento emitido; auditoría de emisión/anulación/importación.

### Fuera del MVP

- Migración automática de base Turso/Blob, usuarios, contraseñas, facturas reales o sincronización con UPCO SERVER. La confirmación de vigencia del registro no autoriza por sí sola su carga; esta requiere definir destino fiscal y resolver la coincidencia con Procura.
- Login local del ZIP, despliegue Vercel/Turso/Blob, firma o sello del servidor fuente, conexión directa al SENIAT/ERP, emisión de facturas de venta, aprobación legal o autorización de pago.
- Conversión de moneda, cálculo de tasa de cambio y evaluación legal automática.

## Arquitectura propuesta

- Mantener el stack y controles de UPCO Admin: Next.js, TypeScript, PostgreSQL/Supabase, Microsoft Entra, autorización por servidor y RLS. La UI actual ya contiene los mismos PNG oficiales y sirve Satoshi localmente; no importar la hoja de estilos del ZIP que carga fuente remota.
- Crear subrutas/componentes de Administración y separar módulos de dominio (`documents`, `vendors`, `withholdings`, `imports`, `exports`). Reutilizar autenticación/acceso común sin copiar la app monolítica del ZIP.
- Modelar proveedores fiscales (`fiscal_vendors`) por separado de `vendors` de Procura, relacionándolos solo tras coincidencia confirmada. Modelar también documentos, impuestos/comprobantes, configuración, adjuntos y eventos de auditoría. Una emisión guarda snapshots inmutables de reglas/datos.
- Ejecutar cálculos en funciones de dominio puras y volver a validarlos en servidor. No aceptar importes calculados solo en el navegador. Cambios de tasas/catálogos validan rangos y generan eventos auditables.
- Guardar archivos en bucket privado de Supabase Storage asociado a `organization_id` y documento. Usar autorización servidor/RLS y rutas de descarga autenticadas; no confiar en nombres o rutas enviadas por el navegador.
- Hacer importaciones primero como preview no persistente. Revalidar con transacción al confirmar; cualquier conflicto/filas bloqueadas cancela el lote completo.
- Generar exportaciones en servidor a partir de una misma consulta de datos y reglas de inclusión compartidas. Exponer errores y razones de bloqueo antes de descargar.

## Reglas de negocio principales

- RIF de proveedor y número/tipo de documento son únicos según la regla normalizada definida por dominio.
- El snapshot entregado se trata como insumo pendiente de conciliación: no se fusiona ni sobrescribe; preserva los 345 correlativos de origen, deja sus filas para revisar y mantiene separados los 2 registros sin RIF.
- La emisión es transaccional: valida proveedor, período, referencias, montos, reglas y correlativo versionado; asigna comprobante y congela el snapshot.
- Una nota de crédito/débito debe referenciar un documento compatible y disponible; los ajustes que crucen período/quincena requieren aviso/bloqueo en la exportación afectada.
- Proveedor inactivo o marcado para revisión no se puede seleccionar para emitir hasta corregir o confirmar su ficha.
- Montos guardados como enteros de unidad mínima monetaria; no usar coma flotante para dinero. Cada línea conserva moneda explícita.
- No sumar monedas distintas. IVA mixto y casos no representables en el TXT no se exportan silenciosamente; se bloquean con explicación.
- Importación de historia conserva los números originales y no produce certificados retroactivos.
- La edición de configuración no recalcula documentos emitidos; la confirmación de secuencias por período/tributo es explícita.
- Documento emitido/anulado no se borra físicamente desde la UI; la anulación conserva historial. Solo borrador puede editarse/eliminarse según reglas auditadas.
- La versión del set fiscal que produjo un documento emitido se conserva en su snapshot; una actualización no recalcúla historial.

## Validación y dependencias — línea base V2.1

El ZIP demuestra estructura y comportamiento de una implementación, pero no certifica que las reglas fiscales sigan vigentes ni incluye sus registros reales. Antes de habilitar cálculo/emisión deben validarse externamente los conceptos/alícuotas, fórmulas, numeración, períodos, formato de TXT/XML/Excel y condiciones de notas contra el responsable tributario y formato destino actual. Sin esa revisión, se puede implementar el esqueleto del módulo y las pantallas de borrador, pero no declarar válidos los comprobantes ni usar datos reales.

La entrega inicial contenía un snapshot de 345 registros, comparado en modo de solo lectura con Procura: un RIF coincidió y 344 no. La entrega integral del 10/11/2026 reporta 347 proveedores. Esa nueva versión no se ha conciliado con el padrón anterior ni con Procura; los resultados de la comparación de 345 filas no se extrapolan a la versión de 347. Mantener directorios separados y no importar hasta conciliar duplicados/RIF y autorizar la escritura.

El almacenamiento privado, permisos, secretos, respaldo/restauración y límites de despliegue deben acordarse con el entorno de UPCO Admin; no se heredan del manual del ZIP.

## Matriz de validación — entrega integral recibida el 10/11/2026

La documentación de la entrega integral actualiza la descripción del código fuente y reemplaza donde corresponda a la especificación de corte 09/11. Sus tasas, catálogos y formatos siguen siendo evidencia del comportamiento del programa, no certificación legal ni constancia de aceptación por SENIAT. Ninguna regla de esta matriz activa cálculo, emisión o exportación oficial por sí sola.

| Área | Comportamiento descrito por la fuente | Estado en UPCO Admin V2 y validación que falta |
|---|---|---|
| Importes | Entrada no negativa en centavos; redondeo documentado como `Math.round((importe + Number.EPSILON) * 100)` por componente. | V2 guarda los importes del borrador en centavos, sin calcular. Antes de habilitar cálculo, confirmar la regla de redondeo y sus casos límite contra Finanzas. |
| IVA, total y posibles alícuotas adicionales | Código fuente contempla bases exenta/16 %/8 % y suma por componente; la matriz pendiente indica que no modela una alícuota adicional/suntuaria y remite a revisar SNAT/2026/00093. | Sin cálculo en V2. Confirmar tasas, vigencia, casos UPCO y campos/representación de cualquier tasa adicional antes de ampliar el modelo o las salidas. Configuración V2 acepta referencias propuestas no activas. |
| Retención IVA | Alícuotas de proveedor/documento 0 %, 75 % o 100 % sobre IVA; motivo/causal puede ser obligatorio para 0 % y 100 %. Un documento exento no genera comprobante. | El padrón admite 0/75/100; V2 no calcula ni emite. Confirmar causales, tratamiento exento y si la tasa puede cambiar por documento. |
| ISLR | Entrega reporta catálogo de 86 conceptos, basado en manual técnico histórico; solo `flat` con tasa/base explícitas se automatiza y el resto exige captura manual. UT reportada: Bs. 43 desde 02/06/2025. | V2 no calcula. La propuesta identifica el catálogo como referencia histórica no validada; confirmar códigos aplicables, vigencia, UT 2026, sustraendo, umbrales y salida XML antes de activarlo. |
| IGTF | La entrega actual sí describe cálculo: 3 % sobre una base ingresada y suma al neto; no lo incluye en total factura ni TXT/XML. La decisión de sujeto/base se selecciona en cada pago. | V2 no calcula ni guarda un monto derivado. Registrar el comportamiento solo como referencia no validada. Confirmar sujeción/excepciones, base, alícuota, asiento y salidas antes de implementar. |
| Neto | Fuente: total facturado + IGTF − retención IVA − ISLR; notas de crédito invierten signo. | V2 no calcula. Depende de validar IVA, ISLR e IGTF y casos de crédito/débito. |
| Período | Fecha de pago/abono determina la quincena 1–15 o 16–fin; la fuente permite diferir a la siguiente con motivo. | V2 captura fecha, período y quincena, pero no deriva/valida la asignación. Confirmar diferimiento, bordes de mes y notas que ajustan otro período antes de cerrar o exportar. |
| Notas | Crédito invierte signos; débito aumenta importes. Nota referida a factura emitida del mismo proveedor. | V2 no calcula signos ni emite. Los borradores rechazan un vínculo a una factura de otro proveedor y solo permiten referir facturas en notas; los vínculos disponibles son facturas actualmente registradas en V2. El tratamiento de quincenas/meses cruzados se valida para exportación. |
| Cuentas y CECO | Cuenta y al menos un CECO activos; distribución positiva con máximo dos decimales y suma 100 %. | V2 valida en borradores el formato `CODIGO:PORCENTAJE`, porcentajes positivos con hasta dos decimales, códigos no repetidos y suma exacta de 100 %. La cuenta permanece como referencia y no se valida contra catálogo; la existencia/actividad de cuentas y CECO sigue pendiente de catálogos UPCO y validación contable. |
| Libro Excel | Libro mensual o quincenal; hojas `Compras` y `Distribución contable`; bases e IVA 16/8 en columnas separadas. La fuente dice que no replica columna por columna el modelo 0201C/0202C. | Solo conteo/estado en V2. Falta validar plantilla y columnas finales con Contabilidad y destino. |
| TXT IVA | Quincenal, 16 campos tabulados, CRLF, solo retenciones positivas emitidas. El TXT se bloquea para factura con IVA mixto hasta validar representación. | No generado en V2. Falta probar aceptación real en portal y acordar manejo de IVA mixto y notas que cruzan período. |
| ISLR XML/XLSX | XML mensual por pago/abono; se bloquea si monto manual/sustraendo no reproduce la relación aceptada. XLSX `retISLR` es hoja de datos, no incluye macro VBA. No hay TXT ISLR en la fuente. | No generado en V2. Falta validar esquema/aceptación XML, macro y decisión explícita sobre necesidad de TXT ISLR. |
| Cierre y PDF | Cierre Excel por rango inclusivo de pago/abono; PDF IVA/ISLR usa logo, firma y sello escaneados. | No generado en V2. Faltan validar formato contable y decidir almacenamiento privado, permisos y retención de activos/soportes. |
| Importación histórica | Plantilla XLSX/CSV con preview y bloqueo por fila; no crea retenciones nuevas. | V2 solo lee localmente y señala encabezados/campos básicos; no persiste. Falta confirmar mapeos y conciliación de cuentas, CECO, proveedores, comprobantes, notas y período antes de habilitar escritura. |

### Validaciones externas requeridas en V2.1 (cerradas por aprobación V2.2)

1. Responsable tributario: vigencia de tasas y conceptos ISLR, UT/sustraendo, causales IVA 0/100, IGTF, redondeo y notas.
2. Contabilidad: formato final de libro 0201C/0202C, cuenta/CECO, cierre y conciliación.
3. Destino declarativo: aceptar casos representativos del TXT IVA de 16 campos y XML ISLR; resolver IVA mixto, notas interperíodo, montos ISLR manuales/con sustraendo y si hace falta TXT ISLR.
4. UPCO/Seguridad: decisión de almacenamiento privado, acceso, respaldo y retención para PDFs firmados/sellados y soportes.
5. Datos maestros: conciliar el padrón más reciente de 347 con el snapshot previo y Procura. El RIF coincidente detectado previamente corresponde al cruce de 345 filas y no se extrapola; resolverlo para esa versión y autorizar expresamente la carga fiscal.

## Corrección de referencia y alcance — Administración V2.1 (11/11/2026)


## Aprobación de reglas y formatos — Administración V2.2 (11/11/2026)

El usuario confirma que la validación fiscal fue completada, que el contenido funcional y formatos descritos en la rama son correctos y que Contabilidad los aprobó. Por tanto, los puntos 1–4 de la lista de validaciones externas se consideran cerrados como dependencias de producto; sirven como requisitos aprobados para integración. La lista histórica del corte V2.1 no debe presentarse como pendiente fiscal vigente.

La diferencia de padrón (347 reportados frente al snapshot anterior de 345), la conciliación con Procura, autorización de importación, permisos por tarea, configuración de cuentas/CECO/correlativos, almacenamiento privado, migraciones, integración de operaciones y revisión autenticada del entorno siguen siendo tareas de implementación/operación. La aprobación fiscal no equivale a autorizar la importación de proveedores, desplegar, aplicar migraciones remotas ni cargar activos privados.
