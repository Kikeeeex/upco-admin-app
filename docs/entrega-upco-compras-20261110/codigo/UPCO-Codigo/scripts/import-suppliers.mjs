import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const source = path.join(root, 'import', 'suppliers.json');
const suppliers = JSON.parse(readFileSync(source, 'utf8'));
if (!Array.isArray(suppliers)) throw new Error('import/suppliers.json debe ser una lista');
const dryRun = process.argv.includes('--dry-run');
const updateExisting = process.argv.includes('--update-existing');
const dataDir = path.resolve(process.env.UPCO_DATA_DIR || path.join(root, 'data'));
const db = new DatabaseSync(path.join(dataDir, 'upco.sqlite'), { timeout: 5000 });
db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='vendors'").get()) throw new Error('Ejecute pnpm db:migrate antes de importar');
const find = db.prepare('SELECT id FROM vendors WHERE rif = ?');
const insert = db.prepare(`INSERT INTO vendors
  (rif,name,address,taxpayer_type,person_type,residency,iva_retention_rate,email,phone,active,needs_review,import_confidence,import_review,source_date,source_pdf)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const update = db.prepare(`UPDATE vendors SET name=?,address=?,taxpayer_type=?,person_type=?,residency=?,iva_retention_rate=?,email=?,phone=?,active=?,needs_review=?,import_confidence=?,import_review=?,source_date=?,source_pdf=?,updated_at=? WHERE rif=?`);
let inserted = 0, skipped = 0, updated = 0, reviewCount = 0;
const seen = new Set();
if (!dryRun) db.exec('BEGIN IMMEDIATE');
try {
  for (const raw of suppliers) {
    const rif = String(raw.rif || '').toUpperCase().replace(/[\s-]/g, '');
    const name = String(raw.name || '').trim();
    if (!/^[VEJPG]\d{9}$/.test(rif) || !name) throw new Error(`Proveedor inválido en importación: ${rif || '(sin RIF)'}`);
    if (seen.has(rif)) throw new Error(`RIF duplicado en consolidado: ${rif}`);
    seen.add(rif);
    const review = raw.review && typeof raw.review === 'object' ? raw.review : {};
    // Import provenance remains available in the audit, without a separate approval step.
    const needsReview = 0;
    if (needsReview) reviewCount++;
    const values = [
      name, String(raw.address || '').trim(), String(raw.taxpayerType || 'ordinario'),
      String(raw.personType || 'juridica'), String(raw.residency || 'domiciliada'),
      [0,75,100].includes(Number(raw.ivaRetentionRate)) ? Number(raw.ivaRetentionRate) : 75,
      String(raw.email || ''), String(raw.phone || ''), raw.active === false ? 0 : 1,
      needsReview, String(raw.confidence || ''), JSON.stringify(review),
      String(raw.sourceDate || ''), String(raw.sourcePdf || ''),
    ];
    const existing = find.get(rif);
    if (existing) {
      if (!updateExisting) { skipped++; continue; }
      updated++;
      if (!dryRun) update.run(...values, new Date().toISOString(), rif);
    } else {
      inserted++;
      if (!dryRun) insert.run(rif, ...values);
    }
  }
  if (!dryRun) db.exec('COMMIT');
} catch (error) {
  if (!dryRun) db.exec('ROLLBACK');
  throw error;
} finally { db.close(); }
process.stdout.write(JSON.stringify({ source, total: suppliers.length, inserted, updated, skipped, needsReview: reviewCount, dryRun, updateExisting }) + '\n');
