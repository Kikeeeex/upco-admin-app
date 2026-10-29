# BL-14 Commitments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar seguimientos vinculados a ADM y mostrarlos en Administración, Seguimientos e Inicio.

**Architecture:** Tabla `follow_ups` con RLS y auditoría; acciones servidoras con validación Zod; consultas de lectura bajo el cliente autorizado existente. `work_items.due_date` conserva la fecha de compromiso principal.

**Tech Stack:** PostgreSQL/Supabase, Next.js 16, React 19, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-29-compromisos-administrativos-design.md`

## Global Constraints

- Un seguimiento solo puede vincularse a un ADM activo; solo su creador puede editarlo.
- Los resultados y reprogramaciones deben quedar auditados; sin DELETE común.
- Fechas de día local, sin conversión UTC.

## Review Focus

- Organización ajena: RLS no revela ni acepta seguimientos de otra organización.
- Gestión archivada: no admite nuevas acciones.
- Reprogramación: conserva `work_items.due_date`.
- Resultado vacío: no puede marcarse como realizado.
- La agenda excluye seguimientos realizados y gestiones archivadas.

---

### Task 1: Persistencia y RLS

**Files:** `supabase/migrations/20261029000002_follow_ups.sql`, `tests/sql/administration.sql`

**Interfaces:** Produce `follow_ups(id, work_item_id, scheduled_for, contact_name, reason, status, outcome, performed_at, created_by)`; `status` es `pending` o `done`.

- [x] Añadir pruebas SQL de creación ADM, rechazo de otro creador/organización y archivado, auditoría, resultado y reprogramación; ejecutar para ver falla.
- [x] Crear tabla, FK, índice de agenda, políticas y trigger de auditoría; ejecutar SQL local hasta pasar.
- [x] Confirmar que no hay acceso anónimo ni privilegios DELETE, y migrar desarrollo antes de publicar UI.

### Task 2: Escritura desde ficha ADM

**Files:** `src/features/administration/follow-ups.ts`, `src/features/administration/follow-up-actions.ts`, `src/components/admin-follow-up-forms.tsx`, `src/app/(dashboard)/administracion/[id]/page.tsx`, `tests/administration/follow-ups.test.ts`.

**Interfaces:** `parseFollowUpInput`, `parseFollowUpResult`, `parseFollowUpReschedule`; acciones `createAdminFollowUp`, `completeAdminFollowUp`, `rescheduleAdminFollowUp`.

- [x] Escribir pruebas de validación y acciones, ejecutar para ver falla.
- [x] Implementar reglas, acciones autorizadas, formularios y lista enlazada en ficha.
- [x] Ejecutar pruebas, typecheck y lint hasta pasar.

### Task 3: Agenda e Inicio

**Files:** `src/app/(dashboard)/seguimientos/page.tsx`, `src/app/(dashboard)/inicio/page.tsx`, `src/components/follow-up-list.tsx`, pruebas UI pertinentes.

**Interfaces:** Consulta `follow_ups` pendiente ordenada por `scheduled_for` con enlace a `/administracion/[id]`.

- [x] Escribir pruebas de agenda y panel, ejecutar para ver falla.
- [x] Implementar lista con estados vencido/hoy/próximo y bloque en Inicio.
- [x] Ejecutar Vitest, SQL local, typecheck, lint, build y comprobar staging sin sesión.
- [x] Documentar resultado, publicar y solicitar prueba autenticada al usuario.
