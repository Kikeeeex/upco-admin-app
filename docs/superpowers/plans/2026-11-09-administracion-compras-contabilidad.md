# Plan de implementación: Administración V2

> **For implementers:** Implement task-by-task with existing app patterns. Fiscal and accounting rules/formats are approved by the user and Accounting as of 11/11/2026; do not keep them blocked for lack of validation. Operations still require authorization and data integrity controls.

**Goal:** Replace V1 Gestiones with the eight V2 submodules, preserve historical data, and integrate approved calculations and outputs while separately gating data imports, private storage and deployment.

**Architecture:** Extend the existing Next.js App Router and Supabase organization/RLS model. Remove the old Gestiones routes/actions and their home/global agenda surfaces without purging historical rows. Keep fiscal vendors separate from Procura vendors. Build in vertical slices, starting with the V2 navigation/summary.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase/PostgreSQL, existing CSS design system, Microsoft Entra authorization.

**Spec:** `docs/superpowers/specs/2026-11-09-administracion-compras-contabilidad-design.md`

## Global Constraints

- V1 Gestiones operations are removed from the product; existing rows are retained without an app route, listing, search, action, or global agenda surface.
- The V2 submodules are Resumen, Compras y documentos, Proveedores, Retenciones, Libros y cierres, Importaciones, Reportes y exportaciones, Configuración fiscal.
- Keep fiscal vendors separate from Procura `public.vendors`; link only after explicit resolution.
- Fiscal validation is closed. Tax calculations, issuance, certificate sequences and official outputs may be implemented against the approved handoff. Supplier imports, historical-document writes, real attachment storage and deployment remain gated on their own authorization/security prerequisites.
- Server actions and database permissions enforce blocked states; disabled UI alone is insufficient.
- Use only synthetic development data; keep supplier/tax records and signature/seal assets out of Git.
- Preserve the V1 visual identity, local fonts, Supabase/RLS and Microsoft Entra access.
- Do not add or run tests unless requested; use reviewable diffs and `git diff --check` for this task.

## Review Focus

- No V1 Gestiones route, create/edit action, detail page, Mi trabajo row, Inicio card, Seguimientos item or direct write path remains available.
- No blocked operation can be invoked by posting directly to a server action or route.
- Disabled actions state the missing validation in Spanish and expose no misleading “official” result.
- Fiscal vendor records cannot be confused with Procura vendors or linked implicitly.
- V2 summary and submodule pages do not load unrelated module data together.

---

## Work Breakdown

### Task 1: V2 Administration entry and removal of Gestiones V1

**Files:**
- Modify: `src/app/(dashboard)/administracion/page.tsx` — replace the current Gestiones list with the V2 summary.
- Delete: `src/app/(dashboard)/administracion/[id]/page.tsx` — remove the old Gestiones detail route.
- Create: `src/components/administration-subnav.tsx` — eight submodule links and active state.
- Delete: `src/components/admin-matter-forms.tsx` and `src/components/admin-follow-up-forms.tsx` — remove old create/edit/follow-up operations.
- Delete: `src/app/(dashboard)/seguimientos/page.tsx`, `src/components/follow-up-list.tsx`, and `src/features/administration/actions.ts`, `follow-up-actions.ts`, `follow-ups.ts`, `agenda.ts`, and `rules.ts` after removing imports.
- Modify: `src/app/(dashboard)/inicio/page.tsx` and `src/components/app-shell.tsx` — remove old admin follow-up surfaces and the now-orphaned Seguimientos navigation item (which currently only lists Gestiones follow-ups).
- Modify: `src/app/(dashboard)/mi-trabajo/page.tsx`, `src/app/(dashboard)/mi-trabajo/[id]/page.tsx`, `src/features/work-items/actions.ts`, `filters.ts`, and `rules.ts` so historical `administration` rows are not listed, opened, edited, archived or created through generic work-item flows.
- Add a Supabase migration that retains old rows for history but rejects new writes/updates to the deprecated Gestiones data model; preserve read access only for existing audit/administrative retention needs, not app pages.
- Leave Supabase historical rows and tables intact; do not add a purge migration.

**Deliverable:** `/administracion` is the new summary; all eight V2 areas have stable routes; Gestiones and its follow-up operations are absent from app navigation, routes, forms, server actions, Inicio, Seguimientos and generic work-item views. Historic data remains stored but is no longer exposed or changed through the application.

### Task 2: Fiscal supplier directory

**Files:**
- Create migration(s) under `supabase/migrations/` for fiscal vendor records, source provenance, review state and optional confirmed link to `public.vendors`.
- Create domain rules/actions under `src/features/administration/vendors/`.
- Create routes under `src/app/(dashboard)/administracion/proveedores/` for list and record detail.
- Create focused components under `src/components/administration/`.

**Deliverable:** separate searchable directory with manual record management and “por revisar” state. Bulk snapshot preview may be built, but confirmation stays disabled. The latest delivery reports 347 providers; reconcile it with the earlier 345-row snapshot and Procura. The earlier two no-RIF rows and one RIF match are properties of that older snapshot only and must not be assumed for the new delivery.

### Task 3: Purchases, documents and draft records

