# UPCO Admin — Especificación MVP de Administración V2.11

**Fecha:** 13/11/2026  
**Base:** Administración V2.10.  
**Objetivo:** acercar la interfaz integrada de Administración a la versión de UPCO Compras actualmente publicada, manteniendo el sidebar compartido, los permisos y los datos propios de UPCO Admin.

## Referencias utilizadas

- Aplicación publicada: [UPCO Compras · vista de prueba](https://upco-compras-vista-20261112.duskydaisy7.chatgpt.site/).
- Código disponible en `origin/entrega/upco-compras-integral-20261110`, en particular `components/upco/upco-app.tsx`, `components/upco/upco.css` y `components/upco/brand-refresh.css`.
- `database upco.rar`: inspeccionado en modo de solo lectura. Incluye snapshots SQLite y una base activa con tablas de proveedores, documentos, usuarios, sesiones, auditoría y configuración.
- `Compras-LAN.rar` supera el límite de transferencia del entorno (32 MiB). Se contrastó la aplicación publicada mediante sus recursos CSS/JS públicos y el código de la rama de entrega. El RAR completo no se incorporó al repositorio.

## Navegación y submódulos

Administración permanece dentro de **Áreas** en el sidebar global de UPCO Admin. Sus seis destinos visibles son **Resumen**, **Compras y notas**, **Proveedores**, **Reportes**, **Configuración** y **Usuarios**. Se conservan los permisos de V2.8 y los alias de rutas anteriores. Las demás áreas mantienen su navegación.

La agrupación conserva las funciones aprobadas:

- **Compras y notas:** facturas, notas, retenciones, ficha, emisión y comprobantes.
- **Proveedores:** directorio fiscal, mantenimiento y datos tributarios.
- **Reportes:** libro de compras, TXT IVA, XML ISLR, XLSX auxiliar ISLR, cierre contable, conciliación e importación histórica.
- **Configuración:** reglas fiscales versionadas, conceptos ISLR, CECO, cuentas y correlativos.
- **Usuarios:** asignación de permisos de Administración a miembros.

## Ajustes de interfaz V2.11

- Se usan la paleta, tipografía y jerarquía visual de la página publicada dentro de las pantallas de Administración.
- Resumen presenta el período, selector de quincena, cuatro indicadores, documentos recientes y estado de la quincena en una composición adaptable.
- Compras presenta proveedor con avatar de iniciales, número/control, fecha local, bases, total, estado y acceso al documento; los importes usan formato venezolano con dos decimales.
- Proveedores presenta razón social, RIF, tipo, persona, retención IVA, estado y acceso a la ficha. Incluye revisión interna de calidad del padrón y descarga CSV bajo los mismos permisos de lectura. La revisión no consulta SENIAT. Se elimina el aviso anterior que afirmaba que el padrón vigente seguía sin importarse.
- La consulta de proveedores admite hasta 500 filas, por encima de las 345 fichas activas y confirmadas registradas en UPCO Admin.
- El directorio fiscal sigue separado del catálogo comercial de Procura. No se crean asociaciones inferidas.

## Base de datos y límites de sincronización

La base SQLite adjunta contiene 349 proveedores (348 activos y 1 inactivo) y 27 documentos emitidos. UPCO Admin contiene 345 proveedores fiscales, todos activos y confirmados; el catálogo de Procura tiene 80 registros. No se sincronizaron tablas ni documentos durante V2.11. Antes de cualquier alta, modificación o asociación, se debe comparar por RIF normalizado y revisar los registros diferentes. No se importan documentos, usuarios, sesiones, credenciales ni eventos históricos de SQLite a Supabase.

No se cambian cálculos, formatos de salida, autenticación, esquema, RLS, permisos ni datos en esta versión.

## Verificación y pendientes

La revisión comparó los recursos CSS/JS públicos de la página y el código disponible en la rama de entrega. Typecheck, ESLint, build de producción y `git diff --check` pasaron. El commit V2.11 `18938af` quedó `READY` en Producción. Sin sesión, `/login` respondió 200, `/administracion` redirigió a `/login` (307) y el endpoint CSV devolvió 403. No se ejecutaron pruebas automatizadas. La inspección visual autenticada de cada pantalla sigue pendiente.

La reconciliación de las 349 fichas SQLite con las 345 fichas fiscales de UPCO Admin es una tarea de datos separada; no forma parte de la réplica visual.
