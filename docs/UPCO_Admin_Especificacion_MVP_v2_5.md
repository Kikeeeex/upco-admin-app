# UPCO Admin — Especificación MVP de Administración V2

| Control | Valor |
|---|---|
| Código | UPCO-ADM-SRS-001 |
| Versión del módulo | 2.5 |
| Estado | Implementado; migraciones aplicadas y padrón fiscal aprobado cargado |
| Fecha | 11 de noviembre de 2026 |
| Base | UPCO Admin V1 y entrega integral UPCO Compras con corte 10/11/2026 |

Esta especificación reemplaza el alcance operativo de Administración V1. La especificación V1.1 se conserva como registro histórico. V2 no ofrece Gestiones V1 ni sus seguimientos; sus datos históricos permanecen en la base sin superficies operativas en la aplicación. Procura y la autenticación corporativa conservan sus propios modelos. La sección 4 registra la corrección 2.1 aplicada durante esta reconstrucción.

## 1. Alcance y estado

Administración reúne las funciones administrativo-contables de UPCO Compras en submódulos separados. El usuario confirmó que Contabilidad aprobó las reglas y formatos descritos en la rama de entrega y autorizó completar el módulo. Esa aprobación habilita la implementación; no equivale a aceptación de archivos por SENIAT.

| Submódulo | Alcance de V2 | Estado y límites actuales |
|---|---|---|
| Resumen | Indicadores del período, documentos recientes, alertas y accesos a tareas administrativas. | Resume borradores y documentos emitidos; no representa cierre o declaración oficial. |
| Compras y documentos | Facturas recibidas, notas de crédito/débito, proveedor fiscal, fechas, períodos, importes, relación con factura, cuenta y CECO. | Borradores, vista previa y emisión con recálculo en servidor, correlativo transaccional, snapshots inmutables, PDF de retención y anulación auditada. |
| Proveedores | Directorio fiscal separado de proveedores comerciales de Procura; búsqueda y mantenimiento manual. | Padrón de 345 registros cargado como vigente y confirmado por aprobación de Contabilidad. 345 eventos de auditoría; sin vínculo automático con Procura. |
| Retenciones | Consulta por IVA, ISLR e IGTF, bases, conceptos, motivos manuales, período y estado de comprobantes. | Fórmulas y comprobantes PDF IVA/ISLR implementados con firma y sello privados en variables de servidor. |
| Libros y cierres | Vistas de período, conciliación y preparación de libros y cierre contable por fechas, cuentas y CECO. | Libro Compras/Distribución y cierre por rango XLSX integrados desde snapshots emitidos. |
| Importaciones | Previsualización local de archivos históricos, validación estructural y reporte de errores. | Vista previa local de CSV, JSON y plantilla XLSX (máx. 5 MB/2.000 filas); la confirmación en servidor de documentos históricos sigue pendiente. No se almacenan los archivos. |
| Reportes y exportaciones | Estado y recuentos para compras, retenciones, libros y períodos. | TXT IVA quincenal, XML ISLR mensual, libro y cierre XLSX se generan desde snapshots emitidos con bloqueos para casos no representables. PDFs pendientes. |
| Configuración fiscal | Propuestas versionadas para datos de UPCO, tasas, UT, conceptos ISLR, cuentas, CECO, reglas IGTF y correlativos. | Propuestas pueden activarse con auditoría; cada emisión guarda la versión de configuración usada. |

Las restricciones se comprueban en servidor y en la base de datos. Las descargas PDF requieren rol administrador, documento emitido y certificados asignados. Firma y sello permanecen en variables secretas de producción; no están en Git.

## 2. Reglas transversales

- Un documento emitido se recalcula en servidor desde los campos validados, proveedor confirmado y configuración activa. La transacción asigna correlativos y conserva snapshots inmutables; un borrador no los tiene.
- Proveedores fiscales y proveedores de Procura son directorios separados. Un vínculo requiere resolución explícita; no se deduce por nombre.
- Las notas emitidas solo pueden referir una factura emitida del mismo proveedor. Se conserva el signo de nota de crédito y se bloquean casos de cruce de período en TXT IVA.
- Al emitir, la cuenta y CECO deben existir y estar activos en la configuración. La distribución se expresa como `CODIGO:PORCENTAJE`, sin códigos repetidos, con porcentajes positivos y total exacto de 100 %.
- Número normalizado único por organización, proveedor y tipo de documento. Esta regla de integridad no asigna correlativos fiscales.
- La carga del padrón de 347 proveedores requiere conciliar la nueva entrega con el snapshot anterior y con Procura. El cruce previo de 345 filas no se aplica a la nueva versión.
- Los cambios de Administración se versionan. Cada versión debe conservar alcance, fuente, fecha, decisiones, funciones bloqueadas y validaciones externas pendientes.

