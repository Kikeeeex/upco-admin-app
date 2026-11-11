# Auditoría de proveedores importados · 9 de noviembre de 2026

Se cotejaron las 345 filas de `import/suppliers.json` con la base **local de preparación** `data/upco.sqlite` y con los PDF de respaldo en la carpeta de retenciones. Esta revisión es de solo lectura: no cambió ningún proveedor ni quitó la marca `needs_review`. La base local es una copia anterior a los cambios que puedan haberse hecho en UPCO SERVER; para cerrar cada ficha hay que revisar el servidor y el RIF vigente.

## Resultado automatizado

- 345 RIF únicos en el consolidado y 345 proveedores correspondientes en la base local. Nombres, direcciones, tipos y fuentes coinciden entre ambos; no hay filas extra ni faltantes.
- Los 345 PDF principales existen y se pudieron leer. Se abrieron 346 PDF distintos al seguir también los respaldos de campos.
- Los 345 proveedores siguen marcados para revisión fiscal: «ordinario» fue un valor inicial, no una condición demostrada por los comprobantes.
- En 240 fichas la clase de persona se infirió sin respaldo expreso; en 245, la residencia o domicilio también se infirió. En 12, el porcentaje IVA de 75 % es una sugerencia sin comprobante legible.
- Hay 45 RIF con variantes históricas de nombre o dirección. Se conservó el valor más reciente, pero conviene cotejarlo con la ficha fiscal actual.
- No constan correo ni teléfono en ninguna de las 345 fichas importadas. Son datos para completar si UPCO los necesita.

## Revisiones prioritarias

1. **V178700835 · Abraham Jesús Mejías Velásquez:** el RIF empieza por V, pero el consolidado lo clasifica como persona jurídica domiciliada a partir de un comprobante ISLR. Revisar la ficha fiscal y el concepto de ISLR antes de emitir una retención nueva.
2. **J401692524 y J501692524 · Ferreconstrucciones Yalexy, C.A.:** mismo nombre bajo dos RIF distintos en comprobantes históricos. No se fusionaron; verificar cuál corresponde al proveedor actual y si hubo error de transcripción.
3. **E843987632, E844834600, E845514618 y E845588913:** el RIF no aparece en el texto extraído del PDF principal. Los cuatro se obtuvieron de libros de compras previos, con el mismo nombre; cotejar esos respaldos y la ficha fiscal. El CSV conserva el PDF principal de cada uno.
4. **Inversiones Pelagias, C.A. y Supermercado Todos los Días Zheng, F.P.:** siguen fuera de los 345 porque sus comprobantes no aportan un RIF verificable. Están en `import/remaining_missing_rif.csv`.

## Archivo para revisar

`supplier-review.csv` contiene una fila por cada uno de los 345 proveedores, con RIF, datos actuales del consolidado, PDF principal, confianza, cantidad de comprobantes y códigos de revisión. Los códigos `*_inferred` o `*_unverified` indican que el dato no está demostrado por la evidencia; no significan automáticamente que sea incorrecto. `rif_not_found_in_source_text` indica que el RIF provino de un respaldo complementario.

Esta auditoría comprueba consistencia y existencia de respaldos, pero no puede certificar automáticamente la vigencia tributaria, la dirección fiscal ni la tasa que SENIAT asigna hoy a cada proveedor. Esas verificaciones deben hacerse contra la ficha fiscal y guardarse en la aplicación.
