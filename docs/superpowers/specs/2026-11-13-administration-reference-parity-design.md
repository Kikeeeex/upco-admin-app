# Diseño V2.10: paridad de Administración con UPCO Compras

## Propósito

Corregir la V2.9 para que la navegación y las pantallas de Administración se correspondan con la versión de UPCO Compras indicada por el usuario, ubicada en `origin/entrega/upco-compras-integral-20261110` (corte `e2b724b`, código `docs/entrega-upco-compras-20261110/codigo/UPCO-Codigo/components/upco/upco-app.tsx`). Administración vuelve a estar dentro del grupo **Áreas** del sidebar global.

## Estructura acordada

El menú del módulo tendrá únicamente los seis destinos que muestra la referencia:

1. Resumen
2. Compras y notas
3. Proveedores
4. Reportes
5. Configuración
6. Usuarios

Los datos, acciones y permisos V2.8 que hoy aparecen como submódulos separados se alojan dentro de estas seis pantallas:

| Pantalla visible | Funciones incluidas | Permisos de acceso |
|---|---|---|
| Resumen | KPI del período, documentos recientes, estado de la quincena | Cualquier permiso de Administración; administrador completo |
| Compras y notas | Documentos, notas, ficha y comprobantes; resumen de retenciones | `purchases.read`, `purchases.manage` o `retentions.read` |
| Proveedores | Directorio fiscal y mantenimiento | `vendors.read` o `vendors.manage` |
| Reportes | TXT IVA, XML ISLR, libro XLSX, cierre XLSX, conciliación e importación histórica | `reports.export`, `books.read` o `imports.validate`; escritura/importación real conserva límites de administrador |
| Configuración | Configuración fiscal versionada y catálogos | `fiscal_settings.read` o `fiscal_settings.manage` |
| Usuarios | Asignación de permisos de Administración a miembros | Administrador solamente |

Retenciones, Libros e Importaciones dejan de aparecer como destinos separados. Sus URL existentes se conservan como alias que llevan a Compras/Reportes, donde se ofrece la función integrada. Configuración fiscal y Permisos mantienen sus datos, acciones y guardas, y se muestran como Configuración y Usuarios en el menú.

## Fidelidad visual

La pantalla y el sistema visual se comparan con la aplicación fuente del branch de entrega: sidebar verde oscuro, wordmark UPCO, topbar con título/empresa/período/usuario, canvas gris claro, tarjetas blancas, hero de período, KPI, tablas, filtros, formularios y tarjetas de reportes. Se conservan el sidebar global de UPCO Admin y las otras áreas; Administración queda anidada dentro de Áreas. El contenido operativo conserva las consultas y acciones de V2.8.

La implementación toma estructura y estilos del código de referencia, no su API/BD ni su autenticación Windows/LAN. La fuente de datos sigue siendo el Supabase existente de UPCO Admin; no se importa, elimina ni sobrescribe información.

## Fuera de alcance

- Cambiar reglas fiscales, cálculos, formatos, datos, migraciones, RLS o permisos efectivos.
- Quitar funciones aprobadas de Retenciones, Libros, Importaciones o Permisos.
- Reemplazar la navegación global por un sidebar exclusivo.
- Usar datos de demostración o copiar secretos/activos privados del paquete.

## Aceptación

- Administración aparece dentro de Áreas.
- El menú de Administración presenta exactamente los seis destinos listados, filtrados por permisos; Usuarios solo para administradores.
- No hay destinos visibles separados para Retenciones, Libros, Importaciones o Permisos.
- Las funciones antes separadas se pueden abrir y operar dentro de Compras/Reportes/Configuración/Usuarios con los mismos controles de servidor y RLS.
- Resumen, Compras, Proveedores, Reportes, Configuración y Usuarios siguen la estructura y jerarquía visual del código de referencia.
- Procura y las demás áreas continúan accesibles, y no reciben estilos de contenido de Administración.
- Typecheck, lint, build de producción y `git diff --check` pasan.