**Files:**
- Create migration(s) for purchase documents, lines/bases, draft status, period fields, accounting allocation proposals and audit events.
- Create domain validation/actions under `src/features/administration/documents/`.
- Create routes under `src/app/(dashboard)/administracion/compras/` for list and draft form/detail.
- Create form components under `src/components/administration/`.

**Deliverable:** save and edit drafts with explicit “cálculos fiscales no disponibles” state. No tax calculation, issue, annulment, certificate number allocation or immutable issued snapshot until rules are approved.

### Task 4: Fiscal settings as unpublished proposals

**Files:**
- Create migration(s) for versioned proposed settings and audit trail.
- Create domain actions under `src/features/administration/settings/`.
- Create route `src/app/(dashboard)/administracion/configuracion-fiscal/page.tsx`.

**Deliverable:** view and edit draft proposals for company data, UT, rates, ISLR concepts, accounts, CECO and sequences. Publishing/activating a configuration remains server-blocked.

### Task 5: Retentions, books, closing and reports

**Files:**
- Create routes under `administracion/retenciones`, `administracion/libros`, and `administracion/reportes`.
- Create read models under `src/features/administration/reports/`.
- Add server-side capability checks to any eventual download/action endpoints.

**Deliverable:** status, draft counts and reconciliation previews only. Certificate PDFs, TXT/XML/XLSX declarative exports and official closes stay blocked until formulas/templates/destinations are validated.

### Task 6: Importations and support files

**Files:**
- Create route `src/app/(dashboard)/administracion/importaciones/page.tsx`.
- Create the browser-only local preview parser in `src/components/administration/import-preview.tsx`; do not add a persistence action while confirmation is blocked.
- Reuse existing private-storage conventions only after the storage/retention decision is documented.

**Deliverable:** local JSON/CSV preview and XLSX preview against the supplied 27-column historical-document template, with structural row warnings. Confirmation/DB writes for supplier or historical-document batches and real file uploads remain blocked; no real uploaded file is copied to the repo.

### Task 7: Version and activation record

**Files:**
- Update `docs/DECISIONES.md`, `docs/PROGRESO.md`, and this plan as V2 slices are completed.

**Deliverable:** each later modification records the V2 change/version, completed slice, blocked capabilities and the validation decision required to enable them.

## Criterios de aceptación

- Los ocho submódulos tienen rutas propias y se cargan por separado.
- `/administracion` resume V2; no existe ruta operativa de Gestiones.
- Todas las funciones bloqueadas muestran motivo y la barrera también existe en servidor.
- Los proveedores fiscales viven en tablas separadas de Procura y no se importan sin resolver su enlace y recibir autorización de carga.
- Borradores nunca generan comprobantes, correlativos ni archivos oficiales.
- Configuración fiscal en estado propuesto no puede afectar documentos ni cálculos.
- Versiones futuras conservan el registro de cambios de Administración V2.

## Dependencias que no bloquean el desarrollo de la interfaz

- Validación del responsable fiscal para tasas, conceptos ISLR, UT/sustraendos, IGTF, reglas de notas y correlativos.
- Confirmación de formatos/destinos de los libros y declaraciones oficiales.
- Resolución de la relación del único RIF coincidente y del nombre repetido con RIF distintos.
- Autorización de carga del snapshot; la vigencia del registro ya fue confirmada.

## Corrección V2.1 (11/11/2026; estado antes de aprobación V2.2)

Use the integral handoff dated 10/11/2026 as the latest source reference. It changes the reported supplier count to 347, describes source IGTF calculation at 3% of an entered base added to net, flags a possible additional VAT rate, and lists 86 historical ISLR concepts. At this version, calculations/outputs were blocked pending validation. The prior 345-row RIF comparison does not carry forward to the 347-row delivery. The V2.2 decision below supersedes the fiscal-validation block.

## Aprobación V2.2 (11/11/2026)

The user confirmed fiscal validation is complete, the rules and formats in the handoff are correct, and Accounting approved them. Treat the branch formulas, periods, retention rules, IGTF, ISLR, certificate sequences and described output formats as approved implementation requirements. This does not authorize importing the supplier snapshot, copying private signature/seal assets, applying remote migrations or deploying.
- Definición de almacenamiento privado, retención y respaldo de soportes.

## Implementación aprobada V2.4 (11/11/2026)

La aprobación fiscal del usuario y Contabilidad cierra las dependencias fiscales listadas arriba. Se implementan recálculo y emisión desde servidor, snapshots inmutables y correlativos transaccionales mediante RPC PostgreSQL con acceso reservado a `service_role`; se agregan TXT IVA quincenal, XML ISLR mensual, libro XLSX de Compras/Distribución contable y cierre XLSX por rango con los bloqueos de representación descritos por la entrega. La migración permanece local y la clave service role solo se usa en servidor. Los formatos generados se entregan para revisión, sin afirmar aceptación del portal.

Quedan para siguientes versiones: PDFs con firma/sello desde almacenamiento privado autorizado, anulación con manejo de correlativos, importaciones de proveedores/documentos con sus autorizaciones, permisos por tarea y validación autenticada del ambiente. No aplicar migraciones remotas ni desplegar como parte de esta tarea.
