# Plan V2.10: paridad visual y funcional con UPCO Compras

**Base:** `docs/superpowers/specs/2026-11-13-administration-reference-parity-design.md`
**Fuente:** `origin/entrega/upco-compras-integral-20261110` (`e2b724b`), `components/upco/upco-app.tsx`, `upco.css`, `brand-refresh.css`.

## Tareas

### 1. Reordenar sidebar y reducir la navegación a seis destinos

- Insertar Administración dentro de Áreas, antes de Procura.
- Actualizar etiquetas del menú a Resumen, Compras y notas, Proveedores, Reportes, Configuración, Usuarios.
- Dejar Usuarios solo para administradores y combinar visibilidad/permisos de Reportes con `reports.export`, `books.read` e `imports.validate`.
- Reubicar los iconos y breadcrumbs para que el destino activo se identifique con el nuevo mapa.
- Conservar los segmentos de ruta históricos de Retenciones/Libros/Importaciones como alias a las pantallas agrupadoras.

### 2. Alinear Resumen, Compras y Proveedores con la fuente

- Resumen: período/quincena, KPI financieros y de documentos, tabla de recientes y estado de quincena, calculados con registros y snapshots reales.
- Compras: tabla de referencia (documento/proveedor/emisión/bases/totales/estado/acciones), filtros y creación; incluir el resumen de retenciones aprobado como contenido de esa pantalla.
- Proveedores: conservar el padrón y las operaciones actuales, con la jerarquía de tabla/formulario del código fuente.

### 3. Agrupar Reportes, Configuración y Usuarios

- Reportes: reunir exportaciones, libro/cierre, conciliación y vista previa/confirmación de importación. Renderizar cada bloque solo cuando el permiso correspondiente está concedido.
- Configuración: etiqueta corta del menú, manteniendo configuración fiscal versionada y catálogos.
- Usuarios: presentar la asignación de permisos actual bajo el módulo Usuarios; conservar que solo administradores puedan cambiarla.
- Redirigir alias de Retenciones, Libros e Importaciones a las pantallas integradas sin eliminar funciones ni relajar guardas.

### 4. Fidelidad visual, documentación y verificación

- Adaptar la estructura/clases del código UPCO Compras al AppShell de UPCO Admin y al CSS existente sin copiar autenticación/API de la referencia.
- Revisar escritorio y móvil, roles/filtrado de navegación, estados vacíos, y una ruta no administrativa.
- Actualizar MVP V2.10, `README.md`, `DECISIONES.md` y `PROGRESO.md`.
- Ejecutar typecheck, lint, build y diff-check. No añadir ni ejecutar pruebas automatizadas por la instrucción activa del entorno.
