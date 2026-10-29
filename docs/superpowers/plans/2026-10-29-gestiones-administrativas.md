# Gestiones administrativas BL-13 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear y consultar gestiones administrativas con código ADM y estado documental.

**Architecture:** `work_items` conserva los campos comunes; `admin_details` guarda los propios de Administración. Una función SQL crea ambas filas de forma atómica bajo RLS. Acciones de servidor validan entradas y páginas privadas muestran lista y ficha.

**Tech Stack:** Next.js 16 App Router, React 19, Zod 4, Supabase/PostgreSQL 17, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-29-gestiones-administrativas-design.md` y `docs/UPCO_Admin_Especificacion_MVP_v1_0.md` RF-016/017.

## Global Constraints

- Sesión, tenant, membresía y RLS son obligatorios para leer y escribir.
- Datos de prueba sintéticos; sin documentos corporativos reales ni archivos adjuntos.
- El nuevo esquema se publica antes que el código que lo utiliza.

## Review Focus

- Organización ajena: RLS y la función deben denegar inserciones y modificaciones.
- Ficha ajena o de otro tipo: no revelar datos de detalle.
- Documento ausente: permitir crear con estado pendiente.
- URL inválida: rechazar `javascript:` y enlaces mal formados.
- Error en detalle: la función debe revertir la creación completa.

---

### Task 1: Modelo y permisos

**Files:** `supabase/migrations/20261029000000_admin_details.sql`, `tests/sql/administration.sql`, `scripts/test-sql.sh`.

**Interfaces:** Produce `admin_details(work_item_id, procedure_type, counterpart_name, reference, document_status, document_reference, document_url)` y RPC `create_admin_matter(...) RETURNS uuid`.

- [x] Escribir pruebas SQL para código ADM, relación 1:1, documento pendiente, creación atómica, RLS entre organizaciones y permisos de columna.
- [x] Ejecutar la suite y observar fallo por ausencia del modelo.
- [x] Crear tabla, políticas, privilegios mínimos, auditoría de actualización y función invocadora de creación.
- [x] Ejecutar SQL local y comprobar que pasa.
- [x] Añadir `20261029000001_enforce_admin_details.sql` tras revisión: trigger diferido y prueba de inserción directa sin ficha.

### Task 2: Validación y acciones

**Files:** `src/features/administration/rules.ts`, `src/features/administration/actions.ts`, `tests/administration/rules.test.ts`, `tests/administration/actions.test.ts`.

**Interfaces:** `parseAdminMatterInput`, `parseAdminDetailsUpdate`; `createAdminMatter`, `updateAdminDetails`.

- [x] Escribir pruebas de campos obligatorios, estado documental, URL HTTP(S), sesión y envío de datos válidos a RPC/tabla.
- [x] Ejecutarlas y observar fallo esperado.
- [x] Implementar validadores y acciones con autorización de servidor y revalidación.
- [x] Ejecutar pruebas de la tarea y comprobar que pasan.
- [x] Describir cambios de documentación en el historial, con prueba que falló primero.

### Task 3: Lista, ficha y formularios

**Files:** `src/app/(dashboard)/administracion/page.tsx`, `src/app/(dashboard)/administracion/[id]/page.tsx`, `src/components/admin-matter-forms.tsx`, `src/components/work-item-forms.tsx`, `src/features/work-items/actions.ts`, `tests/ui/administration.test.tsx`.

**Interfaces:** Lista de gestiones activas y ficha específica, enlazada con Mi trabajo para historial y archivo.

- [x] Escribir pruebas de render de lista y ficha, estado documental pendiente, enlace seguro y edición del creador.
- [x] Ejecutarlas y observar fallo por página pendiente.
- [x] Implementar formularios y páginas, reutilizando campos generales y acciones existentes.
- [x] Ejecutar pruebas de la tarea y comprobar que pasan.

### Task 4: Verificación y publicación

**Files:** `docs/PROGRESO.md`, `docs/DECISIONES.md`.

- [x] Ejecutar Vitest completo, TypeScript, ESLint, build y SQL local.
- [x] Aplicar migración remota al proyecto de desarrollo si el token autorizado funciona; verificar versión y RLS.
- [x] Publicar código en `main` (`de9d4b0`) después de ambas migraciones.
- [x] Comprobar staging anónimo: lista y ficha redirigen 307 a `/login`.
- [x] Comprobar desde una cuenta autenticada la creación ADM y la ficha con documentación pendiente.
- [ ] Comprobar desde una cuenta autenticada la edición documental y su evento de historial.
