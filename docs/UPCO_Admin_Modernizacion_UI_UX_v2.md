# UPCO Admin — Modernización UI/UX v2

## Instrucciones de implementación para el agente Codex

**Estado:** especificación de la iniciativa visual, subordinada al MVP, la arquitectura y las decisiones vigentes del proyecto.
**Fecha:** 5 de noviembre de 2026.
**Fuente principal:** `AUDITORIA_UI_2026-10-30.md`, auditoría aportada por UPCO.
**Dirección acordada:** interfaz de gestión empresarial moderna, sobria y consistente; sistema de diseño UPCO con shadcn/ui, Tailwind CSS 4 y componentes propios; layout compartido primero, Procura como piloto completo y extensión gradual al resto de módulos.

> **Mandato principal:** moderniza la experiencia visual y de interacción de UPCO Admin sin cambiar el alcance del MVP, la arquitectura aprobada, los procesos existentes, los contratos de datos ni la lógica de negocio. Si una mejora requiere modificar cualquiera de ellos, sepárala como propuesta futura y no la implementes en esta iniciativa.

## 1. Contexto y regla de inspección

La auditoría del 30/10/2026 describe una línea base con Next.js 16.4.3, React 19.3.0, TypeScript, Tailwind CSS 4, CSS propio, Supabase con RLS, acciones de servidor y pruebas Vitest, TypeScript, ESLint, compilación y SQL. También registra la marca: verde `#0B4B32`, verde oscuro `#041914`, gris `#EDEDED`, Satoshi para títulos y fuente de sistema alternativa para texto. **Estos son datos de la auditoría, no una confirmación del estado actual del repositorio.**

Antes de cambiar archivos:

1. Localiza la raíz real del proyecto, lee sus instrucciones para agentes y revisa `package.json`, configuración de Tailwind, rutas, layouts, estilos, componentes, pruebas y estado de Git. No supongas directorios ni nombres de archivos.
2. Lee las versiones vigentes de la especificación del MVP, el plan de implementación, la arquitectura, identidad visual, decisiones y progreso. La auditoría menciona documentos con esos nombres, pero comprueba que existan y que sigan vigentes.
3. Inventaría pantallas, navegación, componentes reutilizados, estilos globales, librerías instaladas, fuentes, iconos, estados de carga/error/vacío y controles de acceso. Identifica qué datos y acciones consume cada vista.
4. Reproduce una línea base verificable: capturas del entorno autenticado en escritorio, tableta y móvil; recorrido de teclado; pruebas existentes; y cualquier limitación de acceso. Registra resultados antes de editar.
5. Redacta una matriz de trazabilidad «pantalla actual → cambio visual → contrato que se preserva → prueba». Confirma con el código todo dato derivado de esta auditoría antes de utilizarlo como premisa de implementación.

Si falta acceso autenticado, evidencia o documentación imprescindible para validar un flujo, deja constancia y continúa solo con trabajo que pueda verificarse sin ese acceso. No declares aprobada visualmente una pantalla que no hayas visto.

## 2. Objetivos y resultados esperados

- Dar a la aplicación una apariencia profesional, contemporánea y propia de UPCO, con jerarquía clara, buen uso del espacio y densidad apropiada para trabajo administrativo.
- Unificar navegación, encabezados, botones, formularios, tablas, fichas, estados, tipografía, iconografía y mensajes mediante reglas reutilizables.
- Mejorar la rapidez de orientación y lectura en Inicio, Mi trabajo, Administración y Seguimientos, Procura y las rutas existentes con alcance parcial.
- Hacer que las interacciones funcionen de forma clara con teclado, tecnologías de asistencia y pantallas pequeñas.
- Permitir una adopción incremental, fácil de revisar y revertir, sin interrumpir el uso del sistema.

La referencia visual conceptual es una aplicación empresarial sobria: navegación persistente, controles discretos, tablas legibles e información priorizada. No copies pantallas, marcas ni comportamientos de productos externos.

## 3. Alcance y no objetivos

### En alcance

