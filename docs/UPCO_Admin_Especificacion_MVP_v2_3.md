# UPCO Admin — Especificación MVP de Administración V2

| Control | Valor |
|---|---|
| Código | UPCO-ADM-SRS-001 |
| Versión del módulo | 2.3 |
| Estado | En desarrollo; cálculos de vista previa integrados, emisión y salidas oficiales pendientes |
| Fecha | 11 de noviembre de 2026 |
| Base | UPCO Admin V1 y entrega integral UPCO Compras con corte 10/11/2026 |

Esta especificación reemplaza el alcance operativo de Administración V1. La especificación V1.1 se conserva como registro histórico. V2 no ofrece Gestiones V1 ni sus seguimientos; sus datos históricos permanecen en la base sin superficies operativas en la aplicación. Procura y la autenticación corporativa conservan sus propios modelos. La sección 4 registra la corrección 2.1 aplicada durante esta reconstrucción.

## 1. Alcance y estado

Administración reúne las funciones administrativo-contables de UPCO Compras en submódulos separados. Los datos y fórmulas descritos por la aplicación fuente se consideran referencias pendientes de aprobación; no equivalen a una validación fiscal, aceptación SENIAT ni autorización para cargar datos reales.

| Submódulo | Alcance de V2 | Estado y límites actuales |
|---|---|---|
| Resumen | Indicadores del período, documentos recientes, alertas y accesos a tareas administrativas. | Solo resume registros disponibles/borradores; no representa cierre o declaración oficial. |
| Compras y documentos | Facturas recibidas, notas de crédito/débito, proveedor fiscal, fechas, períodos, importes, relación con factura, cuenta y CECO. | Alta/edición de borradores. Sin cálculo fiscal, emisión, anulación, correlativos, soportes reales ni comprobantes. |
| Proveedores | Directorio fiscal separado de proveedores comerciales de Procura; búsqueda y mantenimiento manual. | No cargar automáticamente el padrón adjunto. La nueva entrega reporta 347 registros; conciliación y escritura masiva siguen pendientes. |
| Retenciones | Consulta por IVA, ISLR e IGTF, bases, conceptos, motivos manuales, período y estado de comprobantes. | No calcular ni emitir comprobantes. IGTF se documenta como referencia de fuente, no como regla activa. |
| Libros y cierres | Vistas de período, conciliación y preparación de libros y cierre contable por fechas, cuentas y CECO. | Indicadores/estados solamente. Sin archivos de cierre ni libro oficial. |
| Importaciones | Previsualización local de archivos históricos, validación estructural y reporte de errores. | Sin guardar ni confirmar lotes. No almacenar archivos subidos. |
| Reportes y exportaciones | Estado y recuentos para compras, retenciones, libros y períodos. | No generar ni descargar PDF, TXT, XML, XLSX declarativos o cierres oficiales. |
| Configuración fiscal | Propuestas versionadas para datos de UPCO, tasas, UT, conceptos ISLR, cuentas, CECO, reglas IGTF y correlativos. | Solo propuestas no activas. Guardar valores no cambia cálculos ni documentos. |

Las restricciones deben comprobarse en servidor y, cuando corresponda, en la base de datos. Ocultar o deshabilitar un botón no basta. No se importan activos de firma/sello ni datos de proveedores desde el paquete fuente.

## 2. Reglas transversales

- Un documento en V2 es un borrador identificable y editable; no constituye un cálculo ni comprobante fiscal.
- Proveedores fiscales y proveedores de Procura son directorios separados. Un vínculo requiere resolución explícita; no se deduce por nombre.
- Las notas solo pueden referir una factura del mismo proveedor en los borradores disponibles. No se calculan signos ni se aprueba el tratamiento de notas entre períodos.
- CECO en borrador: formato `CODIGO:PORCENTAJE`, códigos no repetidos, importes positivos con hasta dos decimales y total exacto de 100 %. No se certifica que el CECO exista o esté activo hasta contar con catálogo UPCO aprobado.
- Número normalizado único por organización, proveedor y tipo de documento. Esta regla de integridad no asigna correlativos fiscales.
- La carga del padrón de 347 proveedores requiere conciliar la nueva entrega con el snapshot anterior y con Procura. El cruce previo de 345 filas no se aplica a la nueva versión.
- Los cambios de Administración se versionan. Cada versión debe conservar alcance, fuente, fecha, decisiones, funciones bloqueadas y validaciones externas pendientes.