## 3. Reglas aprobadas y límites de las salidas

Las reglas fiscales de la entrega integral de 10/11/2026 fueron aprobadas por Contabilidad el 11/11/2026. Los exports siguen las limitaciones del formato fuente y no garantizan aceptación por SENIAT:

| Tema | Regla/artefacto aprobado | Tratamiento en V2.4 |
|---|---|---|
| Montos | Enteros en céntimos; redondeo por componente a dos decimales. | Motor fuente integrado para vista previa y emisión. |
| IVA | Bases exenta, 16 % y 8 %; el formulario fuente no representa una posible alícuota adicional/suntuaria. Se solicita revisar SNAT/2026/00093. | Tasas y vigencias; si UPCO tiene casos adicionales, campos, total y salidas. |
| Retención IVA | Porcentajes 0 %, 75 % y 100 % sobre IVA, con motivo/causal según aplique. | Motor y correlativo integrados; certificados PDF pendientes. |
| ISLR | Catálogo de 86 códigos; concepto plano puede automatizarse y casos sujetos a criterio admiten cálculo manual documentado. | Motor y XML integrados con validaciones de consistencia; PDF y XLSX auxiliar pendientes. |
| IGTF | 3 % de base ingresada, suma al neto a pagar, no al total de factura ni a TXT/XML. | Motor integrado. |
| Períodos/notas | Fecha de pago/abono determina período; se describe diferimiento con motivo. Notas pueden afectar otro período. | Plazos, diferimiento, signos, rectificativas y cruce de quincenas/meses. |
| Libro | XLSX con hojas de compras y distribución contable; bases 16 %/8 % separadas. | Integrado; usa los estilos de la entrega aprobada y snapshots de cuenta/CECO. |
| Declaraciones | TXT IVA de 16 campos tabulados; XML mensual ISLR y XLSX auxiliar. No se describe TXT ISLR. | TXT/XML implementados desde snapshots; IVA mixto, nota de crédito de otro período, notas ISLR e inconsistencia de base/alícuota bloquean el archivo. |
| PDF | Comprobantes IVA/ISLR usan marca, firma y sello. | Pendiente de almacenamiento privado y entrega de activos autorizados; no copiar al repositorio. |

Las salidas implementadas se descargan para revisión. V2.5 no certifica aceptación por el portal tributario. Las políticas RLS actuales restringen directorio, configuración y documentos fiscales al rol administrador; el modelo granular por tarea sigue pendiente.

## 4. Historial de versión

### V2.1 — corrección del análisis de la entrega integral (11/11/2026)

La nueva entrega actualiza el conteo reportado de proveedores de 345 a 347 y reemplaza la descripción previa de IGTF: ahora la fuente sí lo calcula al 3 % sobre base ingresada y lo incluye en el neto. También añade la advertencia sobre alícuotas IVA adicionales y documenta el catálogo de 86 conceptos ISLR. La conciliación de proveedores y las validaciones fiscales continúan pendientes.

En Configuración fiscal, la propuesta conserva referencias separadas para alícuotas IVA adicionales, comportamiento IGTF y procedencia/estado del catálogo ISLR. Retenciones, Libros, Reportes e Importaciones explican las referencias de origen y las verificaciones pendientes. Resumen muestra período referencial, borradores recientes y conteos sin asignar períodos ni calcular impuestos.

### V2.2 — validaciones fiscales y contables aprobadas (11/11/2026)

El usuario confirma que la validación fiscal fue completada, que las reglas y formatos descritos en la rama de entrega son correctos y que Contabilidad los aprobó. Esta decisión cierra las dependencias de validación documentadas en la matriz V2.1. La especificación de la rama se toma como fuente funcional para implementar IVA exento/16/8, retenciones IVA, ISLR, IGTF, períodos, notas, correlativos y salidas.

La aprobación cierra la revisión de reglas y formatos. Se agregó la activación versionada de una propuesta, registrada por organización y actor. El código aún debe integrar cálculo, emisión, correlativos, reportes/exportaciones y cierres; por ahora, la activación guarda el set vigente pero las pantallas de compras siguen operando con borradores. La migración está en el repositorio y no se ha aplicado en remoto ni desplegado. No se importa el padrón de 347 proveedores ni se copian firma, sello o soportes privados como efecto de esta aprobación.

### V2.3 — vista previa de cálculos (11/11/2026)