- Sistema de diseño UPCO: tokens, convenciones de uso, componentes básicos y patrones compuestos.
- Layout autenticado compartido: sidebar, topbar, encabezado de página y navegación móvil.
- Mejoras de presentación e interacción de las funciones **ya existentes** en cada módulo.
- Estados accesibles y coherentes: carga, vacío, error, éxito, validación, deshabilitado y permisos insuficientes, según lo que ya exponga cada flujo.
- Documentación de componentes, decisiones visuales, capturas y pruebas de regresión.

### Fuera de alcance

- Cambios en esquema, migraciones, RLS, autenticación, membresía, permisos, acciones de servidor, consultas, contratos de `FormData`, rutas públicas o privadas y reglas de negocio.
- Nuevas funciones del MVP, nuevos estados de negocio, nuevos indicadores sin datos verificables, datos ficticios en producción o cambios en el orden de los procesos aprobados.
- Sustitución de paginación/filtros de servidor por lógica cliente; TanStack Table, kanban, búsqueda global, Gantt, calendario nuevo, paneles de análisis no respaldados por datos y edición rápida que altere permisos o flujo.
- Efectos decorativos o bibliotecas añadidas por apariencia: Magic UI, React Bits, Kokonut UI, Motion o dashboardcn quedan fuera del alcance inicial. Reconsiderarlas exige un caso concreto, medición y decisión independiente.
- Rediseñar páginas de autenticación o introducir modo oscuro por defecto sin inventario, diseño y validación específicos.

La auditoría clasificó varias ideas como **posponer** o **descartar** para el incremento anterior. Esta iniciativa permite una modernización visual más amplia, pero mantiene fuera del trabajo activo esas funciones y dependencias hasta que exista justificación propia.

## 4. Contratos que deben conservarse

Antes y después de cada cambio compara, como mínimo:

| Área | Invariante obligatorio |
|---|---|
| Seguridad | Sesión, membresía, RLS y permisos de lectura/escritura; edición limitada al creador donde aplique. |
| Datos | Tablas, consultas, filtros, orden, paginación, relaciones, valores mostrados y tratamiento de errores. |
| Formularios | Campos, obligatoriedad, valores por defecto, nombres y valores enviados en `FormData`, validación funcional y acciones de servidor. |
| Navegación | Rutas existentes, enlaces a registros y listas, redirecciones y anclas funcionales. |
| Procura | Solicitudes de uno o varios artículos, cantidad/unidad, sede, proveedor, solicitante, ficha PRC, catálogo y archivo de proveedores. |
| Otros módulos | Alta, búsqueda, filtros, estados, prioridad, sede, notas, archivo, historial, documentación y seguimientos según las funciones realmente presentes. |

No cambies una pantalla por una maqueta estática. Ningún componente nuevo puede ocultar datos, errores, acciones permitidas o estados vacíos actuales.

## 5. Arquitectura del sistema de diseño

### Base técnica

Usa **shadcn/ui + Tailwind CSS 4 + componentes propios de UPCO** como base de la iniciativa, respetando la configuración real del proyecto. Configura shadcn/ui para el proyecto **existente**, con el gestor de paquetes y alias de importación que ya use. Revisa `components.json`, el CSS de entrada y las dependencias generadas antes de aceptar cambios. Añade únicamente los componentes necesarios para cada fase; revisa los archivos que genera la CLI y evita sobreescribir personalizaciones o reemplazar el CSS global de una vez.

Usa variables CSS semánticas y el mecanismo de tema de Tailwind 4 para conectar los tokens con las utilidades. Separa tres capas:

1. **Marca:** valores oficiales y tipografía aprobada.
2. **Semántica:** fondo, superficie, texto, borde, foco, acción principal y estados; claros en cada contexto de uso.
3. **Componente:** variantes de botón, campo, tabla, navegación, tarjeta y mensajes, construidas sobre los tokens semánticos.

Los componentes de shadcn/ui son una base editable, no una identidad visual terminada. Define adaptadores o variantes UPCO cuando una regla se repita. Conserva los componentes propios que ya resuelvan bien un problema; migra solo cuando la sustitución reduzca inconsistencia y se haya probado el comportamiento.

