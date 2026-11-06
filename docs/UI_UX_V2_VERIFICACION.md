# Verificación de modernización UI/UX v2

Fecha: 2026-11-06. Alcance de esta entrega: inventario, tokens, integración mínima de shadcn/ui, shell compartido y primera mejora verificable del piloto Procura. La iniciativa completa continúa por fases.

| Comprobación | Resultado | Evidencia y límite |
|---|---|---|
| Suite Vitest | 158 pasan, 1 omitida | `npm test`; 153 pasaban antes de esta fase |
| TypeScript | Pasa | `npm run typecheck` |
| ESLint | Pasa | `npm run lint` |
| Compilación Next.js | Pasa sin avisos | `npm run build` |
| SQL | Pasa | `bash scripts/test-sql.sh`; ejecuta dentro de transacción revertida |
| CI y despliegue del PR #1 | Pasan | GitHub `verify` y Vercel informan éxito para la rama de vista previa; no se ha desplegado a producción |
| Acceso a la vista previa | En revisión | UPCO confirmó haber llegado al panel, pero una captura posterior sigue mostrando Microsoft deshabilitado. UPCO informa que configuró las variables de Preview; el último despliegue registrado era de 2026-11-06 17:18 UTC. Se solicita uno nuevo para comprobar si faltaba aplicar esa configuración. Con autorización explícita, se agregó solo el callback exacto de la rama a `uri_allow_list` de Supabase y se verificó que permanecen las cinco entradas anteriores |
| Navegación | Pasa en pruebas de componentes | Nueve rutas, estado activo, persistencia de sidebar, grupos, contexto anidado, menú móvil, Escape y retorno de foco |
| Procura | Pasa en pruebas de páginas y componentes | Artículos, campos, enlaces, proveedores, filtros de servidor, permisos representados en UI y tablas desplazables con teclado |
| Responsive 390/800/1440 | Parcial, pendiente comparación | UPCO aportó capturas previas de Inicio y Procura en escritorio y móvil, sin dimensiones nativas indicadas. Faltan tableta y capturas posteriores; Chromium local no produjo capturas en este entorno |
| Contraste | Tokens medidos | Cálculos en `UI_UX_V2_TOKENS.md`; falta inspección visual de estados reales |
| Alta autenticada de dos artículos | Pendiente | La prueba SQL de multiartículo pasa, pero se requiere alta real en el entorno de pruebas |

No se modificaron acciones de servidor, consultas, esquema, RLS, rutas, código de sesión ni nombres de `FormData`. La única modificación externa de autenticación fue la URL exacta de retorno de esta vista previa, autorizada por UPCO. No se publicó en producción. El shell y las tablas de Procura todavía requieren comparación antes/después con datos reales; hasta entonces no se declara concluida la fase 3 ni se extienden sus patrones a los demás módulos.
