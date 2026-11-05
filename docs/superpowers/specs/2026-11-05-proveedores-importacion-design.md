# Directorio e importación de proveedores

Fuente: `UPCO_Admin_Cambio_Importacion_Proveedores_Excel_CSV.md` y el Excel corporativo entregado por UPCO el 05/11/2026. El Excel no se guarda en el repositorio ni se usa como fixture. Se verificó la hoja `Directorio de Proveedores`: 81 filas de datos, diez encabezados A:J y notas auxiliares en M.

## Intención y límites

La cuenta habilitada podrá crear, editar, buscar e importar proveedores con los diez campos comerciales del Excel. El asistente mostrará mapeo, vista previa, incidencias, coincidencias y resultado antes de guardar. Los proveedores siguen siendo referencias comerciales dentro de Procura, con los mismos ID y asociaciones. No se crean usuarios ni se cambia el acceso Microsoft.

## Línea base y migración

`public.vendors` ya guarda `name`, `contact_name`, `phone`, `email`, `notes`, `associated_area`, marcas de archivo y autor. `procurement_details.vendor_id` apunta al ID de ese catálogo y conserva `vendor_name` como copia histórica. No existe aún un módulo de cotizaciones; cuando se implemente BL-17 consultará el mismo catálogo.

Se añaden `country`, `tax_identifier`, `sales_area`, `website`, `city`, `products_services_detail`. `name`, `phone` y `email` conservan su columna. `contact_name` se presenta como «Persona de contacto». `notes` y `associated_area` quedan como datos legados internos, sin borrado. La nueva alta solo requiere `name`; el trigger antiguo de área requerida se elimina. Se sustituye la unicidad solo por nombre con índices parciales para fiscal+país y nombre+país cuando no hay fiscal. Los nombres sin país pasan por revisión de coincidencias en el importador. Los ID, RLS, archivo y referencias no cambian.

## Flujo elegido

Next.js sigue con acciones de servidor y el cliente Supabase del usuario. El navegador conserva el archivo hasta confirmar; el servidor lo lee en inspección, vista previa y confirmación. No se almacena el original ni se envía a terceros. La confirmación recalcula validación y coincidencias y llama a una función SQL invocadora que escribe el lote en una transacción; cada fila recibe número de origen. La política normal omite coincidencias y filas de revisión, y el resultado presenta conteos e incidencias. Un registro de lote guarda solo metadatos y conteos.

El parser acepta XLSX y CSV (UTF-8/BOM, coma o punto y coma), hasta 4 MB y 10 000 filas. El límite es configurable y deja margen bajo el tope de carga de Vercel de 4,5 MB por petición. Comprueba firma/estructura, rechaza fórmulas en campos importables y no lee la columna M salvo mapeo explícito. La hoja del directorio se preselecciona. El usuario puede ajustar el mapeo de los diez campos; solo «Proveedor» es obligatorio. El texto se trata como dato inerte. Sitio web se conserva como texto y solo se enlaza si forma una URL segura.

## Coincidencias y actualización

La clave principal es fiscal normalizado dentro de país, o nombre normalizado con país cuando falta fiscal. País ausente, nombres parecidos y resultados múltiples se marcan para revisión. Se detectan duplicados dentro del archivo. Por defecto se omiten. La actualización de coincidencias requiere selección de filas y campos; valores vacíos no limpian datos. La escritura vuelve a comprobar los identificadores y reglas bajo RLS antes de guardar. Los proveedores archivados no se reactivan mediante importación.

## Interfaz y verificación

El directorio muestra columnas principales, búsqueda por los cinco campos pedidos, filtros país/área de venta, paginación y acceso a una ficha con los diez campos. Alta y edición muestran exactamente esas etiquetas comerciales. El asistente tiene Archivo, Mapeo, Vista previa y Resultado, con resumen e incidencias descargables sin datos sensibles adicionales. Se probará con datos sintéticos; el Excel real se usará solo en una comprobación local de lectura y para la prueba manual de staging.

## Alternativas consideradas

- Parsear solo en el navegador ahorra cargas repetidas, pero no satisface la validación del servidor y aumenta el código cliente.
- Guardar el Excel en Supabase entre pasos reduce la segunda carga, pero conserva contactos innecesariamente.
- Releer el archivo al confirmar mantiene el estado temporal en el navegador y permite volver a validar con un costo de lectura aceptable para 81 filas y el límite de 4 MB. **Elegido**.

La migración SQL y el código pueden probarse localmente. El token de administración de Supabase presente al iniciar devolvió 401, por lo que la aplicación remota de la migración requiere renovar esa variable antes de publicar una interfaz que consulte las columnas nuevas.
