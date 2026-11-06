# Modernización UI/UX v2: línea base y trazabilidad

Fecha: 2026-11-06. Fuente: especificación adjunta por UPCO del 2026-11-05. La matriz de contratos se comprobó contra el repositorio; las observaciones visuales posteriores provienen de capturas enviadas por el usuario.

## Estado antes de editar

- Next.js 16.4.3, React 19.3.0, TypeScript, Tailwind CSS 4; CSS propio en `src/app/globals.css` y `src/app/brand.css`. Satoshi local para títulos, fuente de sistema para cuerpo, dos logos oficiales en `public/brand`.
- Shell cliente en `src/components/app-shell.tsx`; layout de servidor en `src/app/(dashboard)/layout.tsx` conserva la puerta de acceso y `SessionGuard`. Sidebar de escritorio contraíble persistido; en móvil, barra horizontal desplazable. No hay aún shadcn/ui ni una familia coherente de iconos.
- Pantallas: Inicio; Mi trabajo y ficha; Administración y ficha; Procura, ficha PRC, ficha e importación de proveedores; Seguimientos; Tecnología, Proyectos, Reportes y Configuración como vistas pendientes. Estados de error y vacío ya existen en cada flujo.
- Verificaciones iniciales: `npm test` 153 aprobadas, 1 omitida; `npm run typecheck`, `npm run lint`, `npm run build` y `bash scripts/test-sql.sh` pasan. Evidencia en `/tmp/upco-ui-v2-baseline-*` durante esta sesión.
- No hay sesión de navegador autenticada en este entorno. Las capturas previas de `docs/ui` son de un piloto aislado. El usuario aportó después capturas de Inicio y Procura en escritorio y móvil, y de la pantalla pública de acceso. No se conocen las dimensiones nativas de esas capturas ni se recibió una captura de tableta. Falta la comparación posterior a 390/800/1440 px, el recorrido de teclado real y el alta PRC con dos artículos. Las pantallas no se declaran aprobadas visualmente.

## Capturas de línea base aportadas por UPCO

El usuario compartió en esta conversación Inicio y Procura con el menú contraído en escritorio, ambas vistas en móvil y la pantalla de acceso en escritorio y móvil. El escritorio muestra iconos sin texto en la barra contraída y un encabezado genérico «UPCO / ADMINISTRACIÓN — Panel de trabajo» incluso en Procura. En móvil, la navegación horizontal recorta destinos a la derecha y desplaza el contenido hacia abajo. Procura ya presenta grupos de artículos, destino y solicitante; ese patrón se conserva. La pantalla de acceso mantiene la marca aprobada y queda fuera de esta iniciativa. Estas imágenes son evidencia **previa**; no hay aún capturas de la versión v2 publicada ni de fichas PRC o proveedores.

## Matriz de trazabilidad

| Vista | Cambio visual propuesto | Contrato preservado | Comprobación |
|---|---|---|---|
| Shell compartido | Tokens, iconos coherentes, ruta activa, contexto en topbar, menú móvil accesible | `getAccessContext`, `SessionGuard`, nueve rutas, cierre de sesión, preferencia de ancho | Capturas previas de Inicio/Procura y pruebas de shell; comparación posterior y teclado pendientes |
| Inicio | Jerarquía de tarjetas y agenda | Consultas de actividades y seguimientos; estados vacíos | Capturas previas de escritorio/móvil; pruebas existentes; captura posterior pendiente |
| Mi trabajo y ficha | Filtros, tabla, ficha y estados uniformes | Alta, filtros de servidor, paginación, notas, historial, archivo, permisos | Pruebas UI y reglas existentes; captura pendiente |
| Administración y ficha | Jerarquía de formularios, documentación y agenda | Acciones de servidor, estados, documentación, seguimientos | Pruebas de administración y seguimientos; captura pendiente |
| Procura, ficha PRC | Formulario agrupado y listados legibles | Nombres de `FormData`, multiartículo, sede, solicitante, proveedor, paginación, RLS | Capturas previas de índice en escritorio/móvil; pruebas de líneas/solicitudes; ficha y alta autenticada de dos artículos pendientes |
| Proveedores, ficha e importación | Formularios, filtros, tablas y estados uniformes | Catálogo, archivo 30 días, eliminación, importación y permisos | Pruebas de proveedores e importación; captura pendiente |
| Seguimientos | Agenda y acciones uniformes | Reprogramación, resultado y permisos | Pruebas existentes; captura pendiente |
| TI, Proyectos, Reportes, Configuración | Solo shell común | Estado pendiente y rutas actuales | Pruebas de shell y vistas pendientes |

## Riesgos y orden

La falta de sesión autenticada para el agente y de capturas posteriores impide aprobar visualmente el piloto y sus flujos reales. Se avanza con fundamentos y shell, que pueden comprobarse con pruebas aisladas y compilación. Los cambios de lógica, esquema, autenticación, acciones de servidor y contratos de formularios quedan fuera de esta iniciativa. Procura será el piloto visual antes de extender patrones a los demás módulos.
