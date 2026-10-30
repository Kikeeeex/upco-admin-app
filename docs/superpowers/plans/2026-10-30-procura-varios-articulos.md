# Varios artículos por solicitud de procura

**Objetivo:** Permitir que una solicitud PRC contenga varios artículos o servicios del mismo proveedor.

**Modelo:** Una nueva tabla `procurement_request_items` guarda cada renglón con artículo, número de parte opcional, cantidad, unidad y orden. La migración convierte cada solicitud existente en un primer renglón sin alterar sus datos. Proveedor, sede, necesidad, referencia y solicitante siguen a nivel de solicitud.

**Compatibilidad:** La función actual de alta se conserva durante el despliegue y un trigger agrega automáticamente su primer renglón. La nueva función transaccional recibe un arreglo de 1 a 50 renglones y crea toda la solicitud en una operación; si un renglón falla, no queda una solicitud parcial. Los campos legados del primer renglón permanecen sincronizados para el formulario anterior.

**Interfaz:** El formulario permite añadir y quitar renglones antes de guardar; cada uno exige artículo, cantidad y unidad. La lista muestra el primer artículo y el número total; la ficha muestra todos los renglones. El número de parte del primer renglón sigue siendo editable desde la ficha existente.

**Pruebas:** Validación de renglones, entrada maliciosa/defectuosa y límites; alta atómica de varios renglones, migración de solicitudes previas, RLS, compatibilidad de alta antigua, render del formulario y ficha, suite completa y staging con rollback.
