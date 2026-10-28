# Búsqueda y filtros de Mi trabajo — Plan de implementación

> **Ejecución:** continuar directamente en este checkout cloud con pruebas antes de cada cambio funcional. El usuario pidió continuar el desarrollo del MVP descrito en la especificación.

**Objetivo:** completar BL-11 / RF-009: búsqueda por código o título y filtros combinables de área, estado, sede, prioridad y vencimiento, tanto en la lista activa como en archivo.

**Arquitectura:** consultas paginadas en Supabase con RLS existente. Un campo generado `search_text` (`code` + `title`) evita construir un filtro PostgREST `or` con entrada del usuario; un índice trigram admite coincidencia parcial. La URL conserva filtros al paginar y permite compartir el resultado.

**Stack:** Next.js 16, React 19, TypeScript, Supabase/PostgreSQL 17.

**Especificación:** `docs/UPCO_Admin_Especificacion_MVP_v1_0.md`, RF-009, RNF-03, RNF-07, RN-13.

## Restricciones

- No ampliar acceso: todas las consultas conservan RLS y `organization_id`.
- Limitar longitud de búsqueda y páginas; tratar comodines SQL como texto literal.
- Calcular «hoy» según zona horaria del perfil; fechas sin hora se comparan por día local.
- Mantener páginas independientes para activos y archivo, preservando todos los filtros.

## Tarea 1: Contrato de filtros y búsqueda

**Archivos:** `src/features/work-items/filters.ts`, `tests/work-items/filters.test.ts`.

- [x] Probar primero entradas válidas, parámetros repetidos o inválidos, comodines `%`/`_` y cálculo de fecha local.
- [x] Implementar `parseWorkItemFilters`, `escapeLikePattern`, `localDateInTimezone` y serialización de URL.
- [x] Ejecutar prueba dirigida y observar que pasa.

## Tarea 2: Campo indexado y protección SQL

**Archivos:** `supabase/migrations/20261028000004_work_item_search.sql`, `tests/sql/authorization.sql`.

- [x] Probar búsqueda parcial por código/título y aislamiento entre organizaciones.
- [x] Añadir columna generada `search_text` e índice trigram; mantener RLS y privilegios de solo lectura.
- [x] Ejecutar suite SQL local y aplicar/registrar migración en Supabase de desarrollo; ejecutar suite remota con rollback.

## Tarea 3: Filtros en la página

**Archivos:** `src/app/(dashboard)/mi-trabajo/page.tsx`, `src/app/globals.css`, `docs/PROGRESO.md`, `README.md`.

- [x] Aplicar búsqueda y filtros a ambas consultas paginadas; cargar sedes accesibles para el selector.
- [x] Renderizar formulario GET y conservar parámetros al cambiar de página; añadir estado vacío claro.
- [ ] Ejecutar tests, typecheck, lint, build y smoke de staging.
- [ ] Revisar y publicar en `main`; solicitar comprobación autenticada de combinación de filtros.

## Revisión enfocada

- Una búsqueda con `%`, `_`, comillas o paréntesis no amplía resultados ni altera el filtro de organización.
- Parámetros repetidos o excesivos no generan consultas enormes ni rompen la página.
- Cambiar cualquier filtro vuelve a la primera página.
- Una sede ajena no produce datos, aunque se escriba su ID en la URL.
- La zona del perfil determina el límite entre «vencidas», «hoy» y «futuras».
