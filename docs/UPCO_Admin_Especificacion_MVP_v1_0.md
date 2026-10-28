# UPCO Admin — Especificación de Requisitos de Software

*MVP · Gestión de actividades administrativas, procura, TI, proyectos y seguimientos*

| CONTROL DEL DOCUMENTO | VALOR |
|---|---|
| Código | UPCO-ADM-SRS-001 |
| Versión | 1.0 · Línea base del MVP |
| Fecha | 28 de octubre de 2026 |
| Estado | Requisitos funcionales definidos; sujeto a validación de viabilidad técnica y permisos corporativos |
| Público objetivo | Usuario administrador inicial; crecimiento futuro multiusuario |
| Tipo de entrega | Especificación funcional, no funcional, flujos, datos y backlog priorizado |

Uso previsto: referencia para diseño, implementación, pruebas y control de cambios. No constituye autorización para almacenar información corporativa en servicios externos.

## 1. Resumen ejecutivo y decisiones aprobadas

UPCO Admin será una aplicación web alojada en la nube para centralizar las actividades diarias de UPCO de Venezuela. Su primera versión estará orientada a un solo usuario, pero incluirá las cinco áreas desde el inicio mediante procedimientos intencionalmente simplificados.

| DECISIÓN | BASE V1.0 |
|---|---|
| Usuarios | Un único administrador habilitado explícitamente. No hay alta pública ni colaboración entre empleados. |
| Áreas | Administración, procura, TI, proyectos y seguimientos, visibles en la navegación inicial. |
| Autenticación | Inicio de sesión con identidad corporativa Microsoft 365 (Microsoft Entra ID); permitir únicamente la cuenta expresamente autorizada. |
| Despliegue | Nube, usando un entorno de desarrollo/pruebas separado del entorno de producción. |
| Stack de referencia | Next.js + TypeScript + PostgreSQL / Supabase; decisión técnica a confirmar antes de configurar recursos corporativos. |
| Integraciones | No se conectará automáticamente con Outlook, Teams, SharePoint ni GLPI en el MVP. |

### 1.1 Objetivo general

Ofrecer un punto único y confiable donde registrar, priorizar, ejecutar, documentar y dar seguimiento a pendientes de trabajo, solicitudes de compra, incidentes/servicios TI, proyectos y gestiones administrativas.

### 1.2 Objetivos medibles del MVP

- Registrar una actividad en menos de 90 segundos con sus datos mínimos, bajo un escenario de prueba definido.
- Visualizar en una sola pantalla tareas de hoy, vencidas, en espera y próximos seguimientos.
- Conservar el historial básico de acciones relevantes y documentos/enlaces asociados.
- Localizar cualquier registro propio mediante búsqueda, filtros y navegación por área.
- Evitar acceso de cuentas de Microsoft 365 que no estén explícitamente habilitadas.

### 1.3 Alcance funcional resumido

| ÁREA | PROCESO SIMPLIFICADO INCLUIDO | AMPLIACIÓN POSTERIOR |
|---|---|---|
| Administración | Registrar gestiones y compromisos, fechas, responsables externos en texto, referencias y documentos. | Flujos documentales, aprobaciones formales, firmas. |
| Procura | Crear solicitudes, registrar proveedores y cotizaciones básicas, etapas y seguimiento. | Órdenes de compra, evaluaciones, recepción, ERP. |
| TI | Registrar y resolver solicitudes/incidentes, equipo asociado en texto y evidencia. | Inventario detallado, SLA, automatización y GLPI. |
| Proyectos | Crear proyectos, asociar actividades, fechas y estado de avance. | Dependencias, presupuestos, cronogramas Gantt. |
| Seguimientos | Crear próximas acciones/recordatorios vinculados a un registro. | Notificaciones multicanal y automatización. |

## 2. Actores, límites y reglas del sistema

### 2.1 Actor del MVP

Administrador funcional: único usuario que ingresa con su cuenta corporativa Microsoft 365; crea, consulta, edita, archiva y exporta sus registros. Los nombres de empleados, solicitantes, contactos y proveedores se registran como datos de referencia y no equivalen a cuentas con acceso.

### 2.2 Supuestos y dependencias

- UPCO autorizará el registro de una aplicación en su tenant Microsoft Entra ID o proporcionará un administrador que lo configure.
- El administrador inicial se identificará por un ID de usuario Entra inmutable, asociado a una pertenencia autorizada en la aplicación (no solo por correo o dominio).
- Antes de cargar información real, UPCO aprobará proveedor cloud, regiones de almacenamiento, tipos de datos permitidos, período de retención y respaldos.
- El sistema se usará con conexión a Internet; no se exige operación sin conexión en la v1.0.
- Los importes de cotizaciones se registran con moneda; no se calculan conversiones ni totales multimoneda.
- Las acciones de aprobación, compras, recepción y cierre del MVP son registros de seguimiento, no autorizaciones legales ni transacciones ERP.

### 2.3 Fuera de alcance del MVP

No se desarrollarán gestión contable, nómina, facturación, órdenes de compra oficiales, aprobaciones multinivel, control detallado de activos, directorio de usuarios, sincronización bidireccional con Microsoft 365, integración GLPI, aplicación móvil nativa, modo offline, reglas automáticas complejas ni funciones de IA generativa.

## 3. Modelo funcional y reglas transversales

### 3.1 Entidad común: registro de trabajo

