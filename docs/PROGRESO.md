# Progreso verificable

Estado al 29/10/2026. `hecho` requiere comprobación ejecutada; `parcial` indica código presente con verificación o dependencia pendiente.

| Historia | Traza | Estado | Dependencia o criterio pendiente |
|---|---|---|---|
| BL-01 | RNF-14 | parcial | Repositorio, CI y comandos locales listos; staging responde, CI remoto sin verificar |
| BL-02 | RNF-15 | bloqueado | Aprobación corporativa de nube y datos |
| BL-03 | RF-001 | hecho | El usuario confirmó acceso al panel tras el login corporativo y la membresía activa |
| BL-04 | RF-002, RF-003 | parcial | Guardas y casos negativos locales; validar claims y sesión reales |
| BL-05 | RNF-02, RNF-13 | hecho | Tres migraciones aplicadas al proyecto Supabase de desarrollo y registradas en historial |
| BL-06 | RNF-03 | hecho | RLS y privilegios comprobados en PostgreSQL local y Supabase con transacción sintética reversible |
| BL-07 | RNF-08, RNF-16 | parcial | Navegación presente y prueba de render; falta revisión manual móvil |
| BL-08 | RF-006, RF-007 | parcial | Descripción y sede implementadas y probadas localmente; falta comprobar desde staging con una sede autorizada |
| BL-09 | RF-008, RF-012 | hecho | Archivo/restauración y cierre/reapertura confirmados en navegador y Supabase |
| BL-10 | RF-011, RNF-05 | hecho | Nota e historial conservados tras archivo/restauración, confirmados en navegador y Supabase |
| BL-11 | RF-009 | hecho | Búsqueda y prioridad combinadas confirmadas en navegador; filtros combinados, incluida sede, probados en SQL local/remoto |
| BL-12 | RF-010 | parcial | Panel de hoy, vencidas y en espera implementado; falta comprobación autenticada y próximos seguimientos cuando exista BL-23 |
| BL-13 | RF-016, RF-017 | parcial | Gestiones y documentación implementadas, migración aplicada; falta prueba autenticada en staging |

**Siguientes pendientes:** verificar BL-08, BL-12 y BL-13 en staging; completar la prueba de 30 minutos de inactividad; configurar sedes autorizadas y continuar Sprint 2 con compromisos administrativos y Procura.

Comprobación inicial ejecutada: `npm ci`, Vitest (16 pruebas), typecheck, ESLint, build Next.js, `scripts/test-sql.sh` y petición HTTP al servidor de producción local (login 200; ruta privada sin sesión 307 hacia login; callback sin código 307 hacia login). En Supabase se verificaron ocho tablas con RLS, nueve políticas, permisos restrictivos y la suite SQL sintética con rollback. En ese corte aún no se habían ejecutado OAuth real, lectura/escritura desde el navegador, pruebas E2E ni CI remoto.

Comprobación inicial de staging del 28/10/2026: `GET /login` devolvió 200 con el botón Microsoft habilitado y sin aviso de configuración pendiente; `GET /mi-trabajo` sin sesión devolvió 307 hacia `/login`; `GET /auth/callback` sin código devolvió 307 hacia `/login`. El endpoint OAuth de Supabase devolvió 302 hacia `login.microsoftonline.com` en el tenant configurado. En esa comprobación no se realizó una autenticación con cuenta corporativa.

Después se completó el primer login corporativo y la aplicación respondió con acceso denegado, como exige la lista explícita de acceso. La identidad Azure real usa `custom_claims.tid` y `sub`; se corrigió la validación y se aplicó la tercera migración para guardar el sujeto estable. La suite SQL remota pasó con rollback. Se provisionó una organización, un perfil y una membresía administradora activa; una prueba bajo el rol autenticado de esa cuenta comprobó lectura, escritura y auditoría con rollback. Falta comprobar la sesión y persistencia desde la interfaz.

Después de publicar el cambio de autorización, el usuario confirmó que pudo abrir el panel con su cuenta corporativa. Creó una actividad sintética desde «Mi trabajo» y confirmó que aparece en «Actividades recientes». Una consulta administrativa verificó exactamente un registro, asociado a su organización y usuario, con código generado y un evento de auditoría de creación. El usuario cambió la prioridad a Alta y el estado a En progreso desde la interfaz; otra consulta confirmó ambos valores y un evento de auditoría de actualización. El token temporal de administración ya puede revocarse.

Continuación de Sprint 1: se añadieron controles de archivo/restauración, fecha visible de cierre y notas con historial por actividad. La cuarta migración amplió `activity_log` con notas inmutables y una política de INSERT limitada a actividades propias activas. La suite local pasó (25 pruebas de Vitest, typecheck, lint, build y SQL); la migración y la suite SQL sintética con rollback pasaron en Supabase de desarrollo. Los datos previos permanecieron: una actividad y dos eventos de auditoría, sin notas de prueba persistidas. Falta probar estas acciones desde el navegador.

