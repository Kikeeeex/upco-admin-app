# BL-08: descripción y sede — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Completar creación, edición y consulta de actividades con descripción opcional y sede de la organización.

**Architecture:** Los formularios reciben el catálogo de sedes ya consultado bajo RLS. Zod valida los campos en el servidor; la FK compuesta `(organization_id, site_id)` impide referencias entre organizaciones. Las consultas de lista y ficha muestran la sede asignada.

**Tech Stack:** Next.js 16, React 19, Supabase, Zod 4, Vitest.

**Spec:** `docs/UPCO_Admin_Especificacion_MVP_v1_0.md` RF-006, RF-007, BL-08.

## Global Constraints

- Descripción y sede son opcionales; título obligatorio.
- No crear sedes ficticias ni alterar el catálogo corporativo.
- Mantener autorización por organización, creador y RLS.

## Review Focus

- Descripción vacía debe guardarse como NULL al crear o limpiar.
- Sede vacía debe guardarse como NULL al crear o limpiar.
- UUID de sede malformado debe rechazarse antes de consultar o escribir.
- Sede ajena a la organización debe rechazarse por la FK compuesta.
- Actividad archivada no debe admitir edición desde un formulario antiguo.

---

### Task 1: Validación y persistencia

**Files:** `src/features/work-items/rules.ts`, `src/features/work-items/actions.ts`, `tests/work-items/rules.test.ts`, `tests/work-items/actions.test.ts`.

**Interfaces:** `parseWorkItemInput` y `parseWorkItemUpdate` aceptan `description?: string`, `siteId?: string`; las acciones escriben `description` y `site_id` o NULL.

- [ ] Añadir pruebas RED para descripción recortada, descripción demasiado larga, sede UUID, campos vacíos y persistencia en INSERT/UPDATE.
- [ ] Ejecutar pruebas específicas; confirmar fallos esperados.
- [ ] Implementar validación de máximo 5000 caracteres y escrituras nulas explícitas.
- [ ] Ejecutar pruebas específicas; confirmar verde.

### Task 2: Formularios y presentación

**Files:** `src/components/work-item-forms.tsx`, `src/app/(dashboard)/mi-trabajo/page.tsx`, `src/app/(dashboard)/mi-trabajo/[id]/page.tsx`, `src/app/brand.css`, `tests/ui/work-item-forms.test.tsx`.

**Interfaces:** `CreateWorkItemForm` y `EditWorkItemForm` reciben `sites: {id:string;code:string;name:string}[]`; `ListedWorkItem` incluye `description` y `site_id`.

- [ ] Añadir pruebas RED para campos, valores editados y opciones de sedes.
- [ ] Ejecutar pruebas específicas; confirmar fallos esperados.
- [ ] Conectar catálogo y mostrar sede en lista/ficha, con aviso si el catálogo está vacío.
- [ ] Ejecutar pruebas específicas; confirmar verde.

### Task 3: Verificación y documentación

**Files:** `docs/PROGRESO.md`, `README.md` si es necesario.

- [ ] Ejecutar `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` y suite SQL local.
- [ ] Comprobar la vista responsive y registrar lo verificado; marcar BL-08 como parcial hasta prueba autenticada en staging.
- [ ] Revisar diff y publicar la rama una vez verde.
