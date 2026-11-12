# Diseño V2.8 — permisos por tarea en Administración

## Objetivo

Permitir que una persona con membresía `member` reciba acceso explícito a funciones administrativas concretas, manteniendo el acceso completo de `admin` y la denegación por defecto. El control debe aplicar en navegación, páginas, acciones, rutas de descarga, RLS y RPCs privilegiadas.

## Llamada de diseño

Se consideraron (1) dejar el módulo solo para administradores; (2) ampliar roles fijos como `administration_viewer` y `administration_operator`; (3) mantener `admin/member` y guardar permisos explícitos por miembro. Se implementa (3): los roles fijos no permiten combinaciones pequeñas de tareas, y el modelo actual ya identifica cada miembro por organización. La asignación por usuario evita que un permiso global de `member` se propague a otras funciones.

## Matriz de permisos

| Permiso | Alcance |
|---|---|
| `purchases.read` | Consultar compras/documentos |
| `purchases.manage` | Crear y editar borradores |
| `vendors.read` | Consultar el directorio fiscal |
| `vendors.manage` | Crear y editar proveedores fiscales |
| `retentions.read` | Consultar retenciones |
| `books.read` | Consultar libros y cierres |
| `imports.validate` | Validar archivos históricos sin escribir |
| `reports.export` | Consultar reportes y descargar salidas |
| `fiscal_settings.read` | Consultar propuestas, activaciones y parámetros fiscales |
| `fiscal_settings.manage` | Crear propuestas de configuración |

`admin` tiene todos los permisos implícitamente; no necesita filas de concesión. `member` parte sin permisos. Emitir, anular, activar configuración e importar lotes reales siguen siendo tareas exclusivas de administradores en esta versión; los permisos granulares habilitan consulta, borradores, mantenimiento, propuestas fiscales y validación de archivos sin escritura. Solo administradores pueden consultar miembros o cambiar concesiones. La actualización reemplaza el set de permisos de una persona en una transacción y registra auditoría.

## Seguridad e integración

- PostgreSQL expone una función `has_administration_permission(organization_id, user_id, permission)` con `SECURITY DEFINER`, `search_path` fijo, verificación de membresía activa y bypass implícito solo para `admin`.
- Una tabla por permiso y otra append-only de eventos guardan concesiones por organización/usuario. RLS permite a la persona consultar sus propios permisos y limita la gestión a administradores.
- RLS aplica permisos a datos fiscales. Los permisos de lectura de retenciones/libros/reportes/importación solo habilitan lectura de los documentos necesarios; los permisos de escritura conservan las restricciones por estado y autor.
- RPCs de emisión, anulación, activación e importación conservan su comprobación administrativa. Las acciones de consulta, borradores, proveedores, propuestas y validación usan la matriz granular.
- La interfaz oculta enlaces sin permiso y la página de permisos solo está disponible para `admin`. El acceso directo a una ruta sin capacidad devuelve denegación/redirect y no revela datos.
- No se habilita la aplicación de la configuración fiscal; sigue vacía en Supabase y no se inventan valores de cuentas, CECO ni correlativos.

## Fuera de alcance

No se cambian permisos de Procura, TI, Proyectos, membresías corporativas ni identidad. No se crean roles nuevos ni se asignan capacidades automáticamente a `member`.

## Verificación

Revisar las políticas en Supabase, validar que los grants solo cambian mediante RPC administrador, confirmar que `admin` mantiene el flujo actual y que `member` sin grants queda denegado. Ejecutar `npm run typecheck`, `npm run lint`, `npm run build` y `git diff --check`; no ejecutar la suite de pruebas automatizadas.