La aplicación utilizará un registro base de trabajo (work item) con número, título, descripción, tipo/área, estado, prioridad, sede opcional, proyecto opcional, fechas, usuario responsable, notas y evidencias. Cada módulo agregará solo los campos específicos necesarios. Los seguimientos se vincularán a ese registro de trabajo.

| CAMPO | REGLA DEL MVP |
|---|---|
| Identificador | UUID técnico + código legible por área (p. ej., ADM-0001, PRC-0001, IT-0001). |
| Prioridad | Baja, media, alta, crítica. Valor por defecto: media. |
| Estado general | Pendiente, en progreso, en espera, completada, cancelada. Archivada es una marca de visibilidad separada. |
| Fechas | created_at, updated_at; fecha límite opcional, fecha de cierre al completar, fecha de próximo seguimiento separada. |
| Vencimiento | Es vencido si fecha límite \< fecha local actual y no está completado/cancelado; no constituye un estado editable. |
| Cierre | Requiere fecha de cierre; permite nota opcional de resultado. Reapertura registra evento en historial. |
| Eliminación | Archivar por defecto; borrado definitivo fuera de la interfaz del MVP. |
| Registro histórico | Guardar actor, acción, fecha y cambios críticos (estado, prioridad, fecha límite, etapa específica). |

### 3.2 Navegación y vistas

Menú lateral: Inicio; Mi trabajo; Administración; Procura; Tecnología (TI); Proyectos; Seguimientos; Reportes; Configuración. Acceso universal a Nueva actividad, búsqueda global y filtros por sede, estado, prioridad y fecha. Todas las vistas muestran los datos autorizados de un solo usuario.

### 3.3 Convenciones de aceptación

P0 = indispensable para liberar el MVP. P1 = incluido si cabe en el piloto; podrá diferirse sin impedir el uso básico. Cada requisito incluye un criterio comprobable con un escenario positivo o una restricción observable.

## 4. Requisitos funcionales detallados

### 4.1 Acceso y configuración

| ID / PRIORIDAD | REQUISITO Y COMPORTAMIENTO | CRITERIO DE ACEPTACIÓN |
|---|---|---|
| RF-001 · P0 | **Entrar con Microsoft 365**. El sistema iniciará sesión mediante el proveedor Microsoft/Entra, sin almacenar contraseñas corporativas. | Una cuenta autorizada inicia sesión y accede al panel; la aplicación no solicita contraseña local. |
| RF-002 · P0 | **Lista explícita de acceso**. Después de autenticar, validar una pertenencia habilitada y el identificador del usuario/tenant. | Una cuenta válida del mismo tenant, sin pertenencia, recibe acceso denegado. |
| RF-003 · P0 | **Sesión y salida**. Mantener sesión segura y habilitar Cerrar sesión; rutas privadas requerirán autenticación. | Sin sesión no es posible abrir ni consultar endpoints de datos privados. |
| RF-004 · P0 | **Configuración básica**. Permitir editar nombre visible, zona horaria, sede por defecto y preferencias simples. | Los cambios se persisten y se reflejan tras volver a ingresar. |
| RF-005 · P1 | **Catálogos editables**. Permitir mantener categorías, sedes y etiquetas sin alterar el código. | Es posible agregar una categoría y utilizarla en un nuevo registro. |

### 4.2 Mi trabajo y tareas comunes

| ID / PRIORIDAD | REQUISITO Y COMPORTAMIENTO | CRITERIO DE ACEPTACIÓN |
|---|---|---|
| RF-006 · P0 | **Crear registro de trabajo**. Crear actividad con título, área, descripción opcional, prioridad, estado, sede y fechas opcionales. | Se valida título obligatorio; la actividad aparece de inmediato en el listado. |
| RF-007 · P0 | **Editar y consultar**. Abrir ficha completa y modificar campos; conservar creado/modificado. | La modificación queda persistida y se observa en ficha y lista. |
| RF-008 · P0 | **Estados y cierre**. Cambiar entre estados válidos; registrar cierre y reapertura, sin perder historial. | Al completar, sale de vencidos; al reabrir, vuelve al conjunto activo. |
| RF-009 · P0 | **Buscar y filtrar**. Buscar por código/título y filtrar por área, estado, sede, prioridad y vencimiento. | La combinación de filtros devuelve solo registros que cumplen criterios. |
| RF-010 · P0 | **Panel diario**. Mostrar contadores y listas de hoy, vencidas, en espera y próximos seguimientos. | Las cifras coinciden con consultas de datos de prueba y estados vigentes. |
| RF-011 · P0 | **Bitácora y comentarios**. Añadir notas de evolución con fecha y autor; no sobrescribir notas previas. | Las notas aparecen ordenadas por fecha y son recuperables al reabrir. |
| RF-012 · P0 | **Archivo lógico**. Archivar y restaurar registros sin borrado físico. | Un elemento archivado desaparece de vistas activas y se restaura desde archivo. |
| RF-013 · P1 | **Checklist simple**. Agregar elementos de verificación y marcarlos como cumplidos. | El porcentaje de checklist refleja ítems terminados/total. |
| RF-014 · P1 | **Adjuntos y enlaces**. Adjuntar archivos permitidos y URL de referencia con validación de acceso. | Se puede abrir/bajar un archivo propio; un tercero no autorizado no puede. |
| RF-015 · P1 | **Exportar registros**. Descargar CSV filtrado de tareas y vistas principales. | El CSV mantiene encabezados y valores coincidentes con la vista filtrada. |

### 4.3 Administración