### Tokens corporativos

| Familia | Regla para v2 |
|---|---|
| Marca | Preserva `#0B4B32` y `#041914`; conserva `#EDEDED` como neutro oficial. Verifica el uso exacto de cada color en la guía de identidad antes de asignar roles. |
| Color semántico | Define tokens para fondo, superficie, texto principal/secundario, borde, foco, acción, éxito, advertencia, error e información. **No inventes hexadecimales oficiales adicionales**: propón valores derivados, documéntalos y comprueba contraste. |
| Tipografía | Mantén Satoshi en títulos si la fuente está disponible y licenciada; conserva la alternativa del sistema para texto. Define escalas para título de página, sección, cuerpo, etiqueta y dato tabular. |
| Espaciado y densidad | Escala repetible para separación, padding y altura de controles. Permite lectura de datos densos sin convertir formularios o tablas en superficies comprimidas. |
| Forma y elevación | Radios, bordes y sombras discretos; evita tarjetas o contornos pesados en cada bloque. |
| Interacción | Hover, activo, seleccionado, foco visible, deshabilitado, error y progreso con significado coherente. No dependas solo del color. |

Documenta la tabla final de tokens, su uso y los valores aprobados en el repositorio real. Evita duplicar colores y tamaños directamente en cada pantalla. Si existe modo oscuro, conserva su comportamiento; si no existe, no lo agregues como requisito de esta fase.

### Catálogo inicial de componentes

Prioriza: botón y enlace de acción; campo de texto, selección, área de texto y ayuda/error; etiquetas de estado; tarjeta e indicador; encabezado de sección; tabla y barra de filtros; diálogo/menú cuando ya exista el comportamiento; pestañas solo donde mejoren una vista real; aviso, estado vacío, carga y error; breadcrumb, sidebar y encabezado de página. Usa iconos de una sola familia y texto accesible para acciones solo con icono.

Cada componente debe definir variantes, estados, tamaños necesarios, uso permitido y un ejemplo real de la aplicación. Evita un catálogo grande sin consumidores. Mantén componentes de presentación separados de lectura de datos y acciones de servidor, salvo cuando la arquitectura vigente exija otra cosa.

## 6. Layout compartido: sidebar y topbar

- **Sidebar:** conserva todas las rutas y controles de acceso vigentes. Agrupa por áreas reales, marca inequívocamente la sección activa y admite estado expandido/contraído en escritorio si aporta espacio útil. Icono y texto deben seguir identificando cada destino; no escondas rutas por razones meramente estéticas.
- **Topbar:** muestra contexto de ubicación (breadcrumb cuando corresponda), título de pantalla y acciones de la vista. Conserva el acceso a cuenta y las acciones existentes. Las acciones primarias deben ser estables y fáciles de encontrar.
- **Móvil:** navegación lateral desplegable con control etiquetado, cierre accesible y retorno de foco. El contenido no debe quedar tapado por la barra. No traslades al menú móvil acciones esenciales que deban estar visibles en la pantalla.
- **Layout:** preserva el control de sesión/membresía en su lugar efectivo. Evita rehacer rutas o límites entre componentes de servidor y cliente solo para adoptar un componente visual.

## 7. Módulos y orden de prioridad

| Prioridad | Área | Trabajo visual permitido | Límite funcional |
|---|---|---|---|
| 1 | Layout + sistema de diseño | Navegación, topbar, estructura de página y componentes básicos. | Misma sesión, membresía, rutas y permisos. |
| 2 | Procura, piloto v2 | Refinar formulario ya agrupado, lista y ficha: jerarquía, ayuda, validación visible, artículos, proveedores y acciones. | Misma alta/edición, artículos, `FormData`, acciones, paginación y RLS. |
| 3 | Inicio | Indicadores de actividades reales, listas de hoy/vencidas/en espera, próximos seguimientos y estados vacíos. | Sin métricas o gráficos inventados. |
| 4 | Mi trabajo | Barra de búsqueda/filtros, tabla/lista, prioridades y estados, ficha/historial. | Mismos filtros, permisos y operaciones. |
| 5 | Administración y Seguimientos | Gestiones, documentación, agenda y formularios con patrones validados. | Mismo calendario/proceso realmente implementado. |
| 6 | Tecnología, Proyectos, Reportes, Configuración | Aplicar shell y componentes a lo que **ya exista** y tenga alcance aprobado. | No completar funciones pendientes como parte de esta iniciativa. |

