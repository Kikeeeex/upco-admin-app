# UPCO Compras: entrega para diseño de interfaz

Este ZIP contiene el código fuente de la versión instalada el 8 de noviembre de 2026. No incluye la base de datos, proveedores, facturas, credenciales, adjuntos, firma ni sello escaneados, ni el instalador del servidor. Trabaja en una copia local; el servidor de UPCO no se modifica durante el diseño.

Para ver una referencia sin instalar nada, descomprime el ZIP y abre `VISTA-PREVIA-UPCO.html` en un navegador. Usa datos ficticios y permite recorrer las pantallas y abrir formularios. Es una maqueta visual: los cambios finales deben aplicarse a los archivos `.tsx` y `.css` de la aplicación.

## Dónde trabajar

- `components/upco/upco.css`, `components/upco/accounting.css` y `components/upco/searchable-combobox.css`: estilos de la plataforma.
- `components/upco/upco-app.tsx`: estructura visual de las pantallas y formularios. Conserva los controladores, validaciones y llamadas a la API.
- `components/upco/searchable-combobox.tsx`, `money-input.tsx`: controles de búsqueda y montos.
- `app/globals.css`, `app/login/page.tsx`, `app/layout.tsx`: estilos globales, acceso y marco de la app.
- `public/`: logo e icono. Conserva la identidad de UPCO.

La interfaz debe funcionar en computadora y celular. Mantén las casillas buscables de proveedor y concepto ISLR, la selección de máquinas fiscales, los montos `#.###,##`, la distribución CECO al 100 %, la cuenta de pago obligatoria y los botones de emisión, PDF, exportación y anulación. Los textos fiscales y los formatos de retenciones/libros forman parte del funcionamiento.

No modifiques `app/api`, `db`, `drizzle`, `lib/tax`, `scripts`, ni la lógica de autenticación. Si el diseño requiere cambiar el comportamiento, anótalo para integrarlo aparte.

## Abrir una copia local

Requiere Node.js 24 y pnpm 11.25.0. En la carpeta descomprimida:

```powershell
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm admin:create
pnpm dev
```

Abre `http://127.0.0.1:3000`. Crea un usuario y contraseña **locales de prueba** cuando lo solicite la terminal. La base local empieza vacía; crea proveedores y documentos ficticios para ver las pantallas. No uses datos reales de UPCO ni copies la base del servidor.

Para comprobar los cambios antes de entregar:

```powershell
pnpm exec tsc --noEmit
pnpm build
```

La generación de PDF de retenciones necesita recursos privados que se omitieron de esta entrega. No hace falta probarla para un cambio visual; esos recursos permanecen en el proyecto principal y en el servidor.

## Devolución e instalación

Entrega los archivos fuente modificados y una lista corta de las pantallas cambiadas. Puede ser un ZIP de los archivos modificados o un enlace a una rama privada de Git. No envíes `node_modules`, `.next`, `data`, `.env`, respaldos ni una instalación completa. **No instales nada directamente en UPCO SERVER.**

Al recibir los cambios, revisaremos las diferencias, probaremos escritorio/celular y los flujos fiscales, y generaremos otro actualizador. Este sustituye el programa conservando la base de datos y los 345 proveedores. Las mejoras pendientes de importación de documentos y revisión de proveedores se harán después, por separado.
