# Archivos que produce el sistema

## Comprobantes PDF

Las rutas `app/api/documents/[id]/iva-pdf`, `islr-pdf` y `combined-pdf` generan comprobantes a partir de `lib/tax/pdf.ts`, con logo, firma y sello de `assets/retention`. Los modelos originales de UPCO están en `modelos/`. Los nombres de descarga terminan en `IVA retenido`, `ISLR retenido` o `IVA e ISLR retenidos`, precedidos de razón social y `Fact. Nro.`. El número de comprobante permanece **dentro del PDF** y en la base, pero ya no en el nombre del archivo.

## Libro XLSX

`lib/tax/xlsx.ts` reconstruye las cabeceras y estilo del ejemplo aportado, usando 0201C para primera quincena y 0202C para segunda quincena o mes. La hoja `Compras` separa base/porcentaje/impuesto de 16 % y 8 % en columnas diferentes y muestra exento y retención. La hoja adicional `Distribución contable` incluye descripción, cuenta, CECO y porcentaje. Las fechas del título del período son 1–15, 16–último día o 1–último día; no dependen de la fecha de la última factura. El resumen presupone, por decisión actual de UPCO, que todo el IVA es deducible. **La equivalencia celda por celda y los resultados de Excel frente a 0201C/0202C siguen pendientes de aceptación por UPCO.** El libro final no se exporta con borradores del período.

## TXT quincenal de retenciones IVA

`lib/tax/exports.ts:ivaTxt` produce texto con 16 campos **separados por tabulador**, una operación por línea, fin de línea CRLF, montos con punto decimal y dos dígitos, y sin encabezado. La ruta HTTP anuncia `text/plain; charset=utf-8` (ver `app/api/exports/iva-txt/route.ts`). La secuencia de campos implementada es:

| # | Campo | Regla de esta versión |
| ---: | --- | --- |
| 1 | RIF agente | `settings.companyRif` |
| 2 | Período | `AAAAMM` |
| 3 | Fecha factura | `AAAA-MM-DD` |
| 4 | Tipo operación | `C` |
| 5 | Tipo documento | `01` factura, `02` nota de débito, `03` nota de crédito |
| 6 | RIF proveedor | RIF del proveedor |
| 7 | Número factura/documento | Tal como se registró |
| 8 | Número control | Control o `0` |
| 9 | Total factura | Valor absoluto, dos decimales |
| 10 | Base gravada | Base 16 % + base 8 %, valor absoluto |
| 11 | IVA retenido | Valor absoluto, dos decimales |
| 12 | Factura afectada | Número relacionado o `0` |
| 13 | Número comprobante | IVA asignado al emitir |
| 14 | Exento | Valor absoluto, dos decimales |
| 15 | Alícuota | 16,00 u 8,00 según base; **no se exporta factura mixta** |
| 16 | Indicador final | `0` |

El TXT incluye solo documentos emitidos de la quincena elegida con IVA retenido distinto de cero. Se detiene ante borradores, factura con dos tasas, fecha de factura posterior al período, nota de crédito de otra quincena, documento exento retenido o falta de comprobante. La conciliación `/api/exports/iva-reconcile` compara libro y TXT. Se localizaron tres TXT reales de octubre de 2026 con 16 campos tabulados y valores estructurales coincidentes para período, fecha, operación, tipo y alícuota; se incluyen en `modelos/`. **No hay evidencia de cuál de las dos versiones de Q2 fue aceptada por SENIAT ni de carga aceptada para esta versión del programa; validar codificación, signos, notas y archivo final con el portal.**

## XML mensual ISLR

`lib/tax/exports.ts:islrXml` genera UTF-8 sin BOM: raíz `<RelacionRetencionesISLR RifAgente="..." Periodo="AAAAMM">`, con `<DetalleRetencion>` por operación y estos hijos: `RifRetenido`, `NumeroFactura` (últimos diez caracteres si excede), `NumeroControl` (`NA` si falta), `FechaOperacion` (`DD/MM/AAAA` de pago/abono), `CodigoConcepto`, `MontoOperacion` (base gravable, dos decimales) y `PorcentajeRetencion` (dos decimales). Escapa XML. Excluye notas ISLR hasta validar su tratamiento, y rechaza cuando la tasa y la base no reproducen el monto retenido. `modelos/Ejemplo-real-ISLR-202610.xml` tiene la misma raíz, atributos y nombres de campos, pero su aceptación en el portal no fue comprobada. El sistema **no genera TXT ISLR**; la necesidad de este archivo se debe confirmar con el destino tributario.

## Hoja para macro ISLR

`lib/tax/islrXlsx.ts` crea un `.xlsx` con hoja `retISLR`, cuatro filas de cabecera, RIF agente, período y columnas A:H: `ID-Sec.`, `RIF Retenido`, `Número Factura`, `Número Control`, `Fecha Operación`, `Código Concepto`, `Monto Operación`, `Porcentaje Retención`. No contiene VBA ni ejecuta la macro original. `modelos/Macro-ISLR-UPCO-octubre-2026.xls` sí es una macro histórica de UPCO, incluida para comparar. Confirmar compatibilidad pegando las filas allí y comparando el XML aceptado; no se ejecutó la macro como parte de esta entrega.

## Cierre contable e importación

El cierre XLSX por rango usa fecha de pago/abono e incluye descripción, cuenta y distribución CECO. La plantilla de importación histórica (XLSX/CSV) se descarga desde la aplicación; `lib/tax/importDocuments.ts` valida columnas, proveedores y correlativos, permite vista previa y conserva comprobantes históricos sin recrear PDF. Los modelos entregados son referencia; la base viva no forma parte de este paquete.
