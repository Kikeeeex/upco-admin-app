# UPCO Compras: entrega integral, 10-11-2026

Esta carpeta contiene la versión local Windows/LAN de UPCO Compras, el código fuente, los modelos aportados por UPCO y la documentación funcional y fiscal. Es una entrega de referencia para la implementación de V2; no sustituye el código existente de `upco-admin-app` ni instala automáticamente en el servidor.

## Archivos

- `UPCO-Compras-Codigo-Completo.zip`: código fuente, migraciones, scripts, activos y consolidado de 347 proveedores. Se puede descargar directamente.
- `UPCO-Entrega-Integral-20261110.zip.001` a `.007`: el ZIP completo dividido para superar el límite de 32 MB por archivo. Incluye el código, instalador Windows/LAN, modelos y documentación.
- `RECONSTRUIR-UPCO.ps1`: une las siete partes y comprueba el SHA-256 del ZIP final.
- `SHA256-PARTES.txt`: hash y tamaño de cada parte y del ZIP de código.

Para reconstruir, descarga **las siete partes** y `RECONSTRUIR-UPCO.ps1` a la misma carpeta. En PowerShell ejecuta:

```powershell
powershell -ExecutionPolicy Bypass -File .\RECONSTRUIR-UPCO.ps1
```

El SHA-256 esperado de `UPCO-Entrega-Integral-20261110.zip` es `1bdcfa10fb5124acb43e9882aec5dc3978e25cd688fd051645f2d23b8da2938f`.

Empieza por `LEEME-PRIMERO.md` dentro del ZIP. La documentación distingue reglas implementadas de validaciones fiscales pendientes. Los TXT/XML reales y la macro son muestras aportadas por UPCO; **su aceptación actual por SENIAT no está verificada**. Los PDF normativos originales se enlazan en `normativa/ENLACES.md`; no están incorporados porque no se pudieron descargar durante el empaquetado.

Esta entrega contiene datos fiscales de proveedores, ejemplos reales y firma/sello escaneados. UPCO autorizó expresamente su publicación en este repositorio público el 10-11-2026.