| ID / PRIORIDAD | REQUISITO Y COMPORTAMIENTO | CRITERIO DE ACEPTACIÓN |
|---|---|---|
| RF-016 · P0 | **Crear gestión administrativa**. Registrar tipo de gestión, asunto, referencia, contraparte y fecha compromiso. | La gestión se crea en Administración con código ADM y su ficha específica. |
| RF-017 · P0 | **Control de documentación**. Anotar estado documental (pendiente, recibido, revisado), referencia y enlace. | La ficha permite identificar si la documentación está pendiente. |
| RF-018 · P0 | **Seguimiento de compromisos**. Asignar fechas de seguimiento y resultado a una gestión administrativa. | Un compromiso próximo aparece en Seguimientos e Inicio. |
| RF-019 · P1 | **Listas por tipo/sede**. Filtrar gestiones por tipo, sede y contraparte. | La consulta muestra solo trámites de la selección. |

### 4.4 Procura

| ID / PRIORIDAD | REQUISITO Y COMPORTAMIENTO | CRITERIO DE ACEPTACIÓN |
|---|---|---|
| RF-020 · P0 | **Crear solicitud simple**. Registrar artículo/servicio, cantidad/unidad, sede de destino, necesidad y referencia. | Se obtiene código PRC y se visualizan cantidad y sede. |
| RF-021 · P0 | **Catálogo de proveedores**. Crear/editar proveedor con nombre, contacto, correo y observaciones. | Un proveedor se selecciona desde una solicitud sin duplicarse. |
| RF-022 · P0 | **Cotizaciones manuales**. Registrar una o más cotizaciones: proveedor, importe, moneda, fecha, vigencia y referencia. | La solicitud muestra las ofertas asociadas, cada una con su moneda. |
| RF-023 · P0 | **Etapa comercial básica**. Identificar etapa: por solicitar, solicitado, cotizando, evaluando, decidido, entregado, cancelado. | El historial conserva cada cambio de etapa y fecha. |
| RF-024 · P0 | **Pendientes externos**. Registrar proveedor esperado y próxima fecha de contacto sin enviar correos automáticos. | La respuesta pendiente genera un seguimiento visible y modificable. |
| RF-025 · P1 | **Comparación manual**. Presentar tabla comparativa simple de cotizaciones, sin convertir monedas. | Se pueden visualizar ofertas de distintas monedas sin sumarlas como equivalentes. |
| RF-026 · P1 | **Resultado de solicitud**. Registrar decisión/resultado como nota y fecha; no genera orden oficial. | La decisión se consulta en historial; no se emite OC ni aprobación digital. |

### 4.5 Tecnología y soporte TI

| ID / PRIORIDAD | REQUISITO Y COMPORTAMIENTO | CRITERIO DE ACEPTACIÓN |
|---|---|---|
| RF-027 · P0 | **Registrar incidente o servicio**. Crear ticket simple con tipo, solicitante de referencia, categoría, sede y descripción. | Se asigna código IT y aparece en el módulo de TI. |
| RF-028 · P0 | **Identificar activo informal**. Registrar nombre de equipo, identificador/serial opcional y ubicación en texto. | El ticket puede asociarse a un equipo sin catálogo maestro de activos. |
| RF-029 · P0 | **Registrar diagnóstico y resolución**. Añadir notas de diagnóstico, acciones tomadas y conclusión de cierre. | La ficha permite reconstruir cronológicamente el tratamiento. |
| RF-030 · P0 | **Clasificar impacto y urgencia**. Registrar impacto y urgencia (bajo/medio/alto), además de prioridad de trabajo. | Los campos pueden filtrarse y no alteran automáticamente la prioridad. |
| RF-031 · P1 | **Vista de casos activos**. Filtrar tickets por categoría, sede y estado. | Se identifican los casos abiertos y en espera sin acceder a otras áreas. |

### 4.6 Proyectos

| ID / PRIORIDAD | REQUISITO Y COMPORTAMIENTO | CRITERIO DE ACEPTACIÓN |
|---|---|---|
| RF-032 · P0 | **Crear proyectos**. Registrar código, nombre, descripción, sede, fecha objetivo y estado. | El proyecto aparece en listado y admite nuevas actividades. |
| RF-033 · P0 | **Asociar actividades**. Vincular cualquier registro de trabajo a un proyecto existente. | La ficha del proyecto muestra actividades de diferentes áreas. |
| RF-034 · P0 | **Progreso básico**. Calcular avance como registros completados/total de registros no cancelados; mostrar N/A si no hay registros. | Al completar una actividad, el porcentaje se actualiza; no cuenta canceladas. |
| RF-035 · P1 | **Resumen de proyecto**. Mostrar cantidad de pendientes, en espera, vencidas y cerradas. | Los contadores corresponden a la lista de trabajo vinculada. |

### 4.7 Seguimientos y reportes

