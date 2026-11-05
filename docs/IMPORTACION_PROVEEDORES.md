# Importación de proveedores

En **Procura → Proveedores → Importar proveedores**, selecciona un `.xlsx` o `.csv` UTF-8 de hasta 4 MB y 10 000 filas. Si el libro tiene varias hojas, elige la hoja y pulsa **Leer archivo** de nuevo. Comprueba el mapeo de las diez columnas; solo **Proveedor** es obligatorio. La columna M de notas auxiliares del directorio UPCO queda sin asignar.

La vista previa marca proveedores nuevos, coincidencias, filas repetidas, casos para revisar y errores. Los proveedores existentes y los casos ambiguos se omiten por defecto. Para actualizar coincidencias propias, marca sus filas y elige los campos que deseas copiar. Las celdas vacías nunca borran valores. Corrige las filas con error en el archivo de origen y vuelve a cargarlo; la aplicación no altera el original.

Tras confirmar, la base de datos guarda el lote en una sola transacción y devuelve conteos. **Descargar incidencias CSV** exporta números de fila y motivos; el archivo no contiene contactos ni el documento original. El lote conserva solo metadatos y conteos en `vendor_import_batches`. Una segunda carga del mismo archivo debe omitir los proveedores ya registrados.

## Verificación y publicación

Aplicar `20261105000000_vendor_directory.sql` y `20261105000001_vendor_import.sql` en ese orden antes de publicar el código de la interfaz. Ejecutar `bash scripts/test-sql.sh`, `npm test`, `npm run typecheck`, `npm run lint` y `npm run build`. La comprobación local del Excel real se ejecuta con `UPCO_VENDOR_EXCEL_PATH=/ruta/privada/archivo.xlsx npx vitest run tests/procurement/vendor-import-reference.test.ts`; nunca guardar ese archivo en Git.

En staging, importar primero un CSV sintético con un proveedor nuevo y uno ya existente. Confirmar alta, omisión en la segunda carga, edición manual, búsqueda, filtro y selección del proveedor desde una solicitud. La prueba del selector de cotizaciones queda pendiente hasta que exista BL-17. Para el directorio UPCO entregado, el parser leyó 81 filas: 80 válidas y una con un correo que contiene dos direcciones. Corregir esa celda en el origen antes de importar o aceptar su rechazo visible en la vista previa.

## Reversión

Si falla la interfaz tras aplicar las migraciones, volver a desplegar el commit anterior de la aplicación. Las columnas añadidas son compatibles con la versión anterior, que las ignora. No eliminar columnas ni el catálogo para revertir: los proveedores importados y sus referencias deben conservarse. Una reversión de esquema requiere inventariar primero los lotes y las referencias a `vendors`, respaldar los datos y acordar una migración correctiva.
