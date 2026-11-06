# Plan de implementación de modernización UI/UX v2

**Objetivo:** Adoptar un sistema visual UPCO coherente y modernizar el shell, usando Procura como piloto, sin alterar los contratos funcionales del MVP.

**Arquitectura:** Conservar las páginas de servidor y sus consultas. Incorporar tokens CSS semánticos y componentes de presentación bajo `src/components/ui`. Mantener `AppShell` como componente cliente para el estado de navegación. Aplicar estilos gradualmente sobre las clases existentes y sustituir solo las vistas verificadas.

**Tecnología:** Next.js 16.4.3, React 19.3, TypeScript, Tailwind CSS 4, shadcn/ui, Vitest y CSS propio.

## Fase 0 — Evidencia

1. Revisar instrucciones, documentos, rutas, contratos y estilos reales. Registrar la matriz en `docs/UI_UX_V2_BASELINE.md`.
2. Ejecutar suite inicial, tipos, lint, build y SQL. Registrar cualquier fallo.
3. Solicitar capturas autenticadas a 390/800/1440 px. Registrar que la validación visual y el alta PRC de dos artículos están pendientes si no hay acceso.

## Fase 1 — Fundamentos

1. Revisar documentación de Next.js 16 y shadcn para proyecto existente.
2. Instalar solo dependencias necesarias y agregar `components.json`, utilidad `cn` y componentes de base usados por pantallas reales. Revisar el diff generado.
3. Definir marca y tokens semánticos en CSS con conexión a Tailwind 4; documentar roles, valores derivados y contraste.
4. Crear pruebas de variantes y semántica de componentes interactivos antes del código; ejecutar suite y build.

## Fase 2 — Shell

1. Añadir pruebas de ruta activa, título contextual, menú móvil, Escape y retorno del foco.
2. Actualizar `src/components/app-shell.tsx` y CSS del shell. Conservar logos, rutas, cierre de sesión y preferencia de ancho.
3. Comprobar pruebas, tipos, lint y build; verificar responsive en DOM y con capturas aisladas cuando sea posible.

## Fase 3 — Procura

1. Revisar `CreateProcurementRequestForm`, listados, detalle PRC, proveedores, importación y pruebas existentes; registrar los campos y acciones antes de cambiar presentación.
2. Refinar jerarquía, legibilidad de tablas y estilos de formularios con componentes compartidos sin tocar acciones ni consultas.
3. Repetir pruebas de multiartículo, cantidad/unidad, validación, error, permisos, paginación y enlaces. Completar alta autenticada con dos artículos y comparación visual 390/800/1440 cuando haya acceso.

## Fases 4 y 5 — Extensión y cierre

1. Aplicar los patrones aprobados a Inicio, Mi trabajo, Administración y Seguimientos por módulo; dejar rutas pendientes con shell únicamente.
2. Verificar suite, tipos, lint, build y SQL si corresponde. Documentar capturas, matriz de regresión, límites y guía de componentes. No publicar en producción.

Cada fase debe quedar en cambios separables. Las puertas de aceptación visual autenticada son obligatorias para declarar cerrado el piloto y la iniciativa.
