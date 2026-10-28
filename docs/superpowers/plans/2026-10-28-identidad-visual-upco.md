# Identidad visual UPCO — Plan de implementación

**Objetivo:** sustituir la marca provisional de UPCO Admin por el logo entregado y aplicar colores, tipografía y reglas de uso del manual cuando esté disponible.

**Fuente:** `Uso_correcto_del_logo.zip` contiene tres PNG transparentes: verde, oscuro y claro. El manual PDF comprimido, «Uso correcto del logo de upco», establece verde `#0B4B32`, oscuro `#041914` y gris `#EDEDED`; Satoshi para títulos y Helvetica Neue para textos complementarios. Las imágenes PNG tienen valores cercanos por exportación (`#0C4C33`, `#0E1914`, `#EEF0F1`).

**Arquitectura:** mantener los archivos de logo originales sin modificar, servirlos desde `public/brand` y usar `next/image` con dimensiones y proporciones explícitas. Usar la variante clara sobre fondo oscuro y la verde sobre fondo claro, con espacio de reserva. Convertir a WOFF2 el Satoshi adjunto por el usuario y servirlo localmente; solicitar Helvetica Neue al sistema con Helvetica/Arial de alternativa, porque no está confirmada la licencia para publicar sus archivos en este repositorio público. Centralizar la paleta en variables CSS, comprobar contraste y conservar navegación y formularios existentes.

## Pasos

- [x] Copiar las variantes necesarias sin editar el arte original y reemplazar el monograma provisional en acceso y navegación.
- [x] Leer el manual de marca comprimido; aplicar reglas verificadas de color, tipografía y fondos. El manual exige legibilidad y área de reserva, pero no da tamaño mínimo numérico.
- [x] Revisar login, panel y móvil; ejecutar 31 pruebas, typecheck, lint y build. Playwright comprobó carga del logo, Satoshi y ausencia de desplazamiento horizontal a 1440 y 390 píxeles, además del tamaño del logo a 800 píxeles. La revisión independiente motivó un contorno de foco claro sobre fondos oscuros.
- [x] Publicar en staging y comprobar recursos estáticos y rutas. El PNG verde coincide byte por byte, CSS y WOFF2 responden y las rutas privadas conservan redirección sin sesión.

**Límite de esta entrega:** el logo se muestra con su proporción original; no se dibuja un monograma alterno ni se usan versiones deformadas. El usuario eligió fuente del sistema para Helvetica Neue hasta confirmar derechos de publicación en el repositorio público.
