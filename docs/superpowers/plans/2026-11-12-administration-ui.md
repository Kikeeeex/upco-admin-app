# Administration Reference UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rework UPCO Admin’s Administration navigation and screens to follow the supplied UPCO Compras visual reference, with Administration first and its submodules nested in the shared sidebar.

**Architecture:** Keep the existing route and server-action architecture. Feed the authenticated role and permission list into the shared shell, render Administration as an expandable parent with permission-filtered children, and remove the duplicate horizontal Administration navigation. Use Administration-scoped CSS to adapt its existing server-rendered pages and shared shell to the reference without changing other areas’ page content or behavior.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, lucide-react, existing CSS in `src/app/brand.css`.

**Spec:** `docs/superpowers/specs/2026-11-12-administration-ui-design.md`

## Global Constraints

- Keep all existing Administration URLs, data access, server actions, fiscal calculations, imports/exports, and V2.8 enforcement unchanged.
- Keep Administración first in the global sidebar; keep Procura and all other areas available.
- Filter child links by V2.8 grants; only admins see Permisos; page/server/RLS guards remain authoritative.
- Preserve the existing UPCO logo assets, desktop collapse preference, mobile Sheet navigation, keyboard access, and reduced-motion support.
- Scope content styling to Administration; shared sidebar styling can affect other areas, but their page content and behavior stay unchanged.
- Do not add or run automated tests. Verify with `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`, and visual review at desktop/mobile widths.

## Review Focus

- Member with no Administration grants: no child destinations appear, and server guards still deny direct route access.
- Member with a single task grant: only authorized child pages appear, while direct denied pages remain denied.
- Administrator: sees all children including Permisos; its active route is not confused with Resumen.
- Collapsed desktop sidebar and mobile Sheet: labels, expansion, route navigation, and active state remain usable.
- A non-Administration route: shared shell continues to show and navigate other app areas without Administration page styles leaking into its content.

---

### Task 1: Nest Administration in the shared sidebar

**Files:**
- Modify: `src/features/administration/permissions/catalog.ts`
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `src/components/app-shell.tsx`
- Create: `src/components/administration-navigation.tsx`
- Modify: `src/app/(dashboard)/administracion/layout.tsx`
- Delete or retire: `src/components/administration-subnav.tsx`

**Interfaces:**
- `DashboardLayout` passes authenticated `permissions: string[]` and `isAdmin: boolean` to `AppShell`.
- `AdministrationNavigation` consumes `{ pathname: string; permissions: string[]; isAdmin: boolean; mobile?: boolean; collapsed?: boolean }` and renders the parent plus visible child links.
- Navigation entries remain sourced from `ADMINISTRATION_NAVIGATION`; each entry carries `href`, `label`, permissions, optional exact matching, and an admin-only flag for Permisos.

- [x] Add Permisos to the navigation catalog as admin-only and retain the existing route labels/URLs.
- [x] Pass the access role and grants from the authorized dashboard layout to the shared shell.
- [x] Place Administración before the current Trabajo, Áreas, and Herramientas groups; make its parent link go to `/administracion` and add a separate accessible expand/collapse button.
- [x] Render permission-filtered links in the required order, automatically expand on Administration routes, support collapsed desktop labels/tooltips, and close the mobile Sheet after navigation.
- [x] Remove the horizontal subnavigation from the Administration layout and wrap its page content in an Administration scope class.
- [x] Inspect the member/admin filtering and direct-route guards in the changed navigation paths; keep route checks unchanged.

### Task 2: Apply the reference visual system to Administration

**Files:**
- Modify: `src/app/brand.css`
- Modify: `src/components/app-shell.tsx`
- Modify: `src/app/(dashboard)/administracion/page.tsx`
- Modify: `src/app/(dashboard)/administracion/compras/page.tsx`
- Modify: `src/app/(dashboard)/administracion/compras/[id]/page.tsx`
- Modify: `src/app/(dashboard)/administracion/proveedores/page.tsx`
- Modify: `src/app/(dashboard)/administracion/proveedores/[id]/page.tsx`
- Modify: `src/app/(dashboard)/administracion/retenciones/page.tsx`
- Modify: `src/app/(dashboard)/administracion/libros/page.tsx`
- Modify: `src/app/(dashboard)/administracion/importaciones/page.tsx`
- Modify: `src/app/(dashboard)/administracion/reportes/page.tsx`
- Modify: `src/app/(dashboard)/administracion/configuracion-fiscal/page.tsx`
- Modify: `src/app/(dashboard)/administracion/permisos/page.tsx`
- Modify: `src/app/(dashboard)/administracion/sin-permiso/page.tsx`

**Interfaces:**
- Pages render inside the Administration scope introduced in Task 1.
- Existing components and actions keep their props and signatures; CSS/classes change only presentation unless a wrapper is needed to arrange existing content.

- [x] Match the reference shell proportions, forest-green sidebar, white topbar, light canvas, green/lime accents, Satoshi typography, active state, and responsive spacing while retaining UPCO Admin’s existing logo files.
- [x] Style Administration page headings, period/status filters, summary indicators, white panels, form groupings, buttons, notices, tables, and empty states to match the reference’s hierarchy.
- [x] Arrange the summary around its period and operational indicators, recent documents, and submodule access; keep permission-dependent information filtered as it is now.
- [x] Arrange document and vendor pages around their existing primary actions, filters and tables; preserve the current available filters and server actions.
- [x] Add the reference's read-only month, half-month, and document-status filters to Compras; keep them as URL query parameters and preserve all write actions and route access checks.
- [x] Present Retenciones, Libros, Importaciones, Reportes, Configuración fiscal, Permisos, and denial pages with consistent panels and clear section headers without changing operations or claims.
- [x] Ensure CSS selectors for Administration content are scoped to its wrapper; ensure mobile table overflow is contained and forms/cards stack cleanly.

### Task 3: Verify navigation and responsive screens

**Files:**
- Modify: `docs/PROGRESO.md`
- Modify: `README.md` only if it documents a superseded Administration navigation behavior.

**Interfaces:**
- No database, route, or server-action interface changes.

- [x] Run `npm run typecheck`; resolve any type errors.
- [x] Run `npm run lint`; resolve any lint errors.
- [x] Run `npm run build`; resolve any production build errors.
- [x] Run `git diff --check`.
- [x] Review the Administration summary, Compras, Proveedores, Reportes, Configuración fiscal, and Permisos at 1440px and a mobile viewport; confirm the sidebar states and active route.
- [x] Review one non-Administration route for style leakage and confirm Procura and the other areas remain reachable.
- [x] Update `docs/PROGRESO.md` with the implementation, validation results, commit, and deployment status after completion.