La prioridad 3–6 puede ajustarse según el inventario real y el uso de cada pantalla, manteniendo Procura como piloto de validación antes de replicar patrones.

### Piloto de Procura: definición operativa

La auditoría indica que el piloto previo ya añadió grupos semánticos, enlaces a cinco secciones y contador de renglones. Parte de esa implementación real; no la rehagas. Produce una vista v2 completa que incluya el shell y, según las pantallas existentes, formulario, listados, ficha PRC y proveedores. Mejora la jerarquía entre artículos, destino y solicitante; alinea etiquetas y ayudas; presenta claramente errores y confirmaciones; mantiene visibles las acciones de guardar/cancelar y el número de artículos; y permite leer tablas en móvil mediante la solución más simple que respete todos los datos y acciones. Conserva la paginación del servidor.

Valida al menos: añadir y quitar artículos; alta con dos artículos; cantidad y unidad; selección de sede/proveedor/solicitante; edición permitida y denegada; guardado correcto y fallido; regreso a lista y ficha; enlaces internos; estados vacíos y de error. La auditoría registra **128 pruebas aprobadas** tras el piloto y deja pendiente una prueba autenticada de alta con dos artículos en staging; toma esos datos como antecedente, vuelve a medir la suite actual y resuelve esa validación autenticada para el piloto v2 cuando haya acceso.

## 8. Accesibilidad, responsive y calidad visual

- Teclado: orden lógico de Tab, foco visible, operación de menús/diálogos, retorno de foco y escape cuando aplique. Ningún control debe depender de hover.
- Semántica: títulos jerarquizados, etiquetas reales, `fieldset`/`legend` donde agrupan controles, mensajes de error asociados, nombres accesibles en iconos y estados anunciados cuando corresponda.
- Contraste: comprueba texto, iconos, bordes significativos, foco y estados en los colores finales; usa como referencia WCAG nivel AA aplicable.
- Movimiento: sin animaciones continuas ni cifras decorativas. Cualquier transición breve debe respetar `prefers-reduced-motion`.
- Tamaños: inspecciona al menos **390, 800 y 1440 px**, anchos utilizados en la auditoría; comprueba también el punto de quiebre real del layout. No debe haber desbordamiento horizontal de la página. Una tabla puede desplazar su propia región si conserva encabezados, contexto, foco y acciones.
- Estados y datos: revisa textos largos, listas vacías, errores de red/servidor, validación, carga y contenido realista. Los datos de demostración solo se permiten en maquetas aisladas y claramente identificadas.
- Capturas: compara antes/después de pantallas autenticadas en los tres tamaños. La maqueta aislada del piloto anterior no sustituye esta revisión.

## 9. Estrategia por fases y puertas de salida

**Fase 0 — Descubrimiento y línea base.** Completa inventario, captura visual autenticada, mapa de contratos, resultados de pruebas y propuesta de tokens/componentes. Salida: alcance confirmado y lista de archivos reales que se tocarán.

**Fase 1 — Fundamentos.** Integra de forma incremental shadcn/ui con Tailwind 4, variables semánticas, tipografía, iconos y primeros componentes UPCO. Revisa compatibilidad, licencias, peso añadido y CSS generado. Salida: componentes básicos demostrados en una pantalla real, sin regresiones.

**Fase 2 — Shell.** Moderniza sidebar, topbar y encabezados compartidos. Salida: navegación y control de acceso intactos; verificación responsive y por teclado en todas las rutas existentes.

