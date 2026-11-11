# Revisión de casos especiales del TXT IVA · 9 de noviembre de 2026

**Resultado:** mantener los bloqueos actuales. No se encontró una especificación primaria vigente que indique cómo representar de forma segura estos dos casos en el TXT de SENIAT sin ensayo o confirmación del portal.

## Una factura con bases al 16 % y 8 %

El instructivo técnico elaborado por SENIAT para la declaración informativa de retenciones IVA tiene un solo campo de base imponible y un solo campo de alícuota por línea (columnas 10 y 15). También advierte que un número de control repetido en el archivo o en su base de datos es un error. Separar una factura en dos líneas con el mismo número de control parece chocar con esa validación; combinar las bases en una línea obligaría a elegir una sola alícuota y daría un cálculo incorrecto. No hay regla primaria localizada que resuelva esa representación. Por ello no se cambió el bloqueo del exportador.

## Nota de crédito que ajusta otra quincena o mes

El instructivo técnico de SENIAT dice que una nota de crédito debe corresponder a una factura registrada para el período declarado. La Providencia SNAT/2025/000054, artículo 11, distingue si el impuesto retenido en exceso ya fue enterado: antes de enterarlo, el agente devuelve al proveedor lo retenido en exceso; después, el proveedor lo descuenta de su cuota o solicita recuperación. No basta con insertar una línea negativa en la siguiente quincena sin determinar ese estado y comprobar que el portal la acepte. El bloqueo actual evita declararla automáticamente de forma incorrecta.

## Validación pendiente

Para desbloquear cualquiera de estos casos hace falta una especificación técnica vigente del portal o una prueba controlada de carga con una factura mixta real y una nota referida a período anterior, registrando los mensajes de aceptación/rechazo. En las notas, además hay que saber si la retención original ya fue enterada. Hasta entonces deben revisarse manualmente, sin crear líneas TXT inventadas ni duplicar números de control.

Fuentes primarias: [Instructivo técnico SENIAT para declaración de retenciones IVA, septiembre de 2020, pp. 8–9 y 21–22](https://es.readkong.com/page/instructivo-declaracion-retenciones-de-iva-seniat-4300855); [Gaceta Oficial N.º 43.171, Providencia SNAT/2025/000054, artículos 11 y 15](https://soytecnologia.com/app/Descargas/PA0054-Ret-IVA.-GO43171.pdf). Ambos documentos se consultaron en copias públicas del texto oficial.
