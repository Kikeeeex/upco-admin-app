# Entrega integral UPCO Compras — 10 de noviembre de 2026

## Qué contiene

- `UPCO-Compras-Codigo-Completo.zip`: código fuente de la versión local Windows/LAN, migraciones, scripts, activos gráficos y el consolidado de 347 proveedores. No incluye la base viva, contraseñas ni sesiones.
- `UPCO-Compras-Windows-LAN.zip`: aplicación compilada para Windows 10/11 con Node 24 integrado. Es un payload para preparar la actualización; **no es un actualizador de doble clic** y no se ha instalado en UPCO SERVER con esta entrega. El script anterior de actualización tiene nombres de ZIP fijos y debe adaptarse antes de utilizarlo con este paquete.
- `modelos/`: comprobantes IVA e ISLR aportados por UPCO, libro original 0201C/0202C, libro en blanco basado en él, hoja de importación, libro histórico, macro ISLR y TXT/XML reales de octubre de 2026 como referencias. La aceptación de esos archivos en SENIAT no se verificó.
- `documentacion/`: reglas implementadas, especificaciones de salida, matriz de validación fiscal, fuentes y decisiones de producto.
- `normativa/`: enlaces a textos normativos y manuales originales. Los PDF legales no se duplicaron dentro del ZIP porque la red del entorno de empaquetado no permitió descargarlos.

## Versión y alcance

Esta entrega incorpora varios usuarios con permisos por tarea. El usuario existente más antiguo se convierte en **master** al aplicar la migración `0010_user_permissions.sql`; los nuevos usuarios se crean desde **Usuarios**. Solo el master cambia normas fiscales y correlativos. Un permiso separado permite administrar CECO y cuentas. Los PDF nuevos se descargan con `Razón social - Fact. Nro. N - IVA retenido.pdf`, `... - ISLR retenido.pdf` o `... - IVA e ISLR retenidos.pdf`.

El código y los modelos documentan el comportamiento actual; **no constituyen homologación del portal SENIAT ni dictamen de vigencia fiscal**. Revise `documentacion/VALIDACIONES-PENDIENTES.md` antes de declarar con archivos generados. La revisión de fuentes se hizo el 10/11/2026; los cambios posteriores requieren nueva comprobación.

## Para la persona que implementa V2

1. Leer `documentacion/CONTEXTO-Y-DECISIONES.md` y `documentacion/REGLAS-CALCULO.md`.
2. Comparar `documentacion/FORMATOS-SALIDA.md` y los archivos de `modelos/` con un archivo aceptado recientemente por el portal y con el libro que UPCO apruebe.
3. Resolver y registrar las decisiones enumeradas en `documentacion/VALIDACIONES-PENDIENTES.md` antes de cambiar cálculos o declarar un formato aceptado.
4. Trabajar sobre `UPCO-Compras-Codigo-Completo.zip`; la versión Vercel anterior no reemplaza esta versión local ni está sincronizada con estas funciones.

El listado de proveedores tiene datos fiscales personales/comerciales y los modelos incluyen firma y sello. Entregue este paquete solo a quienes trabajen en UPCO.