**Fase 3 — Procura.** Implementa y valida el piloto completo descrito arriba. Salida: flujos autenticados y pruebas de regresión aprobados; capturas revisadas en 390/800/1440 px; patrones documentados para reutilización.

**Fase 4 — Extensión.** Migra Inicio, Mi trabajo y Administración/Seguimientos por incrementos pequeños; aplica el shell a rutas de alcance parcial sin inventar funciones. Salida de cada módulo: criterios de aceptación cumplidos y comparación con la línea base.

**Fase 5 — Cierre.** Revisa consistencia transversal, elimina estilos duplicados solo cuando su reemplazo esté probado, documenta componentes/tokens y entrega evidencias. Mantén cada fase o módulo en cambios separables y reversibles. No despliegues a producción ni amplíes el alcance por iniciativa propia.

## 10. Verificación y criterios de aceptación

Ejecuta los comandos **reales** del repositorio para pruebas unitarias, TypeScript, ESLint, compilación y SQL cuando los cambios puedan afectarlo. No presupongas nombres de scripts. Añade o actualiza pruebas solo para comportamientos que puedan romperse: navegación, formularios, estados, permisos y variantes interactivas. Las capturas visuales no sustituyen las pruebas de flujo.

La iniciativa se acepta cuando:

1. La interfaz comparte tokens, tipografía, componentes y convenciones documentadas; las pantallas intervenidas se ven coherentes sin perder su densidad útil.
2. Sidebar, topbar y navegación móvil funcionan con rutas y permisos reales, teclado y lector de pantalla; no hay destinos perdidos.
3. Procura pasa sus flujos completos, incluido el caso autenticado de dos artículos, o queda explícitamente pendiente por falta de acceso con evidencia del bloqueo. No se declara cerrado el piloto si ese caso no puede verificarse.
4. Las acciones de servidor, RLS, autenticación, membresía, `FormData`, filtros, paginación, datos y rutas no cambiaron de contrato.
5. No hay desbordamiento de página ni controles inaccesibles a 390, 800 y 1440 px; el foco y los mensajes de estado son visibles y comprensibles.
6. Pruebas y compilación vigentes pasan. Todo fallo preexistente o excepción queda identificado con evidencia, sin atribuirlo automáticamente a esta iniciativa.
7. Existen capturas antes/después de vistas autenticadas, registro de pruebas, lista de cambios y guía breve para continuar la migración.

## 11. Entregables del agente

- Resumen inicial de inspección: versión real, estructura encontrada, diferencias respecto de la auditoría, riesgos y plan de cambios por fase.
- Tabla de tokens UPCO y guía de uso de componentes; decisiones de integración de shadcn/ui y Tailwind 4.
- Implementación incremental del shell y de los módulos aprobados, comenzando por Procura, con cambios revisables por fase.
- Matriz de regresión y resultados de pruebas automáticas, manuales, accesibilidad y responsive.
- Capturas comparativas autenticadas en 390/800/1440 px y registro de cualquier validación imposible de completar.
- Resumen final de archivos cambiados, contratos preservados, dependencias añadidas, limitaciones y trabajo pospuesto.

## Referencias para ejecutar la integración

- Auditoría aportada por UPCO: `AUDITORIA_UI_2026-10-30.md` (30/10/2026). Consulta su copia vigente en el contexto del proyecto; no asumas que la ruta temporal del adjunto existe allí.
- [shadcn/ui: instalación en un proyecto Next.js existente](https://ui.shadcn.com/docs/installation/next).
- [shadcn/ui: compatibilidad con Tailwind CSS 4 y React 19](https://ui.shadcn.com/docs/tailwind-v4).
- [shadcn/ui: variables de tema](https://ui.shadcn.com/docs/theming) y [configuración `components.json`](https://ui.shadcn.com/docs/components-json).
- [Tailwind CSS 4: variables `@theme`](https://tailwindcss.com/docs/theme).

La documentación externa orienta la integración técnica; las reglas del MVP, arquitectura e identidad de UPCO prevalecen para las decisiones del proyecto.