Se integró en servidor el motor de cálculo de la rama aprobada para una vista previa desde el formulario de borrador: IVA exento/16/8, retención IVA, IGTF 3 %, ISLR según catálogo y neto; también aplica quincena derivada de pago y el signo de notas de crédito. Requiere proveedor activo/revisado y una configuración fiscal activada. La vista previa no persiste resultados ni emite correlativos.

Los borradores ahora conservan los campos de retención IVA y los parámetros del cálculo manual ISLR para permitir reproducir la vista previa. La emisión transaccional, snapshots fiscales y contables, correlativos, anulación y archivos de salida aún no están integrados. La migración de V2.3 permanece local.

## 5. Criterios y pendientes de V2.5

1. Cada submódulo tiene su ruta, contenido y estado; Administración no carga todo en una sola página.
2. Gestiones V1 no tiene ruta, acción ni listados operativos; no se purgan sus filas históricas.
3. Ninguna función bloqueada se habilita solo desde interfaz.
4. Configuración fiscal guarda propuestas versionadas; una activación auditada define los parámetros para emisiones futuras.
5. Los datos del padrón y los activos privados de UPCO no se incluyen en el repositorio.
6. Reglas, formatos, emisión, anulación, PDF privado y exportaciones están implementados. La importación histórica solo tiene vista previa; el permiso vigente para datos fiscales es rol administrador.

### V2.4 — emisión y primeras salidas contables/declarativas (11/11/2026)

Se añadió emisión desde un borrador con recálculo servidor, validación de proveedor confirmado y cuenta/CECO activos, emisión de correlativos IVA/ISLR en una transacción PostgreSQL y persistencia atómica de snapshots de cálculo, configuración y distribución contable. Los emitidos son inmutables; la migración es local y requiere `SUPABASE_SERVICE_ROLE_KEY` solo en servidor para llamar al RPC restringido.

Se añadieron exportaciones TXT IVA quincenal, XML ISLR mensual, libro de compras XLSX y cierre XLSX por rango de fechas de pago/abono desde snapshots emitidos, disponibles para cuentas administradoras. El TXT bloquea documentos con IVA mixto en una línea, notas de crédito que afectan otra quincena y borradores dentro del período. El XML bloquea notas ISLR y bases/alícuotas que no reproduzcan la retención. El libro incluye hojas Compras y Distribución contable. Estos formatos se generan para revisión y no representan confirmación de aceptación por SENIAT.

Siguen pendientes PDFs con firma y sello privados, anulación con reglas de correlativo, importación histórica/proveedores, permisos granulares por tarea y revisión autenticada del ambiente. No se aplicaron migraciones remotas ni se desplegó.

### V2.5 — cierre operativo de Administración (11/11/2026)

Se aplicaron en Supabase las migraciones V2, incluida la retirada operativa de Gestiones V1, configuración versionada y emisión transaccional. Las políticas de lectura de padrón y datos fiscales se definieron como solo administración desde su creación. El padrón UPCO de 345 proveedores se cargó en fiscal_vendors: registros activos y confirmados, correlativos fuente 1–345, con un evento de auditoría por registro. Procura permanece separado y sin asociaciones inferidas.

Se añadieron PDF de retención IVA/ISLR con firma y sello del paquete fuente, guardados como variables secretas de producción y usados solo en servidor. El endpoint exige usuario administrador, documento emitido y número de comprobante. Se añadió anulación con motivo obligatorio, actor y fecha; el snapshot emitido no cambia y los correlativos anulados nunca se liberan ni reutilizan.

Se generaron respaldos lógicos JSON del esquema público antes de los cambios V2 y después de aplicar migraciones/cargar proveedores. Archivos privados en /workspace/private-backups, permisos 0600, con SHA-256. Incluyen datos de tablas del esquema public, no son un volcado físico de PostgreSQL ni incluyen auth o archivos binarios de Storage.

El commit a37cb9d se publicó en main y Vercel lo marcó READY en https://upco-admin-app.vercel.app/.

Queda pendiente implementar la confirmación transaccional de importaciones históricas de documentos y evaluar permisos granulares por submódulo. La vista previa histórica continúa local, sin enviar ni persistir el archivo. Los PDF se generan para revisión y no certifican aceptación por SENIAT.

Para el inventario completo de fuentes, comportamientos, matriz y dependencias ver [diseño de Administración V2](superpowers/specs/2026-11-09-administracion-compras-contabilidad-design.md) y [plan de implementación](superpowers/plans/2026-11-09-administracion-compras-contabilidad.md).
