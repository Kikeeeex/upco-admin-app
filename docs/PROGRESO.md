# Progreso verificable

Estado al 28/10/2026. `hecho` requiere comprobación ejecutada; `parcial` indica código presente con verificación o dependencia pendiente.

| Historia | Traza | Estado | Dependencia o criterio pendiente |
|---|---|---|---|
| BL-01 | RNF-14 | parcial | Repositorio, CI y comandos locales listos; staging responde, CI remoto sin verificar |
| BL-02 | RNF-15 | bloqueado | Aprobación corporativa de nube y datos |
| BL-03 | RF-001 | hecho | El usuario confirmó acceso al panel tras el login corporativo y la membresía activa |
| BL-04 | RF-002, RF-003 | parcial | Guardas y casos negativos locales; validar claims y sesión reales |
| BL-05 | RNF-02, RNF-13 | hecho | Tres migraciones aplicadas al proyecto Supabase de desarrollo y registradas en historial |
| BL-06 | RNF-03 | hecho | RLS y privilegios comprobados en PostgreSQL local y Supabase con transacción sintética reversible |
| BL-07 | RNF-08, RNF-16 | parcial | Navegación presente y prueba de render; falta revisión manual móvil |
| BL-08 | RF-006, RF-007 | hecho | Creación, lista y edición verificadas desde el navegador y en Supabase |
| BL-09 | RF-008, RF-012 | parcial | Archivo/restauración confirmados en navegador; cierre/reapertura probados en SQL, pendientes en navegador |
| BL-10 | RF-011, RNF-05 | hecho | Nota e historial conservados tras archivo/restauración, confirmados en navegador y Supabase |
| BL-11 | RF-009 | parcial | Búsqueda por código/título y filtros combinables implementados; SQL local/remoto probado, falta prueba en navegador con sesión |

**Siguiente historia:** BL-12, panel diario con hoy, vencidas y en espera.

Comprobación inicial ejecutada: `npm ci`, Vitest (16 pruebas), typecheck, ESLint, build Next.js, `scripts/test-sql.sh` y petición HTTP al servidor de producción local (login 200; ruta privada sin sesión 307 hacia login; callback sin código 307 hacia login). En Supabase se verificaron ocho tablas con RLS, nueve políticas, permisos restrictivos y la suite SQL sintética con rollback. En ese corte aún no se habían ejecutado OAuth real, lectura/escritura desde el navegador, pruebas E2E ni CI remoto.

Comprobación inicial de staging del 28/10/2026: `GET /login` devolvió 200 con el botón Microsoft habilitado y sin aviso de configuración pendiente; `GET /mi-trabajo` sin sesión devolvió 307 hacia `/login`; `GET /auth/callback` sin código devolvió 307 hacia `/login`. El endpoint OAuth de Supabase devolvió 302 hacia `login.microsoftonline.com` en el tenant configurado. En esa comprobación no se realizó una autenticación con cuenta corporativa.

Después se completó el primer login corporativo y la aplicación respondió con acceso denegado, como exige la lista explícita de acceso. La identidad Azure real usa `custom_claims.tid` y `sub`; se corrigió la validación y se aplicó la tercera migración para guardar el sujeto estable. La suite SQL remota pasó con rollback. Se provisionó una organización, un perfil y una membresía administradora activa; una prueba bajo el rol autenticado de esa cuenta comprobó lectura, escritura y auditoría con rollback. Falta comprobar la sesión y persistencia desde la interfaz.

Después de publicar el cambio de autorización, el usuario confirmó que pudo abrir el panel con su cuenta corporativa. Creó una actividad sintética desde «Mi trabajo» y confirmó que aparece en «Actividades recientes». Una consulta administrativa verificó exactamente un registro, asociado a su organización y usuario, con código generado y un evento de auditoría de creación. El usuario cambió la prioridad a Alta y el estado a En progreso desde la interfaz; otra consulta confirmó ambos valores y un evento de auditoría de actualización. El token temporal de administración ya puede revocarse.

Continuación de Sprint 1: se añadieron controles de archivo/restauración, fecha visible de cierre y notas con historial por actividad. La cuarta migración amplió `activity_log` con notas inmutables y una política de INSERT limitada a actividades propias activas. La suite local pasó (25 pruebas de Vitest, typecheck, lint, build y SQL); la migración y la suite SQL sintética con rollback pasaron en Supabase de desarrollo. Los datos previos permanecieron: una actividad y dos eventos de auditoría, sin notas de prueba persistidas. Falta probar estas acciones desde el navegador.

Revisión previa a publicación: las actividades activas y archivadas ahora tienen páginas de 50 registros; cada ficha presenta su historial en páginas de 50 eventos, con autor y hora en la zona del perfil. La edición de un formulario antiguo se rechaza si la actividad fue archivada mientras estaba abierto. Los controles de edición y archivo aparecen solo al creador. Pasaron 28 pruebas de Vitest, TypeScript, ESLint, compilación y la suite SQL local y remota con rollback; esta última incluyó rechazo de notas sobre actividades archivadas y de otro miembro de la misma organización. El código de esta iteración aún requiere comprobación desde el navegador de staging.

Inicio de Sprint 2 / BL-11: el buscador y los filtros de área, estado, sede, prioridad y vencimiento se aplican en Supabase antes de paginar, preservando RLS. La búsqueda parcial usa una columna generada e índice trigram de PostgreSQL; `%` y `_` escritos por el usuario se tratan como texto. La quinta migración se aplicó y registró en el proyecto de desarrollo. Pasaron 31 pruebas de Vitest, typecheck, lint, build y la suite SQL local/remota con rollback, incluida una combinación de filtros. La suite remota no agregó filas sintéticas. Falta la comprobación autenticada de BL-11 desde staging.

El usuario confirmó desde staging que añadió una nota, archivó y restauró la actividad de prueba y conservó la nota y el historial. La consulta administrativa posterior mostró una actividad activa, cinco eventos en total y una nota. La interfaz de BL-11 todavía no estaba publicada en ese momento.
