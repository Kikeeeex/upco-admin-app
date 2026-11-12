# Diseño: Administración con navegación y apariencia de la referencia UPCO

## Intención

Acercar el módulo de Administración de UPCO Admin a la interfaz de UPCO Compras que compartió el usuario, integrando sus submódulos en el sidebar global. Administración debe aparecer primero y expandirse para mostrar sus destinos. Procura, Inicio, Mi trabajo, Tecnología, Proyectos, Reportes y Configuración general siguen disponibles en la misma aplicación.

## Referencia y estado actual

La referencia presenta una aplicación de escritorio con sidebar verde oscuro, contenido gris claro, barra superior blanca, tarjetas blancas, acentos verdes y tipografía Satoshi. Su navegación incluye Resumen, Compras y notas, Proveedores, Reportes, Configuración fiscal y Usuarios. Sus páginas usan encabezados compactos, tarjetas/resúmenes, filtros y tablas densas.

En UPCO Admin ya existe una envoltura compartida en `src/components/app-shell.tsx`, con el grupo Trabajo antes de Áreas y Administración como un enlace plano dentro de Áreas. `src/app/(dashboard)/administracion/layout.tsx` agrega una segunda navegación horizontal. Las rutas y permisos de V2.8 ya existen para Resumen, Compras y documentos, Proveedores, Retenciones, Libros y cierres, Importaciones, Reportes y exportaciones, Configuración fiscal y Permisos.

## Objetivos

- Presentar Administración como la primera sección funcional del sidebar global, debajo de la marca y el control de contraer.
- Expandir sus submódulos debajo de Administración al navegar dentro del módulo. El enlace padre lleva a Resumen; un control con chevrón permite expandir o contraerlo sin navegar.
- Mostrar dentro de Administración, en este orden: Resumen, Compras y documentos, Proveedores, Retenciones, Libros y cierres, Importaciones, Reportes y exportaciones, Configuración fiscal, Permisos. Permisos solo aparece para administradores; el resto sigue filtrado por permisos V2.8.
- Aplicar a las páginas de Administración la jerarquía visual de la referencia: forest green en navegación, fondos claros, superficies blancas, encabezados concisos, acentos verdes, controles de período/estado, indicadores y tablas legibles.
- Eliminar la navegación horizontal duplicada de Administración una vez que la navegación del sidebar cubra sus destinos.
- Mantener rutas, permisos, lecturas, acciones de servidor, cálculos fiscales, exportaciones, importaciones, datos y límites de V2.8.
- Conservar el colapso de escritorio, la navegación móvil en Sheet, los estados activos, soporte de teclado y diseño usable en pantallas pequeñas.

## Fuera de alcance

- Cambiar cálculos, reglas fiscales, formato de salidas, políticas RLS, datos o esquema de Supabase.
- Alterar Procura u otras áreas más allá de su posición visual en el sidebar compartido.
- Añadir Usuarios como módulo de gestión de cuentas: en UPCO Admin, el submódulo Permisos sigue siendo la interfaz de administración de acceso.
- Cambiar etiquetas funcionales, versiones MVP o URLs existentes sin necesidad de presentación.

## Enfoques considerados

1. **Administración desplegable en el sidebar global (elegido por el usuario).** Agrupa sus enlaces bajo un padre que lleva al Resumen. Se expande automáticamente en rutas de Administración y conserva visibles las otras áreas. Es la única opción que cumple la petición de ver Administración primero, tener sus submódulos en el sidebar y continuar navegando por el resto de UPCO Admin.
2. **Sidebar exclusivo de Administración.** Reemplaza la navegación global al entrar al módulo y muestra sus nueve submódulos. Se parece al sitio de referencia, pero oculta Procura y el resto de la aplicación.
3. **Barra interna además del sidebar global.** Conserva Administración como un solo enlace global y mantiene una navegación horizontal o secundaria. Requiere menos cambios, pero no cumple que los submódulos estén bajo Administración en el sidebar y duplica la navegación actual.

## Decisiones de diseño

- El orden global pasa a ser: Administración primero; luego Trabajo (Inicio y Mi trabajo), las otras áreas (Procura, Tecnología y Proyectos) y Herramientas (Reportes generales y Configuración general). Administración no absorbe estos enlaces.
- En escritorio, el nodo Administración tiene un enlace padre hacia `/administracion` y un botón independiente para expandir/contraer. Si una ruta empieza por `/administracion`, el grupo comienza expandido. Se conserva la preferencia de colapsar el sidebar.
- En móvil, el panel lateral ofrece el mismo árbol; Administración comienza expandida en rutas propias, y sus enlaces conservan objetivos táctiles y cierre del panel al navegar.
- Los hijos se derivan de la matriz V2.8 existente para reutilizar permisos y rutas. Administradores ven todos. Miembros ven solo los hijos concedidos. Permisos queda solo para administradores. La protección en página, servidor y RLS no se sustituye por ocultamiento visual.
- La distribución de contenido adapta el markup existente mediante clases/componentes acotados al módulo: Resumen usa franja de período, indicadores y documentos recientes; Compras y Proveedores priorizan filtros, acción primaria y tablas; Retenciones y Libros presentan indicadores y salidas; Importaciones conserva los pasos de archivo y validación; Reportes ordena las salidas en tarjetas; Configuración fiscal agrupa parámetros en paneles; Permisos muestra la matriz de tareas en superficies consistentes.
- El nuevo tema visual se limita al shell compartido y al contenido bajo Administración. El sidebar global cambia para todas las áreas porque es compartido; las páginas de las otras áreas no cambian de composición ni de comportamiento.
- La marca y los logos existentes de UPCO Admin se conservan; se adaptan color, contraste, espaciado, bordes, encabezados, estados y responsive a la referencia.

## Criterios de aceptación

- Administración aparece primera en el sidebar, antes de Inicio, y expande sus submódulos en el lugar indicado.
- Una ruta de Administración abre el grupo y marca el hijo correcto; `/administracion/permisos` se distingue del Resumen.
- En cuentas miembro se ocultan los destinos sin permiso y se mantiene la denegación de servidor/RLS; las cuentas admin ven todo.
- Sidebar contraído, navegación móvil, foco de teclado y `prefers-reduced-motion` siguen funcionando.
- Todas las rutas existentes de Administración conservan sus datos y acciones; las rutas de Procura y otras áreas siguen navegables.
- Las pantallas de Administración reflejan el lenguaje visual de la referencia sin modificar su comportamiento fiscal/contable.
- Typecheck, lint y build de producción pasan; se revisa visualmente escritorio y móvil.

## Decisiones del implementador

- Mantener el árbol accesible con `nav`, listas y botones nativos; no añadir una dependencia de UI.
- Usar la misma tabla de navegación/permisos para escritorio y móvil para evitar discrepancias de acceso.
- Usar tokens y clases CSS del módulo, reutilizando tarjetas y formularios actuales donde su estructura se ajuste a la referencia.