Revisión previa a publicación: las actividades activas y archivadas ahora tienen páginas de 50 registros; cada ficha presenta su historial en páginas de 50 eventos, con autor y hora en la zona del perfil. La edición de un formulario antiguo se rechaza si la actividad fue archivada mientras estaba abierto. Los controles de edición y archivo aparecen solo al creador. Pasaron 28 pruebas de Vitest, TypeScript, ESLint, compilación y la suite SQL local y remota con rollback; esta última incluyó rechazo de notas sobre actividades archivadas y de otro miembro de la misma organización. El código de esta iteración aún requiere comprobación desde el navegador de staging.

Inicio de Sprint 2 / BL-11: el buscador y los filtros de área, estado, sede, prioridad y vencimiento se aplican en Supabase antes de paginar, preservando RLS. La búsqueda parcial usa una columna generada e índice trigram de PostgreSQL; `%` y `_` escritos por el usuario se tratan como texto, y `*` se rechaza porque PostgREST lo expande como comodín. La quinta migración se aplicó y registró en el proyecto de desarrollo. Pasaron 31 pruebas de Vitest, typecheck, lint, build y la suite SQL local/remota con rollback, incluida una combinación de filtros. La suite remota no agregó filas sintéticas. Falta la comprobación autenticada de BL-11 desde staging; no hay sedes de prueba ni asignación de sede desde el formulario actual.

El usuario confirmó desde staging que añadió una nota, archivó y restauró la actividad de prueba y conservó la nota y el historial. La consulta administrativa posterior mostró una actividad activa, cinco eventos en total y una nota. La interfaz de BL-11 todavía no estaba publicada en ese momento.

BL-11 se publicó en `main` (`5133ab1`) y la URL de staging sirvió la nueva hoja de estilos de filtros. Sin sesión, `/login` respondió 200 y las rutas privadas de listado y ficha devolvieron 307 a `/login`.

El usuario confirmó que buscar «Prueba de integración» con prioridad Alta muestra su actividad y cambiar a Baja la excluye de ambas listas. También confirmó que completar presenta fecha de cierre, reabrir la limpia y ambos cambios permanecen en el historial. La consulta administrativa final mostró una actividad activa en progreso sin fecha de cierre, siete eventos y una nota. BL-09 y BL-11 cumplen sus criterios de verificación; la prueba de sede en navegador depende de disponer de sedes de prueba y una actividad asociada.

Personalización visual: el manual de UPCO y los tres PNG originales se incorporaron a la interfaz. Login y panel usan variantes autorizadas del logo, paleta oficial y Satoshi local para títulos. Helvetica Neue se usa solo si está instalada en el equipo; el usuario optó por alternativa del sistema para no publicar archivos comerciales en el repositorio público sin licencia confirmada. Se revisaron vistas de escritorio, ancho intermedio y móvil localmente. Tras publicar en `main` (`a04dcb4`), staging sirvió el PNG verde byte por byte, la hoja CSS con paleta y Satoshi y el archivo WOFF2 con HTTP 200; `/login` respondió 200 y rutas privadas sin sesión redirigieron 307 a `/login`. Falta recibir la valoración visual del usuario en su navegador.

El usuario confirmó que el logo, los colores y los títulos se ven correctos en acceso y panel. La valoración visual queda cerrada.

Continuación de BL-08 y BL-12: se añadieron descripción opcional (hasta 5000 caracteres) y sede a los formularios, escritura explícita de NULL al limpiar ambos campos, sede visible en lista y ficha, y aviso cuando el catálogo está vacío. La FK compuesta existente mantiene la sede dentro de la organización. Inicio ahora consulta, cuenta y muestra hasta cinco registros de hoy, vencidos y en espera bajo RLS; los enlaces abren los filtros correspondientes. Hoy y vencidas excluyen estados completado/cancelado y el día usa la zona del perfil. Pasaron 47 pruebas, typecheck, ESLint, build y SQL local con rollback. Falta prueba autenticada y visual en staging; no hay sedes configuradas en el proyecto de pruebas.

Límite de sesión del 29/10: se publicó el cierre tras 30 minutos sin actividad o 8 horas desde el ingreso. Pasaron 76 pruebas, typecheck, lint y build; staging sirvió el aviso de expiración y rechazó rutas privadas sin sesión. El usuario hará posteriormente la prueba autenticada de inactividad real.

BL-13: `admin_details` guarda tipo de gestión, contraparte, referencias y estado documental en relación 1:1 con `work_items`. Una función SQL invocadora crea la gestión ADM y el detalle de forma atómica; un trigger diferido impide ADM sin ficha incluso mediante inserción directa. RLS restringe las escrituras al creador y la auditoría registra cambios de documentación que el historial ahora describe. Administración tiene formulario, lista y ficha propia. Las migraciones `20261029000000_admin_details.sql` y `20261029000001_enforce_admin_details.sql` se aplicaron y registraron en Supabase de desarrollo; RLS está activo, lectura anónima y borrado ordinario están denegados. Las pruebas locales, typecheck, lint, build y SQL pasaron; falta la verificación autenticada de la interfaz en staging.
