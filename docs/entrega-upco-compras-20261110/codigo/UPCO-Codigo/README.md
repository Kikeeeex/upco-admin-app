# UPCO · Compras y retenciones

Aplicación de navegador para el servidor físico de UPCO. Se ejecuta localmente con Node.js 24 y SQLite; Tailscale Serve da acceso privado desde otros equipos de la red de UPCO. No depende de ChatGPT Sites.

## Funciones

- Proveedores con RIF y datos fiscales; la auditoría de importación es informativa y no bloquea la emisión.
- Facturas de compra y notas de crédito/débito con bases al 16 % y 8 %, exento, IGTF calculado al 3 % de su propia base, IVA, ISLR, fecha de operación y período.
- Descripción obligatoria (10 a 2.000 caracteres), cuenta de pago obligatoria y distribución entre CECO activos que suma exactamente 100 %.
- Catálogos editables de CECO y cuentas; un correlativo continuo para IVA y otro para ISLR, con control de duplicados y reutilización de números liberados.
- Comprobantes PDF, libro de compras XLSX mensual/quincenal con hoja adicional de distribución contable, TXT IVA quincenal, XML ISLR y hoja `retISLR` con las ocho columnas de carga de la macro histórica de UPCO.
- Adjuntos locales privados, sesiones y auditoría de cambios. El primer usuario es master; desde Usuarios crea operadores y asigna permisos individuales. Solo master cambia reglas fiscales y correlativos; el permiso `catalogs.manage` permite administrar CECO y cuentas.
- Los PDF de retención se nombran con razón social, `Fact. Nro.` e impuestos retenidos; el número de comprobante permanece dentro del archivo.

## Proveedores anteriores

`import/suppliers.json` consolida 347 proveedores: 345 derivados de comprobantes y registros complementarios, más Inversiones Pelagias y Supermercado Todos los Días Zheng con los RIF aportados por Elio el 9 de noviembre de 2026. El proveedor más reciente por RIF prevalece y conserva fuente, fecha y confianza. Los datos cargados se usan sin aprobación fiscal adicional; la auditoría sigue mostrando los campos inferidos para consulta. `scripts/import-suppliers.mjs` inserta por RIF de forma idempotente y preserva correcciones manuales al repetirlo; `--update-existing` permite reemplazar datos con el consolidado de forma explícita.

## Arranque de desarrollo

```powershell
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm admin:create
pnpm dev
```

Abre `http://127.0.0.1:3000`. La contraseña se solicita en terminal y no existe una contraseña predeterminada. `UPCO_DATA_DIR` permite elegir una carpeta persistente fuera del código (por defecto `data/`).

## Servidor Windows

Consulta [DEPLOY-WINDOWS.md](DEPLOY-WINDOWS.md) para empaquetar, instalar en Windows 10/11, importar proveedores y habilitar acceso por Tailscale. El paquete de servidor se genera con:

```powershell
pnpm build
pnpm package:windows
```

Los archivos bajo `data/`, `.test-data/`, `release/` y los respaldos quedan excluidos del control de versiones. No copies la base `.test-data` al servidor.

## Reglas fiscales pendientes de validación operativa

El TXT IVA detiene documentos mixtos al 16 % y 8 % hasta confirmar cómo los acepta el portal SENIAT. Los conceptos ISLR con tarifa escalonada o umbral requieren cálculo manual documentado. La hoja `retISLR` reproduce las columnas A:H y las filas de cabecera de la macro UPCO de octubre de 2026, pero no contiene VBA: copie sus datos a la macro original si desea usarla. Las notas con ISLR se conservan como borrador hasta validar su tratamiento en la macro y el portal.