| ID / PRIORIDAD | REQUISITO Y COMPORTAMIENTO | CRITERIO DE ACEPTACIÓN |
|---|---|---|
| RF-036 · P0 | **Crear seguimiento asociado**. Programar próximo contacto/acción para un registro existente, con fecha, motivo, destinatario en texto. | El seguimiento queda relacionado con un registro de trabajo. |
| RF-037 · P0 | **Gestionar seguimiento**. Marcar como realizado, posponer o cancelar, con nota de resultado y fecha. | Se conserva fecha programada anterior en historial de cambios. |
| RF-038 · P0 | **Agenda de seguimientos**. Mostrar pendientes para hoy, próximos y vencidos sin duplicar tareas. | El seguimiento aparece una vez y conserva enlace al registro de origen. |
| RF-039 · P0 | **Reportes resumen**. Mostrar recuentos por área/estado y completados por rango de fechas. | Los totales coinciden con datos de prueba y respetan filtros. |
| RF-040 · P1 | **Exportación de reportes**. Exportar CSV de los indicadores y registros utilizados. | Los datos exportados mantienen el rango de fecha y filtros aplicados. |
| RF-041 · P1 | **Calendario**. Presentar vista mensual de fechas límite y seguimientos. | Seleccionar un elemento abre la ficha de origen. |

## 5. Requisitos no funcionales

| ID | ATRIBUTO / REQUISITO | VERIFICACIÓN |
|---|---|---|
| RNF-01 | **Seguridad de transporte**. Todas las rutas de producción usan HTTPS/TLS; sin formularios de contraseña corporativa locales. | Escaneo de rutas y prueba de redirección HTTP→HTTPS. |
| RNF-02 | **Autorización**. Solo identidad Entra permitida y pertenencia vigente; revalidar autorización en cada operación de servidor. | Pruebas positivas y negativas con usuario no autorizado. |
| RNF-03 | **Protección de datos**. RLS habilitado y probado en tablas expuestas; permisos mínimos; archivos privados. | Suite de lectura/escritura denegada para anónimo y cuenta ajena. |
| RNF-04 | **Secretos**. Claves secretas y credenciales solo en servidor/gestor de secretos; sin exponerlas a navegador o repositorio. | Revisión de variables y escaneo de repositorio. |
| RNF-05 | **Trazabilidad**. Registrar acciones críticas con identificador, actor y marca de tiempo UTC; mostrar hora local configurada. | Prueba de cambio de estado, exportación e historial. |
| RNF-06 | **Disponibilidad**. Objetivo operativo piloto ≥99% mensual, condicionado a los SLA del proveedor y conectividad; sin garantía contractual en MVP. | Monitoreo de disponibilidad y registro de incidentes. |
| RNF-07 | **Rendimiento**. En condiciones de prueba fijadas: p95 de listas/panel ≤3 s con 5.000 registros propios; operaciones de guardado ≤3 s sin archivos grandes. | Prueba instrumentada en entorno de staging. |
| RNF-08 | **Compatibilidad**. Últimas 2 versiones estables de Chrome, Edge y Firefox; experiencia útil en móvil ≥360 px. | Matriz manual de navegadores y Playwright. |
| RNF-09 | **Accesibilidad**. Objetivo WCAG 2.2 AA para formularios y navegación del MVP; foco visible, etiquetas y uso por teclado. | Auditoría automatizada y revisión manual de teclado. |
| RNF-10 | **Integridad**. Transacciones atómicas para crear registro con detalle; validación de tipos, rangos, moneda y referencias. | Pruebas de fallos parciales y datos inválidos. |
| RNF-11 | **Respaldo**. Definir y probar restauración antes de producción; meta de diseño RPO ≤24 h y RTO ≤8 h, sujeta al plan cloud aprobado. | Evidencia de política y simulación de recuperación. |
| RNF-12 | **Observabilidad**. Errores centralizados sin registrar tokens ni datos sensibles innecesarios; identificador de correlación para fallas. | Provocar error controlado y revisar telemetría. |
| RNF-13 | **Escalabilidad**. El esquema soporta organization_id, site_id y memberships aunque solo haya un usuario activo. | Prueba de segregación entre organizaciones en datos ficticios. |
| RNF-14 | **Mantenibilidad**. TypeScript estricto, módulos separados, control de versiones, migraciones y pruebas automatizadas en CI. | Pipeline bloquea cambios con pruebas o lint fallidos. |
| RNF-15 | **Retención y residencia**. Retención, ubicación de datos y clasificación corporativa sujetos a aprobación formal previa. | Acta de aprobación documentada antes de datos reales. |
| RNF-16 | **Usabilidad**. Operaciones frecuentes desde Inicio en ≤3 clics de navegación; mensajes claros de error/éxito. | Prueba guiada de 5 escenarios de uso. |

## 6. Reglas de negocio específicas

**RN-01 ·** No existe registro laboral “sin área”: debe pertenecer a Administración, Procura, TI o General; el módulo Proyectos agrupa y Seguimientos programa acciones.

**RN-02 ·** Un registro puede asociarse a cero o un proyecto en el MVP; un proyecto puede contener registros de cualquier área.

**RN-03 ·** La prioridad es seleccionada manualmente y es independiente de impacto/urgencia del ticket TI.

**RN-04 ·** Fecha límite y fecha de seguimiento son datos distintos; posponer un seguimiento no modifica el vencimiento de la tarea.

**RN-05 ·** Las cotizaciones tienen moneda propia; ninguna comparación o reporte suma importes de monedas distintas sin conversión autorizada.

**RN-06 ·** El campo “Aprobado/decidido” de procura es informativo; no equivale a autorización formal de compra.

**RN-07 ·** Un seguimiento requiere un registro de origen, puede ser reprogramado y su historial de fechas debe preservarse.

**RN-08 ·** Completar o cancelar una actividad no elimina automáticamente seguimientos previos: la interfaz propone cerrar pendientes asociados y exige confirmación.

**RN-09 ·** Todos los registros poseen organization_id e identificador de creador; solo el usuario autorizado puede acceder a la organización inicial.

