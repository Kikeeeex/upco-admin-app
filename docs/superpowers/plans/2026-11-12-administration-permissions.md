# Administration Permissions Implementation Plan

> **For agentic workers:** implement this plan natively, task by task. Do not run automated tests; use the static and deployment verification commands listed below.

**Goal:** Add explicit per-member Administration permissions enforced in UI, server actions, routes, RPCs, and Supabase RLS.

**Architecture:** Keep the existing `admin/member` membership roles. Admin has all capabilities implicitly; members receive explicit organization-scoped grants from a fixed allowlist. PostgreSQL helper functions and row policies remain the security boundary, and server/UI checks make the behavior understandable.

**Tech Stack:** Next.js App Router, TypeScript, Supabase Auth/PostgreSQL/RLS, SQL migrations.

**Spec:** `docs/superpowers/specs/2026-11-12-administracion-permisos-design.md`

## Global Constraints

- Use Spanish UI copy and organization-scoped data.
- Admin access remains backward-compatible and complete.
- Member permissions default to none and cannot be changed by a member.
- Do not expose `service_role` to client code.
- Do not change non-Administration authorization.
- Do not activate fiscal settings or create fiscal values.
- Do not run automated tests.

## Review Focus

- An inactive or foreign-organization membership cannot use a previously granted permission; enforce in the database helper and test query verification.
- A member cannot grant permissions to themself; restrict RPC and table policy to active admins and verify privilege grants.
- `manage` does not imply `issue`, `void`, `import`, or `activate`; keep keys separate and inspect each RPC guard.
- A read-only permission cannot mutate rows via direct REST; retain action-specific RLS and inspect resulting policies.
- Admin keeps current behavior without grant rows; verify existing paths and SQL admin bypass.

---

## File Map

- `supabase/migrations/<version>_administration_permissions.sql`: grants, audit table, helper, assignment RPC, RLS, memberships/profile reads, policy updates, privileged RPC authorization.
- `src/features/administration/permissions/catalog.ts`: shared capability identifiers, labels, and mapping to routes.
- `src/features/administration/permissions/access.ts`: server capability predicate and page guard.
- `src/features/auth/access.ts`: loads the active member's explicit grants.
- `src/features/administration/permissions/actions.ts`: admin-only list/update grants action.
- `src/app/(dashboard)/administracion/permisos/page.tsx`: admin-only member permission assignment page.
- `src/components/administration/permissions-form.tsx`: grant matrix UI.
- `src/components/administration-subnav.tsx`: capability-based navigation.
- `src/app/(dashboard)/administracion/**`, `src/features/administration/**`, and `src/app/api/administracion/**`: add guards for their precise operations.
- `docs/UPCO_Admin_Especificacion_MVP_v2_8.md`, `docs/DECISIONES.md`, `docs/PROGRESO.md`, `README.md`: record version and verification.

## Tasks

### Task 1: Database permission primitives

1. Create an organization-scoped grant table with allowlisted capability keys, uniqueness by organization/user/key, and a grant-event audit table.
2. Add a safe helper that allows all capabilities only to an active `admin`, checks exact grants for an active `member`, and rejects every other identity.
3. Add a transaction RPC for an active admin to replace a target active member's entire grant set and record added/removed keys.
4. Replace fiscal RLS policies with operation-specific checks. Keep document state/owner constraints and provider/settings semantics.
5. Update issue/void/import/activate RPCs to check `purchases.issue`, `purchases.void`, `imports.import`, and `fiscal_settings.activate` respectively.
6. Grant only the required function execution and table privileges. Review policies with read-only Supabase queries.

### Task 2: Server access context and capability catalog

1. Define the fixed capability union and route map in `catalog.ts`; omit issue, void, activation, and historical import execution from member grants.
2. Load only the authenticated member's grants in `getAccessContext`; admins return an empty stored set because they bypass the catalog.
3. Implement `hasAdministrationPermission` and route-level guard helpers. Typecheck the access context and helper.

### Task 3: Permission administration UI

1. Add server actions to list active members and call the replace-grants RPC; reject non-admin callers before DB calls.
2. Add the `/administracion/permisos` page and checkbox matrix for all allowlisted capabilities.
3. Add admin-only navigation to that page and verify the admin page does not leak to members.

### Task 4: Enforce capabilities throughout Administration

1. Guard each page using its read/manage capability and render only controls allowed by separate write/issue/void capabilities.
2. Guard every server action, import validator, PDF endpoint, and export endpoint with its exact capability. Keep issue, void, activation, historical import execution, and PDF access administrator-only.
3. Filter subnavigation using the same fixed route map; admins retain all entries and members only see granted areas.
4. Confirm direct route/action/RPC requests remain denied by RLS or database checks even when UI is bypassed.

### Task 5: Version and verify

1. Add the V2.8 specification section, decision, progress row, and README link.
2. Run `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.
3. Apply the reviewed migration to Supabase, inspect security advisors for new findings, and verify grants/RPC privilege boundaries without changing fiscal data.
4. Commit, push to `main`, and verify the Vercel production deployment plus protected route behavior.
