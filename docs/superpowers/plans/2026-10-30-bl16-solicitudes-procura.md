# BL-16 Solicitudes de procura Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear solicitudes PRC con artículo o servicio, cantidad, unidad, sede, necesidad, referencia y proveedor opcional.

**Architecture:** `work_items` aporta código, sede, estado e historial; `procurement_details` aporta los campos específicos. Una función SQL invocadora crea ambas filas en una transacción. La relación opcional a proveedor permite eliminación definitiva y retiene el nombre histórico.

**Tech Stack:** PostgreSQL/RLS, Supabase, Next.js 16, React 19, Zod, Vitest.

**Spec:** `docs/UPCO_Admin_Especificacion_MVP_v1_0.md` RF-020, RF-021, BL-16.

## Global Constraints

- Solo usuarios con membresía activa ven y crean solicitudes de su organización.
- Una solicitud PRC nueva siempre tiene detalle; código generado por la base de datos.
- Los proveedores archivados o de otra organización no se pueden seleccionar.
- Cotizaciones, etapas comerciales y seguimientos corresponden a BL-17 y BL-18.

## Review Focus

- Cantidad vacía, cero, negativa o inválida: rechazar antes de escribir y en SQL.
- Sede de otra organización: rechazar sin dejar fila parcial.
- Proveedor archivado o de otra organización: rechazar sin dejar fila parcial.
- Eliminación posterior del proveedor: conservar el nombre de la solicitud.
- Acceso anónimo y usuario sin membresía: no pueden leer ni escribir detalles.

---

### Task 1: Persistencia y autorización

**Files:** `supabase/migrations/20261030000001_procurement_requests.sql`, `tests/sql/procurement_requests.sql`, `scripts/test-sql.sh`.

- [x] Escribir pruebas SQL que crean PRC válida y rechazan las entradas del Review Focus.
- [x] Ejecutarlas y confirmar fallo por tabla/función ausente.
- [x] Crear tabla, RLS, privilegios, función atómica y obligación diferida de detalle.
- [x] Ejecutar suite SQL local; confirmar éxito.

### Task 2: Formulario y ficha

**Files:** `src/features/procurement/request-rules.ts`, `src/features/procurement/request-actions.ts`, `src/components/procurement-request-form.tsx`, `src/app/(dashboard)/procura/page.tsx`, `src/app/(dashboard)/procura/[id]/page.tsx`, `src/components/work-item-forms.tsx`, `src/features/work-items/actions.ts`, `tests/procurement/requests.test.ts`.

- [x] Escribir pruebas de validación, acción y presentación; confirmar fallos por funciones/vistas ausentes.
- [x] Implementar formulario, lista paginada y ficha PRC, y remitir las altas genéricas a Procura.
- [x] Ejecutar Vitest, typecheck, lint y build; confirmar éxito.

### Task 3: Staging y registro

**Files:** `docs/PROGRESO.md`.

- [x] Aplicar la migración al proyecto de desarrollo y registrar su versión.
- [x] Ejecutar prueba SQL remota con rollback y comprobar ausencia de filas sintéticas.
- [x] Publicar en `main`, comprobar rutas y registrar resultados y límite de prueba autenticada.
