# Auditoría de interfaz · 30/10/2026

Fuente subordinada: `docs/UPCO-Admin-instrucciones-integracion-UI.md`, entregado por UPCO. La línea base se consultó en `docs/PLAN_IMPLEMENTACION.md` (`d61dba2`), `docs/UPCO_Admin_Especificacion_MVP_v1_0.md` (`d61dba2`), `docs/ARQUITECTURA.md` (`d61dba2`), `docs/IDENTIDAD_VISUAL_UPCO.md` (`a04dcb4`) y `docs/DECISIONES.md` (`afa40a9`). El código de partida es `b60ecec`.

## Línea base e inventario

Next.js 16.4.3, React 19.3.0 y TypeScript, con npm y `package-lock.json`. Tailwind 4 está instalado, pero las pantallas usan principalmente clases propias en `src/app/globals.css` y `src/app/brand.css`. La marca define verde `#0B4B32`, oscuro `#041914`, gris `#EDEDED`, Satoshi para títulos y alternativa de sistema para texto. Las rutas privadas usan el layout de `src/app/(dashboard)/layout.tsx` con control de sesión y membresía; RLS en Supabase limita las filas. Los formularios llaman a acciones de servidor. Vitest, TypeScript, ESLint, compilación Next y pruebas SQL forman la verificación existente.

| Pantalla | Funciones actuales y origen | Control de acceso |
|---|---|---|
| Inicio | Actividades de hoy, vencidas y en espera; próximos seguimientos. `work_items`, `follow_ups`; enlaces a listas. | Sesión, membresía, RLS. |
| Mi trabajo | Alta, búsqueda y filtros, estado, prioridad, sede, notas, archivo e historial. `work_items`, `activity_log`. | Sesión, membresía, RLS; edición del creador. |
| Administración y Seguimientos | Gestiones, documentación y agenda. `admin_details`, `follow_ups`. | Sesión, membresía, RLS; escritura del creador. |
| Procura | Solicitudes de uno o varios artículos, sede, proveedor, solicitante, listados y ficha; catálogo y archivo de proveedores. `work_items`, `procurement_details`, `procurement_request_items`, `vendors`. | Sesión, membresía, RLS; edición del creador. |
| Tecnología, Proyectos, Reportes, Configuración | Rutas ya visibles con alcance aún parcial según `docs/PROGRESO.md`. | Sesión y membresía. |

Referencia de regresión: en Procura, el formulario actual presenta renglones de artículo, campos comunes y botón de guardado en una sola cuadrícula; las tablas se desplazan horizontalmente en móvil. Cada renglón tiene etiquetas, cantidad y unidad. La ficha PRC muestra los renglones. La última verificación registrada pasó 127 pruebas Vitest, typecheck, lint, build y SQL; la prueba autenticada de alta con dos artículos sigue pendiente. El incremento no debe alterar esas reglas ni ocultar los estados vacíos o de error.

## Trazabilidad y decisión

| Pantalla y base aprobada | Componente actual → candidato | Dependencia | Beneficio / riesgo | Decisión |
|---|---|---|---|---|
| Procura, BL-16 / RF-020 y RNF-09/16 | Formulario de solicitud → secciones semánticas y jerarquía visual con componentes actuales | Ninguna | Facilita recorrer artículos, destino y solicitante; riesgo bajo de regresión de CSS y orden de tabulación. | **Integrar**, piloto. |
| Procura, BL-15/16 / RF-020/21 y RNF-16 | Página larga → enlaces internos a secciones existentes | Ninguna | Acorta la navegación por teclado y móvil; riesgo bajo de anclas incorrectas. | **Integrar**, piloto. |
| Procura, BL-15/16 | Tablas actuales → TanStack Table + shadcn/ui Data Table | Paquetes y nueva lógica de tabla | Puede mejorar tablas, pero la paginación y RLS ya están en servidor; sustituirlas añade peso y riesgo. | **Posponer** hasta una necesidad concreta. |
| Inicio, BL-12 / RF-010 | Indicadores actuales → Magic UI o Motion | Paquete de animación | La cifra ya es legible; animarla no mejora la decisión diaria. | **Descartar** en este incremento. |
| Mi trabajo, BL-08/11 | Lista y filtros → Kibo Kanban / command palette | Paquetes y comportamiento adicional | Kanban con movimiento o búsqueda global exigiría revisar flujos y permisos. | **Posponer** como idea futura. |
| Proyectos, aún pendiente | Ficha futura → Kibo Gantt/calendario | Modelo de planificación aún incompleto | No hay cronograma aprobado para representar. | **Posponer**; no crear datos de demostración. |
| Otras pantallas | Efectos React Bits / Kokonut UI | Dependencias visuales | Peso y distracción sin beneficio comprobable. | **Descartar**. |

## Compatibilidad y prueba del piloto

El piloto usa React y CSS ya presentes. No copia código de registros externos ni agrega paquetes: licencias y tamaño de JavaScript quedan iguales. Los `fieldset`/`legend` y enlaces nativos funcionan con teclado y lectores de pantalla. No introduce movimiento, por lo que `prefers-reduced-motion` no requiere una excepción. Los estilos se adaptarán a 390, 800 y 1440 px, conservarán foco visible y la paleta oficial.

Verificar: orden de lectura y foco; agregar/quitar dos artículos; nombres y valores `FormData` sin cambios; enlaces internos; estados de éxito/error/vacío; compilación, pruebas actuales y revisión visual de escritorio y móvil. La prueba autenticada de dos artículos permanece como comprobación separada.

## Resultado del piloto

Se añadieron tres grupos semánticos a «Nueva solicitud», un contador de renglones y navegación interna a las cinco secciones existentes de Procura, incluido el alta de proveedores. Los campos, las consultas, las acciones, los permisos y la paginación no cambiaron. No se añadieron dependencias. Las propuestas marcadas `posponer` o `descartar` en la tabla permanecen fuera del trabajo activo.

Se renderizó el formulario real en una maqueta local con los estilos de la aplicación. Las capturas de referencia son [390 px](ui/procura-piloto-390.png) y [1440 px](ui/procura-piloto-1440.png); también se revisó a 800 px. A los tres anchos, `scrollWidth` coincidió con el ancho de la ventana: no hubo desbordamiento horizontal. Los cuatro grupos fueron reconocibles por rol accesible y el primer Tab enfocó «Nueva solicitud». No se introdujo animación; el cambio de color de los enlaces internos se desactiva con movimiento reducido. Las capturas muestran el formulario aislado, sin la barra lateral ni datos autenticados.

Las pruebas dirigidas fallaron primero por falta de grupos y anclas y pasaron tras el cambio. La suite completa terminó con 128 pruebas aprobadas; TypeScript, ESLint y la compilación de Next.js pasaron. No se modificó SQL, por lo que no fue necesario repetir la suite de migraciones. La prueba autenticada de alta con dos artículos en staging permanece pendiente y pertenece a BL-16, no al piloto visual.

El diff se revisó manualmente; la revisión independiente no pudo ejecutarse por un límite de uso de la herramienta. Se publicó `4b1a3d2` en `main`: la URL de staging sirvió una hoja CSS que contiene `.procurement-sections` y `.request-group-grid`; `/login` devolvió 200 y `/procura` sin sesión redirigió 307 a `/login`. La comprobación visual autenticada desde la web sigue pendiente.
