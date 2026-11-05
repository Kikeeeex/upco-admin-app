# Importación de proveedores Excel/CSV Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adaptar el catálogo a los diez campos del directorio UPCO e importar XLSX/CSV con vista previa, deduplicación y escritura confirmada.

**Architecture:** Una migración amplía `vendors` sin cambiar sus ID; reglas TypeScript validan campos y archivos; acciones de servidor autorizan inspección, vista previa y confirmación; una función SQL invocadora guarda cada lote de forma atómica. Las pantallas existentes de Procura reutilizan el mismo catálogo.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zod 4, Supabase/PostgreSQL, Vitest, ExcelJS, csv-parse.

**Spec:** `docs/superpowers/specs/2026-11-05-proveedores-importacion-design.md`.

## Global Constraints

- No incluir el Excel corporativo ni datos de contacto reales en el repositorio, fixtures o logs.
- Mantener ID, organización, RLS, creador, archivo y referencias a solicitudes.
- Conservar `associated_area` y `notes` como legado interno, pero solo «Proveedor» es obligatorio entre los diez campos comerciales.
- No publicar el código que consulta columnas nuevas antes de aplicar la migración remota.

## Review Focus

- Dos proveedores con nombre igual en países distintos pueden existir; fiscal+país repetido se rechaza.
- Un archivo sin país o con coincidencia ambigua no fusiona registros automáticamente.
- La columna M y fórmulas no pasan a campos por accidente.
- Una segunda carga omite duplicados; fallo de una fila no deja un lote parcialmente marcado como exitoso.
- Una cuenta no habilitada no puede inspeccionar, confirmar ni leer lotes.

### Task 1: Modelo y migración

**Files:** `supabase/migrations/20261105000000_vendor_directory.sql`, `tests/sql/vendor_directory.sql`, `scripts/test-sql.sh`, `src/features/procurement/vendor-rules.ts`, `tests/procurement/vendors.test.ts`.

- [x] Escribir pruebas fallidas para diez campos, solo nombre obligatorio y preservación de datos legados/relaciones.
- [x] Implementar migración, permisos y reglas de validación; conservar disparadores de archivo.
- [x] Ejecutar pruebas dirigidas y SQL local.

### Task 2: Directorio y ficha

**Files:** `src/components/vendor-forms.tsx`, `src/features/procurement/vendor-actions.ts`, `src/app/(dashboard)/procura/page.tsx`, `src/app/(dashboard)/procura/proveedores/[id]/page.tsx`, estilos y pruebas UI.

- [x] Escribir pruebas fallidas de alta/edición/lista/ficha/búsqueda/filtros.
- [x] Implementar los diez campos y consultas paginadas sin tocar el selector de solicitudes.
- [x] Ejecutar pruebas dirigidas.

### Task 3: Parser y vista previa

**Files:** `src/features/procurement/vendor-import-parser.ts`, `vendor-import-rules.ts`, tests sintéticos, `next.config.ts`.

- [x] Escribir pruebas fallidas para XLSX/CSV, BOM, delimitadores, mapeo, columna M, límites, fórmulas, validación y duplicados.
- [x] Instalar únicamente las dependencias de lectura necesarias e implementar parser y análisis.
- [x] Ejecutar pruebas dirigidas y comprobar lectura local del Excel real sin publicar datos.

### Task 4: Confirmación atómica y asistente

**Files:** migración SQL, `src/features/procurement/vendor-import-actions.ts`, `src/components/vendor-import-wizard.tsx`, `src/app/(dashboard)/procura/importar/page.tsx`, pruebas de acciones/UI/SQL.

- [x] Escribir pruebas fallidas de autorización, omisión, actualización seleccionada, confirmación y conteos.
- [x] Implementar función SQL de lote atómico, acciones y asistente Archivo → Mapeo → Vista previa → Resultado.
- [x] Ejecutar pruebas dirigidas y SQL local.

### Task 5: Cierre y publicación

**Files:** `docs/PROGRESO.md`, `docs/DECISIONES.md`, guía de uso y este plan.

- [x] Ejecutar Vitest, typecheck, lint, build y SQL local.
- [ ] Revisar cambios, documentar reversión y verificar permisos.
- [ ] Si el token de Supabase está renovado, aplicar migración y SQL remoto antes de publicar `main`; comprobar staging.
- [ ] Registrar comprobaciones pendientes de navegador y resultado real de cada paso.