## 3. Referencias fiscales recibidas y bloqueos

Los siguientes puntos describen la entrega integral de 10/11/2026. Se registran como comportamiento reportado del código fuente, no como reglas aprobadas:

| Tema | Comportamiento descrito en la entrega | Confirmación necesaria antes de habilitar |
|---|---|---|
| Montos | Enteros en céntimos; la entrega anterior documentaba redondeo por componente con `Math.round`. | Responsable fiscal/Contabilidad confirma redondeo y casos límite. |
| IVA | Bases exenta, 16 % y 8 %; el formulario fuente no representa una posible alícuota adicional/suntuaria. Se solicita revisar SNAT/2026/00093. | Tasas y vigencias; si UPCO tiene casos adicionales, campos, total y salidas. |
| Retención IVA | Se describen porcentajes 0 %, 75 % y 100 % sobre IVA, con causales/motivos en ciertos casos. | Aplicabilidad, causal, excepciones y evidencia normativa vigente. |
| ISLR | Catálogo de 86 códigos, basado en referencia técnica histórica; conceptos planos pueden automatizarse y los demás requieren intervención manual. UT fuente: Bs. 43 desde 02/06/2025. | Catálogo vigente, tasas, condición del sujeto, UT de 2026, sustraendo, umbrales y XML aceptado. |
| IGTF | La versión más reciente describe cálculo al 3 % de una base ingresada y suma al neto; no lo agrega al total de factura ni a TXT/XML. La selección de aplicación es manual. | Sujeto, operaciones gravadas/exentas, base, tasa, efecto contable y salidas. |
| Períodos/notas | Fecha de pago/abono determina período; se describe diferimiento con motivo. Notas pueden afectar otro período. | Plazos, diferimiento, signos, rectificativas y cruce de quincenas/meses. |
| Libro | XLSX con hojas de compras y distribución contable; bases 16 %/8 % separadas. | Comparación celda a celda con 0201C/0202C y aceptación de Contabilidad. |
| Declaraciones | TXT IVA de 16 campos tabulados; XML mensual ISLR y XLSX auxiliar. La entrega no confirma aceptación por el portal; no incluye TXT ISLR. | Comparación con versión técnica y archivos aceptados; IVA mixto, notas, TXT ISLR y macro. |
| PDF | Comprobantes IVA/ISLR usan marca y activos privados de UPCO en la fuente. | Aprobación de almacenamiento, firma/sello, permisos, retención y modelo final. No copiar activos a este repositorio. |

Mientras falte alguna validación aplicable, permanecen bloqueados cálculo y emisión fiscal, comprobantes, secuencias vigentes, anulación fiscal, exportaciones oficiales y cierres oficiales. Configuración fiscal puede conservar propuestas sin publicar.

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

## 5. Criterios para completar V2.3

1. Cada submódulo tiene su ruta, contenido y estado; Administración no carga todo en una sola página.
2. Gestiones V1 no tiene ruta, acción ni listados operativos; no se purgan sus filas históricas.
3. Ninguna función bloqueada se habilita solo desde interfaz.
4. Configuración fiscal guarda propuestas versionadas y explícitamente no activas.
5. Los datos del padrón y los activos privados de UPCO no se incluyen en el repositorio.
6. Las reglas fiscales y formatos están aprobados. Para completar falta emisión transaccional, correlativos y snapshots; archivos aprobados; catálogos de cuenta/CECO; permisos por tarea; almacenamiento privado y verificación en el entorno autorizado.

Para el inventario completo de fuentes, comportamientos, matriz y dependencias ver [diseño de Administración V2](superpowers/specs/2026-11-09-administracion-compras-contabilidad-design.md) y [plan de implementación](superpowers/plans/2026-11-09-administracion-compras-contabilidad.md).
