# BL-15 Vendors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear y editar proveedores reutilizables desde Procura.

**Architecture:** `vendors` guarda datos de contacto por organización, con índice único de nombre normalizado, RLS de membresía y escritura del creador. Acciones Next.js validan formularios; la página Procura muestra alta y lista paginada.

**Tech Stack:** PostgreSQL/Supabase, Next.js 16, React 19, TypeScript, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-29-proveedores-procura-design.md`

## Global Constraints

- Nombre obligatorio; contacto, correo, teléfono y notas opcionales.
- RLS por organización y creador; sin DELETE ordinario.
- Una organización no acepta nombres duplicados tras normalizar espacios y mayúsculas.

## Review Focus

- Intento de alta de proveedor en otra organización.
- Edición por otro miembro de la misma organización.
- Nombre duplicado por espacios o mayúsculas.
- Correo inválido y campos vacíos al editar.
- Paginación de más de 50 proveedores.

---

### Task 1: Persistencia

**Files:** `supabase/migrations/20261029000003_vendors.sql`, `supabase/migrations/20261029000004_vendor_validation.sql`, `tests/sql/vendors.sql`, `scripts/test-sql.sh`.

**Interfaces:** `vendors(id, organization_id, name, contact_name, email, phone, notes, created_by, created_at, updated_at)`.

- [x] Escribir pruebas SQL de RLS, duplicado, actualización, restricciones y permisos; observar falla.
- [x] Crear tabla, índices, trigger de fecha, políticas y privilegios; pasar SQL local.
- [x] Aplicar ambas migraciones al proyecto de pruebas y correr suite SQL remota con rollback.

### Task 2: Reglas y acciones

**Files:** `src/features/procurement/vendor-rules.ts`, `src/features/procurement/vendor-actions.ts`, `tests/procurement/vendors.test.ts`.

**Interfaces:** `parseVendorInput`, `parseVendorUpdate`, `createVendor`, `updateVendor`.

- [x] Escribir pruebas de validación, alta, edición, error duplicado y sesión; observar falla.
- [x] Implementar reglas y acciones con errores recuperables; pasar pruebas dirigidas.

### Task 3: Catálogo en Procura

**Files:** `src/components/vendor-forms.tsx`, `src/app/(dashboard)/procura/page.tsx`, `tests/ui/procurement.test.tsx`, `src/app/globals.css`.

**Interfaces:** página `/procura` consulta `vendors` por organización, ordenada y paginada en grupos de 50.

- [x] Escribir pruebas de render, formulario y paginación; observar falla.
- [x] Implementar lista y formularios responsive.
- [x] Correr Vitest, SQL local, typecheck, lint y build; revisar cambio completo.
- [ ] Publicar en staging, comprobar ruta privada sin sesión y solicitar prueba autenticada.
