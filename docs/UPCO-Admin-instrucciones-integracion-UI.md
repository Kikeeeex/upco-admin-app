# UPCO Admin — Instrucción para integrar mejoras de interfaz

> **Destinatario:** agente o equipo que implemente UPCO Admin.
> **Objetivo:** mejorar la presentación y la facilidad de uso de las funciones ya aprobadas, mediante componentes existentes, sin cambiar el MVP ni su plan de implementación.

## Regla de precedencia

El plan de implementación, la definición del MVP, los requisitos aprobados y la arquitectura vigente de UPCO Admin son la fuente de verdad. Este documento es una instrucción subordinada de mejora de interfaz; **no agrega requisitos, módulos, hitos, prioridades, flujos de negocio ni decisiones de arquitectura**. El orden de integración sugerido aquí se aplica únicamente a mejoras que ya encajen en el trabajo aprobado y no reordena el plan del proyecto.

No se ha proporcionado aquí el repositorio ni una copia del plan o del MVP. Antes de modificar código, localiza sus versiones vigentes y registra las rutas y revisiones consultadas. Si faltan o se contradicen, entrega el informe de auditoría y deja las propuestas afectadas pendientes; no inventes una interpretación del alcance.

## Encargo

Integra de forma incremental componentes visuales y, cuando corresponda, controles funcionales de [shadcn/ui](https://ui.shadcn.com/), [Magic UI](https://magicui.design/), [Motion](https://motion.dev/), [TanStack Table](https://tanstack.com/table), [Kibo UI](https://www.kibo-ui.com/), [React Bits](https://reactbits.dev/) y [Kokonut UI](https://kokonutui.com/). Elige cada pieza por su utilidad en una pantalla aprobada; **no instales todas las bibliotecas por defecto**. Conserva el framework, el sistema de estilos, la navegación, los contratos de datos, los permisos y las convenciones ya establecidos. Si la aplicación no usa React o la integración exige migrar de stack, documenta la incompatibilidad y mantén la implementación pendiente.

### Límites obligatorios

- No modifiques requisitos funcionales o no funcionales, alcance, prioridades, hitos, criterios de aceptación originales ni arquitectura del MVP.
- No crees entidades, campos persistidos, endpoints, automatizaciones, roles, permisos o estados nuevos para justificar un componente.
- No cambies la semántica de los datos ni los procesos existentes. Una vista nueva debe representar el mismo estado que las vistas actuales.
- No actives acciones masivas, edición mediante arrastrar y soltar, programación de fechas, búsqueda global o atajos de escritura si esas capacidades y sus autorizaciones no están aprobadas.
- No sustituyas componentes ya correctos solo por uniformidad visual. Evita duplicar bibliotecas o mecanismos de estado que el proyecto ya resuelve.
- Respeta la identidad visual vigente de UPCO Admin, su idioma, accesibilidad, diseño adaptable y convenciones de uso. Un modo oscuro o una nueva configuración de usuario solo procede si ya forma parte del alcance aprobado.

## 1. Auditoría inicial obligatoria

Antes de instalar o editar componentes, entrega un informe breve con estas evidencias:

1. **Línea base del proyecto:** rutas y revisiones del plan, MVP, requisitos, arquitectura y diseño; framework, versión, gestor de paquetes, sistema de estilos, componentes existentes, rutas, pruebas y estado de la compilación.
2. **Inventario de pantallas y funciones aprobadas:** qué tablas, indicadores, tareas, fechas, búsquedas y estados existen realmente; su origen de datos, permisos y comportamiento actual.
3. **Mapa de trazabilidad:** para cada mejora propuesta, indica pantalla, requisito o tarea aprobada, componente actual, componente candidato, dependencia adicional, beneficio, riesgo y decisión. Usa estas decisiones: `integrar`, `posponer` o `descartar`.
4. **Compatibilidad:** comprueba versiones, licencias, accesibilidad, tamaño de paquete, soporte de teclado, preferencias de movimiento reducido y adaptación a móvil. Revisa el código y las dependencias que copiará cada registro de componentes antes de incorporarlos.
5. **Referencia de regresión:** captura o describe las pantallas y recorridos actuales y registra las comprobaciones que ya pasan. No atribuyas al proyecto funciones mencionadas solo como ejemplos en conversaciones anteriores.

Clasifica como `integrar` únicamente una mejora trazable al alcance aprobado que pueda implementarse sin alterar contratos ni arquitectura. Si una capacidad es atractiva pero requiere decisiones de producto, datos o permisos nuevos, clasifícala como `posponer` y descríbela en una lista separada de ideas futuras; no la conviertas en trabajo del MVP.

## 2. Selección de componentes según el alcance real

| Mejora candidata | Integración permitida | Condición que obliga a posponer |
|---|---|---|
| **shadcn/ui:** base visual, formularios, navegación, sidebar y breadcrumbs | Aplicar de manera selectiva a pantallas y rutas existentes; reutilizar tokens y estilos actuales. | Requiere rediseñar la arquitectura de navegación, cambiar la identidad aprobada o rehacer pantallas fuera del plan. |
| **Magic UI y Motion:** métricas y transiciones discretas | Animar indicadores ya existentes, manteniendo el valor legible sin animación; usar movimiento sutil en estados y paneles actuales. | Introduce métricas nuevas, efectos que dificultan la lectura o una dependencia injustificada. |
| **TanStack Table + shadcn/ui:** tablas de datos | Mejorar tablas aprobadas con orden, filtros, paginación o selección solo donde el comportamiento y los permisos existentes lo permitan. Conservar la estrategia actual de datos del cliente o servidor. | Exige nuevos endpoints, filtros de negocio, exportaciones, acciones masivas o cambios de autorización. |
| **Command palette:** acceso por teclado | Añadir navegación rápida a rutas y acciones ya aprobadas, tras revisar conflictos de atajos, foco y permisos. | La búsqueda global necesita índices, APIs, permisos o resultados que el MVP no contempla. |
| **Kibo UI Kanban:** vista de trabajo | Usar como vista alternativa de tareas y estados existentes, si el MVP ya contempla ese flujo. El movimiento entre columnas solo procede con transiciones y guardado ya aprobados. | Requiere estados nuevos, cambios de proceso o lógica de arrastrar y soltar sin respaldo en el modelo actual. |
| **Kibo UI Gantt y calendario:** vista temporal | Mostrar fechas y relaciones ya existentes, si la planificación o el calendario están aprobados. Una vista de solo lectura puede ser suficiente. | Requiere crear cronogramas, dependencias, fechas editables, recordatorios o reservas nuevas. |
| **React Bits y Kokonut UI:** detalles visuales | Incorporar una pieza puntual y coherente en una pantalla existente, con alternativa sin movimiento. | El efecto distrae, reduce accesibilidad o agrega peso y mantenimiento sin beneficio claro. |

Los nombres de bibliotecas son **opciones de implementación**, no requisitos de instalación. Si un componente existente cumple la necesidad con menos cambios, consérvalo. No introduzcas tablas, tableros, KPI ni calendarios de demostración en producción para simular una función inexistente.

## 3. Integración incremental

1. **Preparación.** Completa la auditoría y el mapa de trazabilidad. Selecciona una pantalla aprobada como piloto. Define el cambio visual concreto y las pruebas de regresión antes de editarla. Mantén las propuestas pendientes fuera del trabajo activo.
2. **Piloto visual.** Ajusta estilos y componentes base de esa pantalla dentro del sistema existente. Introduce animaciones únicamente donde mejoren la comprensión del estado. Comprueba escritorio, móvil, teclado y movimiento reducido.
3. **Controles sobre funciones existentes.** Mejora una tabla o un control de navegación aprobado, si la auditoría lo justifica. Verifica que datos, filtros, permisos, URL, estado vacío, error y carga mantengan su comportamiento previsto.
4. **Extensión controlada.** Reutiliza el patrón validado solo en las otras pantallas que el plan ya incluye. Evalúa Kanban, Gantt, calendario y command palette individualmente con el mismo criterio de trazabilidad; no los conviertas en una fase obligatoria.
5. **Cierre por incremento.** Después de cada cambio, ejecuta las pruebas existentes y la verificación visual. Registra archivos modificados, dependencias añadidas, evidencia de aceptación, diferencias frente a la línea base y cualquier propuesta pospuesta.

No uses esta secuencia para alterar las prioridades del plan de implementación. Trabaja en los hitos que ese plan autorice y aplica estas mejoras dentro de ellos cuando corresponda.

## 4. Criterios de aceptación

Una mejora queda aceptada solo si se cumplen todos los puntos aplicables:

- **Trazabilidad:** cada cambio se vincula con una pantalla y un requisito o tarea aprobados; el diff no modifica el MVP, su plan, contratos, arquitectura ni prioridades.
- **Función:** los recorridos existentes siguen operando con los mismos datos y reglas. Las vistas alternativas muestran estados coherentes y no permiten acciones no autorizadas.
- **Usabilidad:** estados de carga, vacío, error y éxito son claros; la navegación funciona en escritorio y móvil; el teclado y el foco son utilizables.
- **Accesibilidad:** contraste, nombres accesibles y foco visible adecuados; las animaciones respetan la preferencia de movimiento reducido y la información no depende de la animación.
- **Rendimiento y mantenimiento:** la compilación y las pruebas pertinentes pasan; el impacto de dependencias y tamaño de paquete queda documentado; no hay duplicaciones innecesarias ni fallos visibles de consola.
- **Entrega verificable:** se adjuntan el informe de auditoría, el mapa de trazabilidad, capturas o registro de la revisión visual, resultados de pruebas y lista de cambios pospuestos.

Si una mejora falla algún criterio, corrígela o retírala del incremento. Si cumplirlo requiere ampliar el alcance, déjala pendiente para una decisión separada sobre el producto; **no cambies el MVP para hacerla caber**.

## Referencias técnicas para consultar al implementar

- [shadcn/ui: Sidebar](https://ui.shadcn.com/docs/components/base/sidebar), [Data Table](https://ui.shadcn.com/docs/components/base/data-table) y [Command](https://ui.shadcn.com/docs/components/base/command).
- [TanStack Table: documentación](https://tanstack.com/table) y [procesamiento en cliente o servidor](https://tanstack.com/table/latest/docs/guide/client-side-vs-server-side). Consulta la documentación de la **versión instalada** antes de usar APIs concretas.
- [Kibo UI: Kanban](https://www.kibo-ui.com/components/kanban), [Gantt](https://www.kibo-ui.com/components/gantt) y [Calendar](https://www.kibo-ui.com/components/calendar).
- [Magic UI: componentes](https://magicui.design/docs/components), [Motion: movimiento reducido](https://motion.dev/docs/react-use-reduced-motion), [React Bits](https://reactbits.dev/) y [Kokonut UI](https://kokonutui.com/).
