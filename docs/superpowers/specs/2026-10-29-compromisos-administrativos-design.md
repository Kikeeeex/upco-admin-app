# BL-14 · Compromisos administrativos

## Intención

Permitir que una gestión ADM tenga seguimientos fechados con una persona de contacto, motivo y resultado. Una gestión puede tener varios seguimientos; el compromiso principal permanece en `work_items.due_date`.

## Enfoques

- Añadir una sola fecha y resultado a `admin_details`: simple, pero pierde la secuencia de contactos y no permite reprogramaciones con historial.
- Crear `follow_ups` vinculados al registro ADM: conserva cada compromiso y prepara el modelo general previsto para BL-23. **Elegido** por la especificación.

## Comportamiento

- Desde la ficha ADM, el creador programa un seguimiento con fecha, contacto y motivo. Puede registrar un resultado o reprogramar uno pendiente. La fecha del compromiso principal no cambia.
- La ficha muestra todos los seguimientos enlazados. Seguimientos muestra pendientes y vencidos de gestiones activas; Inicio muestra los próximos cinco, incluidos los vencidos.
- Los miembros de la misma organización pueden leer. Solo el creador de la gestión activa puede escribir. RLS impide acceso entre organizaciones, escritura sobre gestiones archivadas y borrado ordinario.
- Se auditan creación, resultado y reprogramación. Las fechas sin hora se tratan como días locales en la zona del perfil.

## Límites

BL-14 cubre gestiones administrativas. BL-23 extenderá los seguimientos a otras áreas. No hay notificaciones, calendarios externos ni carga de archivos.
