# Cierre, archivo y notas de Sprint 1 — Plan de implementación

> **Ejecución:** trabajo directo en el checkout existente; este entorno cloud ya está aislado. Verificar cada tarea con una prueba que falle antes del cambio y pase después.

**Objetivo:** completar BL-09 y BL-10 de la especificación: cierre y reapertura visibles, archivo y restauración, notas e historial consultable.

**Arquitectura:** mantener `work_items` y `activity_log` bajo RLS. Las acciones de servidor vuelven a comprobar sesión, organización y autoría. `archived_at` conserva los registros; las notas serán eventos inmutables en `activity_log` y los cambios críticos seguirán registrados por el trigger existente.

**Stack:** Next.js 16, React 19, TypeScript, Supabase y PostgreSQL 17.

**Especificación:** `docs/UPCO_Admin_Especificacion_MVP_v1_0.md` (RF-008, RF-011, RF-012, RNF-05).

## Restricciones

- Mantener el acceso denegado sin identidad Azure y membresía activa; no usar claves privilegiadas en la app.
- Permitir notas y cambios solo sobre actividades propias de la organización autorizada.
- Conservar datos e historial al archivar, restaurar, completar o reabrir.
- Usar solo datos sintéticos en las pruebas; una migración nueva debe ser reproducible.

## Tarea 1: Cierre, archivo y restauración

**Archivos:** `src/features/work-items/rules.ts`, `actions.ts`, `src/components/work-item-forms.tsx`, `src/app/(dashboard)/mi-trabajo/page.tsx`, `tests/work-items/rules.test.ts`, `tests/sql/authorization.sql`.

- [x] Añadir pruebas para identificador de archivo inválido, cierre y reapertura con fecha de cierre, archivo y restauración sin borrar ni conceder acceso a otro usuario.
- [x] Ejecutar las pruebas y observar el fallo esperado.
- [x] Implementar acciones de archivar/restaurar acotadas por usuario y organización, y mostrar registros archivados con opción de restauración. Mostrar la fecha de cierre de registros completados.
- [x] Ejecutar pruebas de reglas y SQL; confirmar que el historial registra los cambios.

## Tarea 2: Notas e historial

**Archivos:** `supabase/migrations/20261028000003_work_item_notes.sql`, `tests/sql/authorization.sql`, `src/features/work-items/rules.ts`, `actions.ts`, `src/components/work-item-forms.tsx`, `src/app/(dashboard)/mi-trabajo/page.tsx`, `tests/work-items/rules.test.ts`.

- [x] Añadir pruebas para nota vacía o excesiva, inserción de nota propia y rechazo de eventos falsificados o notas ajenas.
- [x] Ejecutar las pruebas y observar el fallo esperado.
- [x] Ampliar `activity_log` con acción `note`, validar el texto en PostgreSQL y permitir solo INSERT de notas propias por RLS. Agregar acción de servidor y formulario de nota; mostrar notas y cambios ordenados por fecha.
- [x] Ejecutar pruebas de reglas y SQL; comprobar que actualizar o borrar notas no está permitido al usuario autenticado.

## Tarea 3: Verificación y entrega

**Archivos:** `README.md`, `docs/PROGRESO.md`, `docs/DECISIONES.md`.

- [x] Ejecutar `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` y `bash scripts/test-sql.sh`.
- [x] Aplicar la migración nueva al Supabase de desarrollo si hay acceso administrativo; verificar esquema, RLS y rollback sintético. Si falta acceso, conservar la migración lista y registrar el bloqueo preciso.
- [ ] Comprobar el despliegue de staging cuando esté disponible, actualizar progreso y publicar los cambios en `main`.

La revisión previa a publicación añadió paginación de listas e historial por ficha, autor identificable, zona horaria del perfil y rechazo de ediciones iniciadas antes de archivar. La suite SQL se amplió para notas sobre registros archivados y acceso de otro miembro de la organización. La ejecución final local y remota pasó; queda la comprobación del despliegue y del flujo autenticado en navegador.

## Riesgos a revisar

- Un cambio de estado simultáneo no debe afectar otra actividad ni alterar un registro archivado por accidente.
- Un usuario autenticado no debe poder falsificar eventos `created` o `updated` ni editar notas previas.
- El archivo debe ocultar solo de la vista activa; restaurar debe conservar la ficha y el historial.
- Una lista de historial vacía o una consulta fallida deben mostrarse sin revelar datos ajenos.
