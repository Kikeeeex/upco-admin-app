"""Extrae una tabla de consulta del catálogo TypeScript entregado."""
from pathlib import Path
import csv
import re

root = Path(__file__).resolve().parents[2]
source = (root / 'upco-compras' / 'lib' / 'tax' / 'islrConcepts.ts').read_text(encoding='utf-8')
target = Path(__file__).with_name('CATALOGO-ISLR.csv')
fields = ['code', 'description', 'beneficiary', 'ratePercent', 'taxableBasePercent',
          'calculation', 'subtractionApplies', 'minimumWithheldLegacyBs',
          'subtractionFactorUt', 'baseRuleNote']
rows = []
for line in source.splitlines():
    if not re.search(r'\{ code: "\d{3}"', line):
        continue
    row = {}
    for field in fields:
        match = re.search(r'\b' + field + r': ("(?:[^"\\]|\\.)*"|null|true|false|[\d.]+)', line)
        value = match.group(1) if match else ''
        row[field] = value[1:-1].replace('\\"', '"') if value.startswith('"') else value
    rows.append(row)
if len(rows) < 80:
    raise SystemExit(f'Catálogo incompleto: {len(rows)} filas')
with target.open('w', encoding='utf-8-sig', newline='') as stream:
    writer = csv.DictWriter(stream, fieldnames=fields, delimiter=';')
    writer.writeheader()
    writer.writerows(rows)
print(f'{len(rows)} conceptos: {target}')
