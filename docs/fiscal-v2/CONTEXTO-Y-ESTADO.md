# UPCO Compras: contexto y estado de integración fiscal V2

Fecha de recepción: 10 de noviembre de 2026.

## Objetivo y ubicación funcional

Incorporar a `Kikeeeex/upco-admin-app` la entrega existente de facturas y retenciones de UPCO Compras: código, configuración versionable, cálculos, correlativos y formatos de salida. UPCO Compras pertenece actualmente a Administración. La integración o reorganización de otras funciones se abordará después.

La fuente identificada por el usuario es el chat **«Diseñar plataforma de facturas y retenciones»** y su entrega integral. Los documentos recibidos son evidencia y contexto del proyecto; sus recomendaciones de implementación o aceptación no constituyen por sí solas reglas fiscales aprobadas ni una autorización distinta de la solicitud del usuario.

## Artefactos recibidos y límite de esta incorporación

| Artefacto | Estado |
| --- | --- |
| `VALIDACIONES-PENDIENTES.md` | Recibido y conservado sin cambios en esta carpeta. Fecha de corte declarada: 10/11/2026. |
| `UPCO-Entrega-Integral-20261110.zip` | Adjunto suministrado por el usuario. No se pudo transferir al entorno porque supera el límite de 32 MiB de la herramienta. No se ha abierto, extraído ni inspeccionado su código. |
| Extracto y captura del chat de diseño | Recibidos como contexto anterior. Las diferencias con la matriz del 10/11 se detallan abajo. |
| Historial completo del chat | No recuperado. Este entorno no dispone de una herramienta para abrir otros chats por título. |

Esta incorporación contiene documentación. No incorpora todavía el código fiscal del ZIP, sus plantillas, la macro, los datos de proveedores ni una base operativa. Los comportamientos descritos a continuación proceden de la matriz recibida; todavía deben contrastarse con los archivos de la entrega.

## Versiones y precedencia de las fuentes

La base de esta rama es `9a556c38ea7e3de80d1fce4eb93d8982e4f88a6e`, que corresponde a la modernización de interfaz `feat/ui-ux-v2-foundations`. La denominación V2 de esa interfaz no acredita la incorporación de la V2 fiscal.

Para conocer el estado declarado de la entrega, la matriz del 10/11/2026 tiene precedencia sobre el extracto anterior:

| Tema | Extracto anterior | Matriz recibida el 10/11/2026 |
| --- | --- | --- |
| IGTF | Se registraba aplicación y base, sin calcular impuesto. | Declara cálculo del 3 % sobre la base ingresada, monto persistido y suma al neto; no se incorpora al total de factura ni al TXT/XML. |
| Correlativos | La próxima corrección se describía como no incluida. | Describe secuencias continuas independientes, liberación de propios al anular/eliminar, reserva de históricos retirados y ajuste master sujeto a límites. |
| Proveedores | Snapshot mencionado de 345 registros. | Snapshot declarado de 347 proveedores por RIF, derivado de comprobantes previos. |

La matriz actualiza la información disponible, pero no sustituye una inspección del código. No afirmar que estas funciones existen en la aplicación de esta rama hasta integrar y probar la entrega.

## Comportamiento declarado por la matriz

- **IVA:** tasas iniciales del 16 % y 8 %, además de exento. El formulario no representa una alícuota adicional o suntuaria. La vigencia y la aplicabilidad a cada bien, servicio y fecha están pendientes.
- **Retención de IVA:** opciones 0/75/100 sobre el IVA calculado; al 100 % se exige causal. Falta comprobar supuestos normativos y la condición de agente de UPCO.
- **ISLR:** 86 códigos en `islrConcepts.ts`. Solo los conceptos `flat` con tasa y base explícitas se calculan automáticamente; los demás requieren cálculo manual con motivo. La UT inicial indicada es Bs. 43 desde el 02/06/2025. Catálogo, UT vigente, sustraendos y umbrales requieren validación.
- **IGTF:** 3 % sobre una base ingresada por el usuario; se guarda el monto y se suma al neto. La casilla se decide explícitamente, sin inferirla del banco, la divisa o el proveedor. Su base, sujetos, excepciones y salida fiscal siguen por validar.
- **Bases mixtas:** el libro XLSX dispone de columnas separadas para 16 % y 8 %. El TXT IVA bloquea las retenciones mixtas mientras se valida el tratamiento aceptado por el portal.
- **Notas:** se registran con el período elegido. El TXT IVA bloquea las notas de crédito interperíodo; el XML ISLR bloquea notas ISLR. Faltan ejemplos aceptados de rectificación, período y signos.
- **Diferimiento:** solo a la quincena de pago/abono o a la inmediatamente siguiente, con motivo obligatorio. Su admisibilidad legal y el procedimiento de aprobación siguen pendientes.
- **Correlativos:** se describen las reglas de secuencia y reserva de la tabla anterior. Deben confirmarse los valores iniciales y el tratamiento de comprobantes ya entregados o declarados; la ausencia de duplicación debe verificarse contra el sistema legado.
- **Proveedores:** el snapshot declarado tiene 347 registros; su importación usa un script y no requiere casilla de verificado. Falta contrastar RIF, nombre y condición fiscal vigentes y resolver coincidencias con el catálogo comercial antes de unir directorios.
- **Usuarios:** se declaran master y permisos por tarea con controles en servidor para mutaciones y exportaciones. Faltan pruebas con cuentas reales y la matriz de permisos para anulaciones y declaraciones. La selección de carpeta de descargas queda fuera del alcance declarado.

