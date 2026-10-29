# BL-13: gestiones administrativas y documentación

## Intención

Entregar el primer flujo de Administración del MVP: crear gestiones con código ADM, consultarlas en su propia área y registrar el estado de su documentación. Se basa en RF-016, RF-017, FU-03 y el modelo `admin_details` de la especificación.

## Alcance

- Crear una gestión con asunto, tipo de trámite y contraparte obligatorios; referencia, fecha de compromiso, descripción, sede y datos documentales opcionales.
- Mostrar una lista de gestiones activas y una ficha propia con código ADM, datos generales, compromiso, estado documental y enlace seguro a documento externo.
- Permitir editar los datos documentales y los campos generales al creador. Conservar la bitácora y el archivo ya disponibles en Mi trabajo.
- Permitir estado documental pendiente, recibido o revisado. Una gestión sin documento empieza pendiente y puede crearse.

## Límites y decisiones

- La especificación separa `admin_details` de `work_items`; se conserva esa relación 1:1. El compromiso usa `work_items.due_date`, para que el panel y los filtros existentes lo incluyan sin duplicar fechas.
- La creación de ambas filas ocurre en una función PostgreSQL invocadora en una transacción. Un trigger de restricción diferido exige la ficha también para inserciones directas en `work_items`. RLS y los permisos de columna siguen aplicando. Los cambios de detalle se auditan como eventos `updated` y el historial describe sus campos.
- La referencia documental es texto y el enlace es una URL HTTPS o HTTP; no se cargan archivos en BL-13. BL-14 añadirá seguimientos y resultados de compromisos.
- Los tipos de gestión y contraparte quedan como texto libre validado porque el MVP no define un catálogo ni opciones cerradas.
- La migración debe aplicarse antes de publicar la interfaz. Una prueba local con PostgreSQL y RLS precede a la aplicación remota.

## Enfoques considerados

- **Tabla de detalle 1:1 y función de creación (elegido):** sigue el modelo del MVP, mantiene la creación atómica y permite ampliar Administración sin cargar `work_items` con columnas específicas.
- **Columnas en `work_items`:** simplifica la escritura pero contradice la separación prevista y mezcla campos de cada área.
- **Dos escrituras desde la interfaz:** mantiene tablas separadas pero puede dejar una gestión sin detalle si falla la segunda escritura.

## Criterios

Crear una gestión produce un código ADM y su ficha específica. La ficha deja claro si falta documentación y conserva los datos al editar. Un miembro ajeno no puede insertar ni alterar el detalle, y la creación fallida no deja una gestión incompleta.