**RN-10 ·** No se permite el registro de dos actividades con igual código; el título puede repetirse.

**RN-11 ·** Los proyectos sin actividades presentan avance “sin datos”, no 100%.

**RN-12 ·** El MVP no permitirá borrar archivos ni registros de manera irreversible desde la interfaz común; se archivará y se requerirá un procedimiento administrativo para purga.

**RN-13 ·** Las fechas se guardan en UTC cuando contienen hora y se presentan en la zona horaria configurada; fechas de vencimiento sin hora se interpretan por día local.

## 7. Flujos principales de usuario

### FU-01 · Inicio de sesión

| ELEMENTO | DESCRIPCIÓN |
|---|---|
| Precondición | Cuenta corporativa autorizada |
| Flujo principal | 1\. Abrir URL de UPCO Admin. 2. Pulsar “Entrar con Microsoft”. 3. Completar autenticación en Entra. 4. Aplicación valida tenant, identificador y membresía habilitada. 5. Redirigir a Inicio. |
| Alternativa / excepción | Si falta permiso de Entra o el administrador no está habilitado: denegar acceso, mostrar mensaje seguro y no crear perfil operativo automático. |
| Requisitos | RF-001 a RF-004 |

### FU-02 · Registro y ejecución de tarea

| ELEMENTO | DESCRIPCIÓN |
|---|---|
| Precondición | Sesión iniciada |
| Flujo principal | 1\. “Nueva actividad”. 2. Seleccionar área y llenar título. 3. Guardar. 4. Añadir fecha, prioridad, notas o checklist. 5. Actualizar estado. 6. Completar o archivar. |
| Alternativa / excepción | Al faltar título: no guardar; al fallar backend: mantener datos de formulario y presentar error recuperable. |
| Requisitos | RF-006 a RF-014 |

### FU-03 · Gestión administrativa

| ELEMENTO | DESCRIPCIÓN |
|---|---|
| Precondición | Sesión iniciada |
| Flujo principal | 1\. Administración → Nueva gestión. 2. Registrar asunto, tipo, contraparte, referencias y compromiso. 3. Crear seguimiento. 4. Registrar documentación y resultados. 5. Completar/archivar. |
| Alternativa / excepción | Si no hay documento: indicar pendiente; no bloquear la creación de la gestión. |
| Requisitos | RF-016 a RF-019, RF-036 a RF-038 |

### FU-04 · Solicitud y cotizaciones

| ELEMENTO | DESCRIPCIÓN |
|---|---|
| Precondición | Sesión iniciada |
| Flujo principal | 1\. Procura → Nueva solicitud. 2. Registrar artículo/servicio, sede, cantidad. 3. Elegir/crear proveedor. 4. Añadir ofertas y moneda. 5. Actualizar etapa. 6. Programar seguimiento. 7. Registrar decisión o entrega. |
| Alternativa / excepción | Sin cotización: solicitud sigue abierta. Cotizaciones en distinta moneda se muestran por separado, sin comparación monetaria total. |
| Requisitos | RF-020 a RF-026, RF-036 |

### FU-05 · Caso de soporte TI

| ELEMENTO | DESCRIPCIÓN |
|---|---|
| Precondición | Sesión iniciada |
| Flujo principal | 1\. TI → Nuevo caso. 2. Registrar solicitante de referencia, sede, dispositivo, tipo e impacto. 3. Anotar diagnóstico. 4. Guardar acciones. 5. Registrar resolución y completar. |
| Alternativa / excepción | Si requiere respuesta externa: pasar a En espera y crear seguimiento; no sincronizar GLPI. |
| Requisitos | RF-027 a RF-031 |

### FU-06 · Proyecto y actividades

| ELEMENTO | DESCRIPCIÓN |
|---|---|
| Precondición | Sesión iniciada |
| Flujo principal | 1\. Proyectos → Nuevo proyecto. 2. Registrar objetivo y fecha. 3. Crear o vincular registros existentes. 4. Revisar avance calculado. 5. Cerrar proyecto cuando corresponda. |
| Alternativa / excepción | Si no hay registros: progreso sin datos; una actividad cancelada se excluye del denominador. |
| Requisitos | RF-032 a RF-035 |

### FU-07 · Seguimiento y revisión diaria

| ELEMENTO | DESCRIPCIÓN |
|---|---|
| Precondición | Existen actividades abiertas |
| Flujo principal | 1\. Abrir Inicio. 2. Revisar vencidas, hoy y seguimientos. 3. Abrir registro de origen. 4. Añadir resultado de contacto. 5. Marcar seguimiento hecho o reprogramarlo. |
| Alternativa / excepción | Reprogramación no cambia fecha límite; seguimiento vencido sigue visible hasta cerrarse. |
| Requisitos | RF-010, RF-036 a RF-039 |

## 8. Diseño preliminar de pantallas

| PANTALLA | COMPONENTES MÍNIMOS | ACCIÓN PRIMARIA |
|---|---|---|
| Acceso | Identidad UPCO Admin; botón Microsoft 365; error acceso denegado. | Entrar. |
| Inicio | Resumen por estado, vencimientos, agenda de seguimientos, accesos rápidos. | Nueva actividad. |
| Mi trabajo | Tabla/lista, filtros, búsqueda, vistas activas/archivadas. | Crear/editar actividad. |
| Administración | Listado de gestiones; formulario con contraparte, referencia y estado documental. | Nueva gestión. |
| Procura | Solicitudes, etapas, proveedores, cotizaciones por solicitud. | Nueva solicitud. |
| TI | Tickets, impacto/urgencia, referencia de equipo, diagnóstico. | Nuevo caso. |
| Proyectos | Lista, ficha, tareas vinculadas y progreso. | Nuevo proyecto. |
| Seguimientos | Agenda de pendientes y vencidos; marcar realizado o reprogramar. | Nuevo seguimiento. |
| Reportes | Contadores por área/estado, completados por período. | Aplicar filtros. |
| Configuración | Perfil, zona horaria, sede y catálogos disponibles. | Guardar preferencias. |

