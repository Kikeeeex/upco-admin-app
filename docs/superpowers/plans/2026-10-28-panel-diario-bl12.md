# BL-12: panel diario — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Mostrar en Inicio contadores y las primeras actividades de hoy, vencidas y en espera, con acceso a sus listas completas.

**Architecture:** Tres consultas Supabase bajo la sesión y RLS actuales aplican organización, archivo y estado antes de contar y paginar. El día se calcula en la zona horaria del perfil. La página muestra errores por bloque y enlaza a los filtros equivalentes de Mi trabajo.

**Tech Stack:** Next.js 16, Supabase, Vitest.

**Spec:** `docs/UPCO_Admin_Especificacion_MVP_v1_0.md` RF-010, BL-12.

## Global Constraints

- Mostrar solo actividades activas de la organización autorizada.
- Hoy y vencidas excluyen completadas y canceladas.
- No presentar próximos seguimientos hasta existir BL-23/BL-24.

## Review Focus

- Los registros archivados no deben contarse.
- Los registros completados no deben figurar como vencidos u hoy.
- La fecha debe evaluarse en la zona horaria del perfil.
- Error de consulta debe mostrarse como error, no como cero.
- Cada enlace debe abrir un filtro equivalente al bloque.

---

### Task 1: Reglas de los bloques

**Files:** `src/features/work-items/daily.ts`, `tests/work-items/daily.test.ts`.

**Interfaces:** `dailyBuckets(today: string)` devuelve configuración de filtros (`dueDate` o `status`) y enlace para hoy, vencidas, en espera.

- [ ] Añadir tests RED de la fecha, estados y enlaces de los tres bloques.
- [ ] Ejecutar pruebas específicas y confirmar fallo esperado.
- [ ] Implementar configuración mínima de los bloques.
- [ ] Ejecutar pruebas específicas y confirmar verde.

### Task 2: Página Inicio

**Files:** `src/app/(dashboard)/inicio/page.tsx`, `src/app/brand.css`, `tests/ui/daily-panel.test.tsx`.

**Interfaces:** `DailyPanel` presenta bloques con `count`, `items` y `error`; cada elemento vincula a `/mi-trabajo/[id]`.

- [ ] Añadir tests RED para cifras, listas y error sin cifra engañosa.
- [ ] Ejecutar pruebas específicas y confirmar fallo esperado.
- [ ] Conectar tres consultas `count: exact`, límite cinco, y presentar bloques.
- [ ] Ejecutar pruebas específicas y confirmar verde.

### Task 3: Verificación

**Files:** `docs/PROGRESO.md`.

- [ ] Ejecutar pruebas, TypeScript, ESLint, build y SQL local.
- [ ] Registrar el resultado y la limitación de seguimiento futuro.
