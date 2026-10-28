# Inicio de UPCO Admin: plan de implementación

> **Para agentes:** ejecutar este plan en el checkout actual. El entorno cloud ya está aislado; no crear otro worktree. Marcar cada paso solo con evidencia.

**Objetivo:** establecer Sprint 0 y entregar un primer corte verificable de Sprint 1 con navegación, seguridad cerrada por defecto y registro de trabajo.

**Arquitectura:** Next.js App Router con módulos de dominio en `src/features`, acceso a Supabase desde servidor y PostgreSQL con RLS. Las rutas privadas dependen de identidad Entra, tenant permitido y pertenencia activa. Sin configuración corporativa, solo se sirve la pantalla de acceso y se prueban reglas puras y migraciones locales.

**Stack:** Node 24, npm, Next.js 16, React 19, TypeScript, Tailwind CSS, Supabase Auth/PostgreSQL, Vitest y ESLint.

**Especificación:** `docs/UPCO_Admin_Especificacion_MVP_v1_0.md`.

## Restricciones globales

- Sin datos reales, secretos en Git, despliegues ni cambios en recursos corporativos.
- No conceder acceso por correo, dominio o login Microsoft únicamente; exigir tenant, identidad estable y pertenencia activa.
- Un `work_item` usa UUID y código único; prioridad baja/media/alta/crítica; estado pendiente/en progreso/en espera/completada/cancelada.
- Fecha límite y fecha de seguimiento separadas; archivado lógico; eventos críticos en bitácora.
- Las cinco áreas deben aparecer en navegación, sin presentar pantallas pendientes como listas reales.

## Riesgos a revisar

- Usuario Microsoft autenticado sin pertenencia: acceso denegado a páginas y datos.
- Tenant incorrecto o identidad del proveedor incompleta: acceso denegado.
- Dos creaciones simultáneas: códigos distintos sin condición de carrera.
- Título vacío o demasiado largo: formulario y servidor rechazan sin escribir.
- Reapertura y cambio de fecha: historial íntegro; vencimiento no depende del seguimiento.

## Tareas

### 1. Base técnica y documentos — BL-01, BL-07

**Archivos:** `package.json`, `package-lock.json`, `src/app/*`, `src/components/*`, `README.md`, `docs/{ARQUITECTURA,DECISIONES,PLAN_IMPLEMENTACION,PROGRESO}.md`, `.env.example`, `.gitignore`.

- [x] Crear aplicación vacía Next.js y fijar dependencias con lockfile.
- [x] Documentar arquitectura, decisiones, recursos externos, trazabilidad BL-01 a BL-10 y comandos.
- [x] Construir navegación responsive para Inicio, Mi trabajo, cinco áreas, Reportes y Configuración; marcar módulos pendientes.
- [x] Comprobar lint, TypeScript, build y una petición HTTP local.

### 2. Autenticación y autorización — BL-03, BL-04, BL-05, BL-06

**Archivos:** `src/features/auth/*`, `src/app/login/*`, `src/app/auth/callback/*`, `src/app/acceso-denegado/*`, `supabase/migrations/*`, `tests/auth/*`.

- [x] Probar que la función de autorización rechaza tenant, identidad y pertenencia no válidos.
- [x] Implementar login/callback/salida y comprobación de sesión de servidor con fallo cerrado.
- [x] Crear migraciones de organización, sede, perfil, pertenencia, proyecto, `work_items` y bitácora con índices y RLS.
- [ ] Verificar SQL y casos negativos en PostgreSQL local si Docker está disponible; documentar OAuth real como pendiente de Entra y Supabase autorizados.

### 3. Primer registro de trabajo — BL-08, avance de BL-09 y BL-10

**Archivos:** `src/features/work-items/*`, `src/app/(dashboard)/mi-trabajo/*`, `tests/work-items/*`.

- [x] Probar validación de título, prioridad/estado, vencimiento y permisos de operaciones.
- [ ] Implementar formulario y lista a través de operaciones de servidor con RLS y datos persistentes cuando exista Supabase configurado.
- [x] Registrar creación y actualizaciones críticas mediante migraciones/funciones transaccionales.
- [x] Ejecutar pruebas, typecheck, lint y build; registrar qué requirió servicios externos.

## Criterio de este corte

Una pantalla pública de acceso y navegación privada protegida, migraciones versionadas y al menos una operación de registro verificada localmente o un bloqueo externo reproducible. No marcar OAuth corporativo ni liberación MVP como hechos sin prueba real.
