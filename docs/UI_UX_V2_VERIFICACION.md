# Verificación de modernización UI/UX v2

Fecha de actualización: 2026-11-11. Alcance de esta entrega: fundamentos visuales, shell compartido y piloto de Procura. Las fases 4 y 5 quedan en pausa por decisión de UPCO.

## Comprobaciones automatizadas sobre la rama del PR #1

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Suite Vitest | 158 pasan, 1 omitida | `npm test`, ejecutado el 2026-11-11 en `9a556c38ea7e3de80d1fce4eb93d8982e4f88a6e` |
| TypeScript | Pasa | `npm run typecheck`, misma revisión |
| ESLint | Pasa | `npm run lint`, misma revisión |
| Compilación Next.js | Pasa | `npm run build`, misma revisión |
| SQL local | Pasa | `bash scripts/test-sql.sh`, suites ejecutadas en transacciones revertidas |
| CI y vista previa | Aprobados en la revisión consultada | Dos verificaciones `verify`, Vercel y Vercel Preview Comments reportaron éxito para la rama antes de registrar esta actualización; los checks se repetirán para el nuevo commit documental |

## Validación manual del piloto Procura

UPCO confirmó en la vista previa autenticada:

- Comparación de Inicio y Procura en escritorio, móvil y tableta; no se observaron recortes en las áreas capturadas.
- Alta de una solicitud PRC con dos renglones. La ficha muestra botas (2 pares) y guantes (5 pares).
- El menú móvil abre y cierra.
- No hay desplazamiento horizontal de página en móvil ni tableta.
- La navegación con Tab alcanza enlaces, campos y botones de Procura y mantiene visible el foco.
- El inicio de sesión Microsoft abre el panel en la vista previa.

## Campo «Fecha límite»

El formulario usa un control HTML nativo `input type="date"`. Su presentación visual se localiza según el navegador y el sistema del usuario; en una captura en español apareció `mm/dd/yyyy`. La validación acepta `YYYY-MM-DD` y la columna de almacenamiento es `date`, por lo que no se debe forzar el texto del marcador ni cambiar el contrato de datos para corregir una presentación del navegador. No requiere cambio de código en este PR.

## Alcance y límites

El piloto Procura queda validado y puede integrarse. No se modificaron esquema, RLS, autenticación, consultas, acciones de servidor, rutas, filtros, paginación ni nombres de `FormData` como parte de esta modernización. La URL exacta de retorno de la vista previa se añadió previamente con autorización de UPCO y se mantuvo el resto de la lista de Supabase.

La validación de producción se hará después de integrar y comprobar el despliegue a `main`. La vista previa de la rama debe conservar su callback mientras siga siendo necesaria para revisión. No se han iniciado las fases 4 y 5: modernización de Inicio, Mi trabajo, Administración y Seguimientos, revisión transversal, limpieza de estilos duplicados y documentación final. No publicar en producción sin verificar primero el despliegue activado por la fusión.
