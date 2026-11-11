# Importación histórica de proveedores UPCO

Fuente: carpeta local `C:\Users\Elio\Documents\MEGA\UPCO DE VENEZUELA\RETENCIONES\RETENCIONES PDF`.
El extractor solo lee los PDF y consolida por RIF. Para cada dato usa el comprobante
con fecha documental más reciente que lo contenga; el respaldo exacto queda en
`fieldSources` dentro de `suppliers.json`.

## Resultado inicial (6 de noviembre de 2026)

- 2.421 PDF revisados; 2.401 comprobantes IVA/ISLR reconocidos.
- 345 proveedores únicos con RIF válido importados inicialmente en `data/upco.sqlite`.
  Cinco RIF ausentes en los comprobantes se confirmaron en libros de compras
  o contactos Odoo locales, con nombre coincidente. Las filas de respaldo están
  en `supplemental_rifs.json` y `resolved_missing_rif.csv`.
- 45 proveedores presentan variantes históricas de nombre o dirección;
  `conflicts.csv` identifica cuáles. Se seleccionó el dato más reciente por campo.
- 15 comprobantes no tienen RIF válido. Agrupados, hay 10 nombres: 3 corresponden
  probablemente a proveedores ya cargados, 5 se resolvieron con otros registros
  locales y 2 carecían de RIF en los PDF. Elio aportó esos dos RIF el 9 de noviembre;
  `rif_resolutions_20261109.csv` conserva el dato y `remaining_missing_rif.csv` quedó vacío.
  `needs_rif.csv` conserva la revisión original.
- Otros 5 PDF son documentos no reconocidos como comprobantes de retención o
  presentan error de lectura; están en `unreadable.csv`.

Los comprobantes no indican con certeza si cada proveedor es contribuyente
especial, ordinario o formal. El sistema cargó «ordinario» como valor inicial y
conservó observaciones de procedencia. En 12 de los primeros 340 tampoco consta una
retención IVA legible; se sugirió 75 % y se señaló en `review`. La plataforma no exige
aprobar las fichas antes de emitir; los valores cargados son los que usa el cálculo.

## Correlativos observados

En noviembre de 2026 el máximo comprobante IVA encontrado es
`20261100002293` y el máximo ISLR es `20261100000932`. Los siguientes números
posibles serían `20261100002294` y `20261100000933`, sujetos a cotejo con
comprobantes no archivados. La instalación actual conserva el prefijo mensual y
continúa una sola serie por tributo sin reiniciar ni pedir confirmación mensual.
El historial y los PDF de respaldo están en `certificate_maxima.json`.

## Repetir la importación

Desde la carpeta `upco-compras`:

```powershell
& 'C:\Users\Elio\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' import\extract_suppliers.py
& 'C:\Users\Elio\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' import\review_missing_rif.py
& 'C:\Users\Elio\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' import\reconcile_local_rifs.py
node scripts/import-suppliers.mjs --dry-run
node scripts/import-suppliers.mjs
```

El importador no sobrescribe correcciones hechas en la aplicación. Una segunda
ejecución omite los RIF ya existentes. `--update-existing` sobrescribe los
registros y debe usarse solo tras revisar el consolidado.