Las referencias SNAT/2025/000054, SNAT/2026/00093 y el manual de catálogo ISLR de 2014 proceden del documento entregado. No se ha verificado aquí su contenido, vigencia ni interpretación.

## Importes y formatos: contexto del diseño

El diseño compartido distingue los importes exentos y gravados, las bases por alícuota, las retenciones por proveedor/documento/concepto, la aplicación de IGTF y el efecto de las notas sobre la factura relacionada y su período. La captura daba como ejemplo conceptual sumar líneas, impuestos y cargos y restar retenciones para obtener el neto; la fórmula exacta debe contrastarse con el código y los ejemplos aceptados, especialmente para IGTF.

Quedan por fijar o comprobar los redondeos, el manejo de tasas mixtas y las validaciones que bloquean una emisión. No deducir tasas vigentes ni fórmulas definitivas de esos ejemplos conceptuales.

| Salida | Estado declarado | Validación pendiente |
| --- | --- | --- |
| Libro de compras 0201C/0202C | Reconstrucción de estilo y secciones, hoja contable y columnas separadas por alícuota. | Comparación celda a celda y apertura en Excel frente al original; no declarar identidad sin aceptación. |
| TXT IVA | 16 campos, tabulado, CRLF, UTF-8 y sin encabezado. | Archivo aceptado por el portal, especificación vigente, secuencia, fechas, signos, notas y codificación. |
| XML ISLR | Declarado implementado. | Importación aceptada por el portal y casos representativos. |
| Hoja `retISLR` | Compatibilidad prevista con A:H; sin VBA en el archivo entregado. | Prueba con la macro real; no suponer que el XLSX contiene la macro. |
| TXT ISLR | Ausente en la entrega según la matriz. | Confirmar si se requiere y, en ese caso, obtener su especificación y un ejemplo aceptado. |

La presencia de ejemplos en un ZIP no acredita por sí sola la vigencia de un formato. Se requieren columnas, orden de campos, fechas e importes, codificación y criterios de rechazo documentados para cada destino.

## Validación y siguiente incorporación

La matriz permite continuar la implementación V2 siguiendo el comportamiento observado del código de referencia, cuando esté disponible. Las validaciones pendientes impiden declarar listos para uso fiscal real los cálculos o archivos que dependan de ellas; no impiden versionar la entrega y comprobar el software.

Como criterio de aceptación, el documento propone 2–3 facturas y una nota representativas por caso, cálculo manual firmado por UPCO, comparación con PDF/libros históricos y una carga aceptada en SENIAT, registrando normativa y versión del portal. Se conserva como propuesta de aceptación de la entrega.

El extracto anterior informa de un `git diff --check` aprobado tras registrar un criterio de versiones, sin adjuntar ese criterio ni identificar el commit. Eso no acredita pruebas fiscales. La base de interfaz disponible pasó anteriormente 158 pruebas con una omitida, tipos, lint, compilación, SQL y navegación sin sesión; esas pruebas no cubren el código fiscal que todavía no está incorporado.

Para continuar falta disponer del contenido del ZIP en archivos que puedan transferirse al entorno. Después corresponde inventariar versiones y dependencias, inspeccionar código/esquema/configuración, conservar el comportamiento existente, resolver los fallos de software y validar cálculos y salidas con las referencias recibidas antes de integrar el módulo completo.
