# Modernización UI/UX v2: línea base y trazabilidad

Fecha: 2026-11-06. Fuente: especificación adjunta por UPCO del 2026-11-05. Esta matriz se comprobó contra el repositorio, no contra una sesión autenticada.

## Estado antes de editar

- Next.js 16.4.3, React 19.3.0, TypeScript, Tailwind CSS 4; CSS propio en `src/app/globals.css` y `src/app/brand.css`. Satoshi local para títulos, fuente de sistema para cuerpo, dos logos oficiales en `public/brand`.
- Shell cliente en `src/components/app-shell.tsx`; layout de servidor en `src/app/(dashboard)/layout.tsx` conserva la puerta de acceso y `SessionGuard`. Sidebar de escritorio contraíble persistido; en móvil, barra horizontal desplazable. No hay aún shadcn/ui ni una familia coherente de iconos.
- Pantallas: Inicio; Mi trabajo y ficha; Administración y ficha; Procura, ficha PRC, ficha e importación de proveedores; Seguimientos; Tecnología, Proyectos, Reportes y Configuración como vistas pendientes. Estados de error y vacío ya existen en cada flujo.
- Verificaciones iniciales: `npm test` 153 aprobadas, 1 omitida; `npm run typecheck`, `npm run lint`, `npm run build` y `bash scripts/test-sql.sh` pasan. Evidencia en `/tmp/upco-ui-v2-baseline-*` durante esta sesión.
- No hay sesión de navegador autenticada en este entorno. Las capturas previas de `docs/ui` son de un piloto aislado y no sustituyen la comparación solicitada. Capturas autenticadas a 390/800/1440 px, recorrido de teclado real y prueba de alta PRC con dos artículos quedan pendientes; se solicitaron al usuario. Las pantallas no se declaran aprobadas visualmente.

## Matriz de trazabilidad

| Vista | Cambio visual propuesto | Contrato preservado | Comprobación |
|---|---|---|---|
| Shell compartido | Tokens, iconos coherentes, ruta activa, contexto en topbar, menú móvil accesible | `getAccessContext`, `SessionGuard`, nueve rutas, cierre de sesión, preferencia de ancho | Pruebas de shell; teclado y 390/800/1440 pendientes de captura autenticada |
| Inicio | Jerarquía de tarjetas y agenda | Consultas de actividades y seguimientos; estados vacíos | Pruebas existentes de Inicio y agenda; captura pendiente |
| Mi trabajo y ficha | Filtros, tabla, ficha y estados uniformes | Alta, filtros de servidor, paginación, notas, historial, archivo, permisos | Pruebas UI y reglas existentes; captura pendiente |
| Administración y ficha | Jerarquía de formularios, documentación y agenda | Acciones de servidor, estados, documentación, seguimientos | Pruebas de administración y seguimientos; captura pendiente |
| Procura, ficha PRC | Formulario agrupado y listados legibles | Nombres de `FormData`, multiartículo, sede, solicitante, proveedor, paginación, RLS | Pruebas de líneas/solicitudes; alta autenticada de dos artículos pendiente |
| Proveedores, ficha e importación | Formularios, filtros, tablas y estados uniformes | Catálogo, archivo 30 días, eliminación, importación y permisos | Pruebas de proveedores e importación; captura pendiente |
| Seguimientos | Agenda y acciones uniformes | Reprogramación, resultado y permisos | Pruebas existentes; captura pendiente |
| TI, Proyectos, Reportes, Configuración | Solo shell común | Estado pendiente y rutas actuales | Pruebas de shell y vistas pendientes |

## Riesgos y orden

La falta de sesión autenticada impide aprobar visualmente el piloto y sus flujos reales. Se avanza con fundamentos y shell, que pueden comprobarse con pruebas aisladas y compilación. Los cambios de lógica, esquema, autenticación, acciones de servidor y contratos de formularios quedan fuera de esta iniciativa. Procura será el piloto visual antes de extender patrones a los demás módulos.
