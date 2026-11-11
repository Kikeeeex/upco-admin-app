# Fuentes para contraste fiscal

Los enlaces siguientes apuntan al texto original de la Gaceta, providencia o manual, aunque algunos se alojan como copia en un tercero. Se consultaron el 10/11/2026. **No sustituye comprobar la publicación oficial y la vigencia posterior.** La red de empaquetado bloqueó la descarga local de estos PDF; por ello se dejan enlaces verificables y no se afirma que estén adjuntos.

| Tema | Texto primario / referencia | Relación con el programa |
| --- | --- | --- |
| IVA, agentes de retención | [Providencia SNAT/2025/000054, G.O. 43.171](https://soytecnologia.com/app/Descargas/PA0054-Ret-IVA.-GO43171.pdf) | Supuestos y porcentajes 75 %/100 %, comprobantes y periodicidad. |
| UT | [Gaceta Oficial 43.140 de 02/06/2025](https://inseroca.com/wp-content/uploads/2025/06/Unidad-tributaria-GO-43140-02-06-2025-Aumento-_250604_115749.pdf) | Fuente del valor inicial Bs. 43; verificar si hubo cambios posteriores. |
| ISLR retenciones | [Decreto 1.808, G.O. 36.203](https://www.cidtct.uc.edu.ve/wp-content/uploads/2025/05/Decreto-1808-ISLR.pdf) | Porcentajes, bases, sustraendos y condiciones. |
| ISLR ley | [Ley de reforma parcial de ISLR](https://www.cmchacao.gob.ve/wp-content/uploads/2025/08/Decreto-con-Rango-Valor-y-Fuerza-de-Ley-de-Reforma-Parcial-del-Decreto-con-Rango-Valor-y-Fuerza-de-Ley-de-Impuesto-sobre-la-Renta.pdf) | Marco legal y continuidad del régimen. |
| Catálogo ISLR y archivo | [Manual técnico SENIAT de retenciones ISLR, edición 2014](https://ritaferrer73.wordpress.com/wp-content/uploads/2014/09/seniat-manual-tc3a9cnico-sistema-islr-retenciones-islrv3-0_2014.pdf) | Fuente histórica transcrita de códigos 001–086 y hoja de macro; **validar catálogo vigente**. |
| IGTF | [Ley de reforma IGTF, G.O. extraordinaria 6.687](https://avisavenezuela.org/wp-content/uploads/GO-6687-LEY-DE-REFORMA-PARCIAL-IGTF.pdf) | Definición de operaciones, sujetos y alícuotas. |
| IGTF, alícuota 0 % en ciertos casos | [Decreto 4.972, G.O. extraordinaria 6.821](https://dhqr.me/wp-content/uploads/2024/07/Decreto-que-fija-en-0-la-alicuota-del-IGTF.pdf) | Impide asumir que toda operación marcada con IGTF causa 3 %. |
| Emisión de facturas y otros documentos | [Providencia SNAT/2026/00093, G.O. 43.484 de 21/10/2026](https://a2.com.ve/wp-content/uploads/SNAT202600093_PROVIDENCIA_ADMIISTRATIVA.pdf) | Revisar requisitos del documento soporte, máquinas fiscales y datos del proveedor; no se incorporó automáticamente al modelo de compra. |
| Sujetos pasivos especiales | [Providencia SNAT/2026/00099, G.O. 43.485 de 22/10/2026](https://iusdata.com/wp-content/uploads/2026/10/PDF-SENIAT-PROVIDENCIA-99-22OCT26.pdf) | Revisar su aplicación a UPCO y proveedores especiales antes de automatizar condición fiscal. |

El catálogo `lib/tax/islrConcepts.ts` indica fuente por concepto y distingue `flat`, `subtraction`, `threshold`, `tiered` y `variable`. Los PDF de retención y libros aportados por UPCO son **modelos empresariales**, no textos normativos. Las especificaciones TXT/XML del paquete reflejan el código observado y aún requieren prueba con el portal; no se halló un manual técnico oficial actualizado y aceptado para estos archivos durante este trabajo.