## 9. Arquitectura y modelo de datos lógico

### 9.1 Diseño de referencia

Cliente: interfaz Next.js/React en navegador. Servidor: handlers/funciones Next.js para validar sesiones, permisos, reglas y operaciones. Identidad: autenticación Microsoft Entra ID mediante Azure OAuth de Supabase Auth (alternativa a SAML empresarial). Persistencia: PostgreSQL/Supabase con RLS. Archivos: bucket privado con políticas de acceso y URLs firmadas. Despliegue: infraestructura cloud aprobada; staging separado de producción.

La modalidad Azure OAuth requiere registro de app en Entra, permisos del administrador correspondiente, URI de redirección y configuración del proveedor en Supabase. No se debe asumir que la organización ya concedió esos permisos. La validación de la sesión y la autorización por fila se hacen siempre en el servidor/DB, no solo ocultando botones en la UI.

### 9.2 Entidades principales

| ENTIDAD | CAMPOS ESENCIALES / RELACIONES |
|---|---|
| organizations | id, name; contexto corporativo inicial. |
| sites | id, organization_id, code, name; sedes Maracaibo, El Tigre y otras autorizadas. |
| user_profiles | user_id (Auth), entra_tenant_id, entra_object_id, display_name, timezone. |
| memberships | id, organization_id, user_id, role, active; lista de acceso explícita. |
| projects | id, organization_id, code, name, description, site_id, target_date, status. |
| work_items | id, organization_id, code, type, title, description, status, priority, project_id?, site_id?, due_date?, creator_id, closed_at?, archived_at?. |
| admin_details | work_item_id (1:1), procedure_type, counterpart_name, reference, document_status. |
| procurement_details | work_item_id (1:1), item_description, quantity, unit, destination_site_id, commercial_stage, decision_note. |
| vendors | id, organization_id, name, contact_name, email, phone, notes. |
| quotations | id, procurement_work_item_id, vendor_id, amount DECIMAL, currency ISO, quote_date, valid_until, notes, document_link. |
| it_details | work_item_id (1:1), ticket_type, requester_name, asset_label, asset_serial, impact, urgency, resolution. |
| follow_ups | id, work_item_id, scheduled_for, contact_name, reason, status, outcome, performed_at. |
| comments | id, work_item_id, author_id, body, created_at. |
| attachments | id, work_item_id, storage_path/URL, filename, MIME type, created_by, created_at. |
| activity_log | id, organization_id, work_item_id?, entity, action, before/after JSON, actor_id, occurred_at. |
| categories | id, organization_id, module, name, active; listas editables cuando se habiliten. |

### 9.3 Índices, restricciones y integridad

- Claves foráneas sobre organization_id, project_id, site_id, work_item_id y vendor_id; índices por usuario/organización, status, due_date y scheduled_for.
- Código único dentro de organización y tipo; identificadores UUID como claves internas.
- Comprobación de amount ≥0, quantity \>0; moneda ISO 4217 y etapas dentro del conjunto permitido.
- Comprobación de consistencia de type con la tabla de detalle respectiva, aplicada en lógica transaccional y con restricciones cuando corresponda.
- En todas las consultas y reglas de RLS, la pertenencia a la organización determina acceso, aunque inicialmente solo exista una membresía habilitada.

### 9.4 Integraciones futuras (no MVP)

Microsoft Graph (Outlook, Teams, To Do), SharePoint/OneDrive y API GLPI podrán incorporarse como adaptadores aislados. En el MVP solo se permiten enlaces manuales y carga de archivos aprobados; no se solicitarán permisos de lectura del correo corporativo.

## 10. Backlog priorizado del MVP

Los elementos P0 son obligatorios para liberar; P1 forman parte del alcance deseable y se ajustarán de acuerdo con la capacidad real. La numeración de sprint muestra el orden recomendado y no supone un compromiso de calendario. Cada backlog referencia requisitos y tiene una definición de terminado objetiva en la sección 11.

