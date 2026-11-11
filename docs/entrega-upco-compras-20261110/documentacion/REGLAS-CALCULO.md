# Fórmulas implementadas en esta versión

**Origen verificable:** `lib/tax/core.ts`, `lib/tax/islrConcepts.ts`, `lib/tax/exports.ts` del ZIP de código. Los montos de cálculo se guardan en céntimos enteros; cada impuesto se redondea al céntimo con `Math.round`. La visualización monetaria usa separador de miles punto y decimal coma. Las notas de crédito se guardan con signo negativo.

| Magnitud | Regla actual |
| --- | --- |
| Subtotal | Exento + base 16 % + base 8 %. Debe ser positivo antes de aplicar signo de nota. |
| IVA 16 % | `redondear_céntimo(base16 × tasa_general / 100)`; tasa inicial 16 %. |
| IVA 8 % | `redondear_céntimo(base8 × tasa_reducida / 100)`; tasa inicial 8 %. |
| Total facturado | Subtotal + IVA 16 % + IVA 8 %. |
| IVA retenido | `redondear_céntimo((IVA16 + IVA8) × porcentaje / 100)`; porcentaje 0, 75 o 100 según proveedor/documento. Al 0 % exige motivo salvo proveedor formal; al 100 % exige causal. Si ambas bases gravadas son cero, se fuerza 0 % y no se asigna comprobante IVA. |
| IGTF | Si se activa, exige base propia positiva y calcula `redondear_céntimo(base_IGTF × 3 %)`. Se suma al neto a pagar; no se incorpora al subtotal ni al total facturado ni al TXT IVA/XML ISLR. La aplicación de este tributo a una operación concreta debe decidirse fuera del sistema. |
| Base ISLR | Por defecto el subtotal sin IVA; se permite una porción hasta el subtotal. |
| ISLR automático | Solo conceptos marcados `flat` con alícuota y porcentaje de base explícitos: base gravable = redondear(base ISLR × porcentaje de base); bruto = redondear(base gravable × tasa); retención = máximo(0, bruto − sustraendo). |
| ISLR con sustraendo, umbral, escala o base variable | La aplicación exige cálculo manual con motivo, tasa, sustraendo y monto, salvo que se valide y configure una fórmula. El catálogo incluye metadatos del factor `83,3334 × UT × tasa` pero esos conceptos no se emiten por la ruta automática `flat`. |
| Neto a pagar | Total facturado + IGTF − IVA retenido − ISLR retenido. Para nota de crédito se invierte el signo del resultado. |

La UT configurada por defecto es Bs. 43 desde 02/06/2025 y se puede actualizar con fecha de vigencia. El código busca la UT aplicable a la fecha de pago o abono. No se ha certificado que siga siendo el valor vigente al 10/11/2026; comparar con fuente oficial antes de usarla para un cálculo fiscal. Los 86 conceptos del catálogo son una transcripción del manual técnico histórico; solo se muestran en captura los aplicables a persona natural residente (PNR) o jurídica domiciliada (PJD). Ver `CATALOGO-ISLR.csv` y el archivo fuente para todos los casos.

## Validaciones al registrar

RIF de proveedor, razón social y clase fiscal; número de documento, control, fechas válidas, subtotal positivo, cuenta activa, un CECO activo o más sin repetir y suma exacta de 100 % con dos decimales. La quincena elegida puede ser la derivada de la fecha de pago/abono o la siguiente; al diferir exige motivo. Una nota requiere factura emitida del mismo proveedor. Las retenciones se asignan al emitir y se guarda un snapshot de configuración para el comprobante.

## Casos especiales actualmente bloqueados

El TXT IVA detiene una factura retenida con base 16 % y 8 % simultáneas, porque el formato implementado tiene una alícuota por línea. También detiene notas de crédito que afectan otra quincena o mes, hasta validar cómo se declaran. XML ISLR detiene notas con ISLR y las retenciones manuales cuyo monto no coincide con base gravable por alícuota. Un período con borradores relevantes detiene su cierre final. Estos bloqueos son deliberados, no equivalen a una decisión fiscal definitiva.
