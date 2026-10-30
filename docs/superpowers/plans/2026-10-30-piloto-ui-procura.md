# Piloto UI de Procura Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Hacer más fácil recorrer el formulario y las secciones existentes de Procura sin cambiar datos ni permisos.

**Architecture:** Conservar la página de servidor, el formulario cliente y sus acciones. Añadir semántica HTML y estilos de marca; los enlaces internos solo apuntan a secciones actuales.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS existente, Vitest.

**Spec:** `docs/AUDITORIA_UI_2026-10-30.md`, basado en `docs/UPCO-Admin-instrucciones-integracion-UI.md`.

## Global Constraints

- No modificar MVP, contratos, rutas, permisos, arquitectura ni prioridades.
- No agregar dependencias, movimiento, datos ni funciones nuevas.
- Mantener las etiquetas, campos, nombres de FormData y estados actuales.
- Respetar marca, teclado y anchos de 390, 800 y 1440 px.

## Review Focus

- Dos artículos: los cuatro campos repetidos se conservan al agregar y quitar. Prueba UI del formulario.
- Navegación de página larga: cada enlace interno, incluido el alta de proveedor, tiene sección de destino. Prueba de render de Procura.
- Sede y proveedor: siguen en un mismo formulario con nombres de campo intactos. Prueba UI del formulario.
- Error y vacío: permanecen fuera de las secciones y visibles. Suite existente de UI.
- Móvil: la cuadrícula se vuelve de una columna sin desbordamiento. Revisión de CSS y viewport.

### Task 1: Agrupar la solicitud y orientar al usuario

**Files:** `tests/ui/procurement-line-form.test.tsx`, `src/components/procurement-request-form.tsx`, `src/app/brand.css`.

**Interfaces:** `CreateProcurementRequestForm({sites,vendors})` y sus `name` de campos permanecen idénticos.

- [x] Añadir prueba de secciones accesibles, contador de artículos y nombres de campos.
- [x] Ejecutar prueba dirigida y comprobar que falla por ausencia de grupos.
- [x] Implementar `fieldset`/`legend` para artículos, destino/proveedor y solicitante/necesidad; contador visible y estilos responsivos.
- [x] Ejecutar la prueba dirigida y comprobar que pasa.

### Task 2: Navegar las secciones existentes de Procura

**Files:** `tests/ui/procurement-requests.test.tsx`, `src/app/(dashboard)/procura/page.tsx`, `src/app/brand.css`.

**Interfaces:** enlaces fragmento a cinco secciones actuales; sin cambio de URL de datos o consultas.

- [x] Añadir prueba que exige enlaces y destinos en la página.
- [x] Ejecutar prueba dirigida y comprobar que falla por anclas ausentes.
- [x] Añadir navegación interna y `id` a las secciones existentes; estilizar en escritorio y móvil.
- [x] Ejecutar prueba dirigida y comprobar que pasa.

### Task 3: Cierre del incremento

**Files:** `docs/AUDITORIA_UI_2026-10-30.md`, `docs/PROGRESO.md`.

- [x] Ejecutar Vitest, typecheck, ESLint, build y SQL si el entorno lo permite.
- [x] Revisar visualmente escritorio/móvil, foco y reducción de movimiento.
- [x] Registrar resultados, diferencias y propuestas pendientes en la auditoría.
- [x] Revisar diff, registrar commit y publicar staging según el flujo vigente.