| ID | PR. | SPR. | ENTREGABLE / HISTORIA TÉCNICA | TRAZA RF/RNF | DEP. |
|---|---|---|---|---|---|
| BL-01 | P0 | S0 | Configurar repositorio, CI, ambientes y documentación inicial | RNF-14 | BL-02 |
| BL-02 | P0 | S0 | Provisionar entorno de desarrollo/staging cloud aprobado | RNF-15 | — |
| BL-03 | P0 | S1 | Registrar app Entra y configurar OAuth Microsoft | RF-001 | BL-02 |
| BL-04 | P0 | S1 | Implementar acceso denegado, allowlist y sesión | RF-002, RF-003 | BL-03 |
| BL-05 | P0 | S1 | Crear migración inicial (organización, sede, perfil, membresía) | RNF-02, RNF-13 | BL-02 |
| BL-06 | P0 | S1 | Crear permisos RLS, pruebas negativas y políticas de seguridad | RNF-03 | BL-05 |
| BL-07 | P0 | S1 | Crear estructura responsive y menú de cinco áreas | RNF-08, RNF-16 | BL-04 |
| BL-08 | P0 | S1 | Crear registro universal, formularios y validaciones | RF-006, RF-007 | BL-05 |
| BL-09 | P0 | S1 | Implementar estados, cierre, reapertura y archivado | RF-008, RF-012 | BL-08 |
| BL-10 | P0 | S1 | Implementar notas e historial de eventos | RF-011, RNF-05 | BL-08 |
| BL-11 | P0 | S2 | Crear vista Mi trabajo, búsqueda y filtros | RF-009 | BL-08 |
| BL-12 | P0 | S2 | Construir panel de hoy, vencidas y en espera | RF-010 | BL-09 |
| BL-13 | P0 | S2 | Crear gestiones administrativas y detalle documental | RF-016, RF-017 | BL-08 |
| BL-14 | P0 | S2 | Registrar compromisos administrativos y vínculos | RF-018 | BL-13 |
| BL-15 | P0 | S2 | Crear proveedores y sus datos mínimos | RF-021 | BL-05 |
| BL-16 | P0 | S2 | Crear solicitudes de procura | RF-020 | BL-08 |
| BL-17 | P0 | S2 | Registrar cotizaciones manuales y monedas | RF-022 | BL-15, BL-16 |
| BL-18 | P0 | S2 | Gestionar etapas y espera comercial | RF-023, RF-024 | BL-16 |
| BL-19 | P0 | S3 | Crear casos de soporte TI | RF-027, RF-028 | BL-08 |
| BL-20 | P0 | S3 | Implementar diagnóstico, resolución e impacto/urgencia | RF-029, RF-030 | BL-19 |
| BL-21 | P0 | S3 | Crear proyectos y vincular registros | RF-032, RF-033 | BL-08 |
| BL-22 | P0 | S3 | Calcular avance básico y estados del proyecto | RF-034 | BL-21 |
| BL-23 | P0 | S3 | Crear seguimientos vinculados y reprogramación | RF-036, RF-037 | BL-08 |
| BL-24 | P0 | S3 | Implementar agenda de seguimientos | RF-038 | BL-23 |
| BL-25 | P0 | S4 | Integrar contadores del dashboard y reportes resumen | RF-039 | BL-12, BL-24 |
| BL-26 | P0 | S4 | Implementar preferencias de usuario y sede | RF-004 | BL-04 |
| BL-27 | P0 | S4 | Pruebas E2E de los 7 flujos, seguridad y accesibilidad | RNF-02, RNF-09 | BL-25 |
| BL-28 | P0 | S4 | Definir respaldos, restauración, monitoreo y despliegue | RNF-06, RNF-11 | BL-27 |
| BL-29 | P1 | S5 | Checklists y adjuntos privados | RF-013, RF-014 | BL-08 |
| BL-30 | P1 | S5 | Filtros avanzados de administración y TI | RF-019, RF-031 | BL-13, BL-19 |
| BL-31 | P1 | S5 | Comparador manual y registro de resultado de procura | RF-025, RF-026 | BL-17 |
| BL-32 | P1 | S5 | Resumen adicional de proyectos | RF-035 | BL-22 |
| BL-33 | P1 | S5 | Exportaciones CSV y calendario | RF-015, RF-040, RF-041 | BL-25 |
| BL-34 | P1 | S5 | Catálogos editables | RF-005 | BL-05 |

### 10.1 Dependencias que condicionan el inicio

1. Permiso administrativo para registrar y configurar una aplicación Entra (o acceso a quien pueda hacerlo).
2. Autorización de UPCO del proveedor, uso de nube y clases de datos que podrán almacenarse.
3. Definir los valores de catálogos iniciales: áreas, sedes, tipos de trámite, categorías TI y etapas de procura.
4. Contar con al menos 10 registros de prueba sintéticos por área para los escenarios de aceptación.
5. Establecer el nombre/dominio de la aplicación y el procedimiento de recuperación del acceso del administrador único.

## 11. Plan de releases y definición de terminado

| ETAPA | ENTREGA VERIFICABLE / SALIDA |
|---|---|
| Sprint 0 · Fundamentos | Decisiones técnicas, aprobación cloud, repo, CI y backlog refinado; ninguna información real en entorno de pruebas. |
| Sprint 1 · Núcleo | Acceso M365, RLS, perfil, alta/edición/archivo de registros, bitácora y navegación; datos persistentes. |
| Sprint 2 · Operaciones A | Administración y procura simplificadas, proveedores, cotizaciones, panel inicial. |
| Sprint 3 · Operaciones B | TI, proyectos, seguimientos, agenda, progreso simple. |
| Sprint 4 · Consolidación | Reportes, pruebas integrales, seguridad, rendimiento, backup y piloto productivo autorizado. |
| Sprint 5 · Mejoras opcionales | Checklist, adjuntos, comparador, exportaciones, calendario y filtros avanzados. |

### 11.1 Definition of Done por historia

1. Requisito e identificador referenciados desde el ticket o pull request.
2. Validación de entrada y de autorización implementadas del lado del servidor.
3. Cambios de esquema gestionados con migración reproducible y políticas RLS, cuando apliquen.
4. Pruebas unitarias o de integración relevantes pasando y caso de error/permiso denegado cubierto.
5. Prueba manual en escritorio y móvil con mensajes claros de validación y error.
6. Revisión de código, no exposición de secretos y registro de cambio actualizado.
7. Criterio de aceptación del requisito demostrado con evidencia o captura.

