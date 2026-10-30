# Datos de solicitante y número de parte

**Objetivo:** Registrar en cada solicitud PRC el número de parte opcional y el nombre, apellido y área del solicitante.

**Decisiones:** Las seis áreas son las ya autorizadas para proveedores. El número de parte es opcional para servicios; nombre, apellido y área son obligatorios para nuevas solicitudes. Las filas antiguas conservan `NULL` y el creador puede completarlas desde la ficha.

**Persistencia:** La primera migración amplía `procurement_details`, agrega una función de alta con los cuatro campos y restringe la edición al creador; conserva temporalmente la función anterior durante el despliegue. La segunda migración, tras comprobar la interfaz nueva, retira la función anterior y exige solicitante también en inserciones directas. Los cambios se auditan.

**Interfaz:** El formulario muestra los cuatro campos; la ficha los presenta y permite completarlos o editarlos. Las consultas de lista y ficha incluyen los nuevos datos.

**Verificación:** Pruebas Zod y de acciones; pruebas SQL de alta, obligatoriedad, autorización y edición; pruebas de render; suite completa, migración en staging con prueba reversible y comprobación de rutas publicadas.
