# BL-15 · Catálogo de proveedores de Procura

## Intención

Registrar proveedores de la organización una sola vez para usarlos al crear solicitudes y cotizaciones de Procura. BL-15 entrega el catálogo; la selección desde solicitudes se integrará en BL-16/BL-17.

## Enfoques

- Guardar el nombre como texto en cada solicitud: rápido, pero genera duplicados y no permite corregir datos de contacto en un lugar.
- Crear `vendors` como entidad de organización con nombre único normalizado: coincide con el modelo lógico y permite referencias por UUID. **Elegido**.

## Comportamiento

- Procura muestra un formulario para crear proveedor y una lista paginada con edición. Nombre obligatorio; contacto, correo, teléfono y observaciones opcionales. Correo, cuando exista, debe ser válido.
- Nombres iguales en la misma organización, sin distinguir mayúsculas ni espacios repetidos, se rechazan con un mensaje claro. Otras organizaciones pueden usar el mismo nombre.
- Miembros activos de la organización pueden consultar el catálogo; solo quien creó un proveedor puede modificarlo. No hay borrado común. Las acciones validan la sesión y la base de datos aplica RLS.
- Se conservan fechas de creación y modificación. Ninguna solicitud se vincula todavía al proveedor; esa integración corresponde a los bloques siguientes.

## Límites

No se almacenan credenciales de proveedores ni se envían correos. La validación web con un proveedor de prueba completa el alta y edición de BL-15; la selección dentro de solicitudes se comprobará cuando exista BL-16.