### 11.2 Pruebas mínimas de liberación

| PRUEBA | RESULTADO ESPERADO |
|---|---|
| Cuenta Entra no habilitada | No accede a rutas privadas ni datos por API. |
| Usuario sin sesión | Redirigido a inicio; operaciones privadas denegadas. |
| Tarea vencida | Aparece en vencidas mientras siga activa; al completar desaparece. |
| Seguimiento reprogramado | Conserva historial y no altera fecha límite principal. |
| Solicitud con 2 monedas | Ambas cotizaciones visibles; sin total o comparación engañosa. |
| Caso TI en espera | Se muestra en TI y agenda si tiene seguimiento. |
| Proyecto con 0, 1, 3 tareas | Muestra sin datos, 0% o porcentaje conforme a cierres. |
| Archivo/restauración | Registro deja vista activa y vuelve con datos intactos. |
| RLS datos ajenos | Consultas de un segundo usuario de prueba no devuelven datos no autorizados. |
| Backup/restauración | Se recupera una muestra de datos desde respaldo en ensayo. |

## 12. Riesgos, mitigaciones y control de cambios

| RIESGO | IMPACTO | MITIGACIÓN |
|---|---|---|
| Acceso Entra sin permisos de administrador | Bloquea autenticación | Solicitar permiso temprano; preparar ambiente con cuentas sintéticas y validar callback. |
| Uso de nube no aprobado para ciertos datos | Bloquea producción | Clasificación de datos y autorización formal antes de almacenar información real. |
| MVP sobrecargado con cinco áreas | Retraso y defectos | Limitar cada módulo a un flujo manual, registro y seguimiento; P1 diferible. |
| Proveedor de nube o región inadecuados | Cumplimiento / continuidad | Evaluar residencia, política de respaldo, SLA, costos y exportación de datos. |
| Datos sensibles en archivos y bitácoras | Exposición | Bucket privado, permisos mínimos, tamaño/tipo permitido, sanitizar logs. |
| Dependencia de un solo administrador | Continuidad operativa | Procedimiento documentado de recuperación y transferencia de propiedad técnica. |
| Monedas y etapas mal interpretadas | Decisiones incorrectas | No convertir monedas y rotular registro informativo sin valor de aprobación formal. |

### 12.1 Gestión de cambios

Los requisitos P0 y las cinco áreas constituyen la línea base. Toda ampliación posterior se documentará como solicitud de cambio con identificador, justificación, área afectada, impacto en seguridad y modelo de datos, estimación, versión destino y aprobación. Las integraciones se analizarán como proyectos separados y no bloquearán el MVP.

### 12.2 Criterios de salida del MVP

- Todos los RF P0 ejecutados y aprobados en su criterio de aceptación.
- Siete flujos completos ejercitados con datos sintéticos; sin defectos bloqueantes.
- Acceso y RLS validados con casos negativos; no quedan secretos expuestos.
- Restauración ensayada, monitoreo activo y procedimiento de incidente documentado.
- Autorización corporativa para alojamiento y tratamiento de información obtenida.
- Manual breve de uso y registro de problemas conocidos disponibles.

## 13. Referencias técnicas

**Supabase: Inicio de sesión con Azure/Microsoft:** https://supabase.com/docs/guides/auth/social-sign-in/auth-azure

**Supabase: Row Level Security:** https://supabase.com/docs/guides/database/postgres/row-level-security

**Microsoft Learn: Redirect URI y registro de aplicaciones:** https://learn.microsoft.com/entra/identity-platform/reply-url

**Microsoft Learn: Flujo OAuth 2.0 Authorization Code:** https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow

**Next.js: Authentication and authorization:** https://nextjs.org/docs/app/guides/authentication

Nota técnica: los procedimientos y precios de servicios cloud pueden cambiar. Antes de implementar se verificará nuevamente la documentación de los proveedores y las condiciones del tenant corporativo.

## Anexo A. Mapa de trazabilidad resumido

| ÁREA | REQUISITOS | PRIMERA ENTREGA |
|---|---|---|
| Identidad/configuración | RF-001–005 | S1 / S4 |
| Núcleo de tareas | RF-006–015 | S1–S2 (P0), S5 (P1) |
| Administración | RF-016–019 | S2 (P0), S5 (P1) |
| Procura | RF-020–026 | S2 (P0), S5 (P1) |
| TI | RF-027–031 | S3 (P0), S5 (P1) |
| Proyectos | RF-032–035 | S3 (P0), S5 (P1) |
| Seguimientos/reportes | RF-036–041 | S3–S4 (P0), S5 (P1) |
| Seguridad/calidad | RNF-01–16 | Transversal; gate final S4 |

## Anexo B. Datos sintéticos para prueba funcional

- Administración: “Preparar informe de recepción de equipos”, sede Maracaibo, documentos en revisión, próximo seguimiento mañana.
- Procura: “Cotización de UPS para oficina”, dos proveedores de ejemplo, precios ficticios y moneda registrada.
- TI: “Configurar laptop para nuevo colaborador”, solicitante ficticio, activo etiquetado, diagnóstico y cierre.
- Proyectos: “Organización de inventario TI”, tres actividades, una completada, una abierta y una cancelada.
- Seguimientos: “Solicitar estado de oferta”, asociado a la solicitud de procura, reprogramado una vez.
