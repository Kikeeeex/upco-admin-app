import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'vite';

const directory = mkdtempSync(join(tmpdir(), 'upco-certificate-reuse-'));
let db;
try {
  execFileSync(process.execPath, ['scripts/migrate.mjs'], {
    cwd: process.cwd(), env: { ...process.env, UPCO_DATA_DIR: directory }, stdio: 'pipe',
  });
  await build({ configFile: false, logLevel: 'error', build: {
    outDir: directory, emptyOutDir: false,
    lib: { entry: resolve('lib/tax/certificateSequences.ts'), formats: ['es'], fileName: () => 'certificateSequences.mjs' },
    rollupOptions: { external: ['node:sqlite'] },
  } });
  const { nextCertificateNumber, reserveCertificateNumber, releaseCertificateNumber, retireCertificateNumber } =
    await import(pathToFileURL(join(directory, 'certificateSequences.mjs')).href);
  db = new DatabaseSync(join(directory, 'upco.sqlite'));
  db.exec('PRAGMA foreign_keys=ON');
  db.prepare("INSERT INTO vendors(rif,name) VALUES('J123456789','Prueba')").run();
  db.prepare("UPDATE certificate_sequences SET last_number=47 WHERE kind='iva' AND period='*'").run();
  db.prepare("UPDATE certificate_sequences SET last_number=9 WHERE kind='islr' AND period='*'").run();
  const add = db.prepare("INSERT INTO documents(vendor_id, issued_at, event_at, period, half, number, iva_certificate_number, islr_certificate_number) VALUES(1,'2026-11-09','2026-11-09','2026-11',1,?,?,?)");
  add.run('F45', '20261100000045', '');
  add.run('F46', '20261100000046', '');
  add.run('F47', '20261100000047', '');
  add.run('I9', '', '20261100000009');

  db.exec('BEGIN IMMEDIATE');
  db.prepare("DELETE FROM documents WHERE number='F45'").run();
  assert.equal(releaseCertificateNumber(db, 'iva', '20261100000045'), true);
  db.exec('COMMIT');
  assert.deepEqual(nextCertificateNumber(db, 'iva', '2026-11'), { number: 45, released: true });
  assert.equal(reserveCertificateNumber(db, 'iva', '2026-11'), '20261100000045');
  add.run('F45-REUSADA', '20261100000045', '');
  assert.deepEqual(nextCertificateNumber(db, 'iva', '2026-11'), { number: 48, released: false });
  assert.equal(reserveCertificateNumber(db, 'iva', '2026-11'), '20261100000048');
  add.run('F48', '20261100000048', '');
  assert.equal(nextCertificateNumber(db, 'iva', '2026-11').number, 49);
  assert.throws(() => add.run('DUPLICADA', '20261100000045', ''), /UNIQUE/);

  db.exec('BEGIN IMMEDIATE');
  db.prepare("DELETE FROM documents WHERE number='F47'").run();
  releaseCertificateNumber(db, 'iva', '20261100000047');
  assert.equal(reserveCertificateNumber(db, 'iva', '2026-11'), '20261100000047');
  db.exec('ROLLBACK');
  assert.equal(nextCertificateNumber(db, 'iva', '2026-11').number, 49);

  // A released suffix from November is reused even when the next
  // withholding document belongs to December; no month-specific setup.
  db.prepare("DELETE FROM documents WHERE number='F47'").run();
  assert.equal(releaseCertificateNumber(db, 'iva', '20261100000047'), true);
  assert.deepEqual(nextCertificateNumber(db, 'iva', '2026-12'), { number: 47, released: true });
  assert.equal(reserveCertificateNumber(db, 'iva', '2026-12'), '20261200000047');
  db.prepare("INSERT INTO documents(vendor_id,issued_at,event_at,period,half,number,iva_certificate_number) VALUES(1,'2026-12-01','2026-12-01','2026-12',1,'D47','20261200000047')").run();
  assert.equal(nextCertificateNumber(db, 'iva', '2027-01').number, 49);

  db.prepare("DELETE FROM documents WHERE number='F46'").run();
  assert.equal(retireCertificateNumber(db, 'iva', '20261100000046'), true);
  assert.equal(nextCertificateNumber(db, 'iva', '2027-01').number, 49);
  db.prepare("DELETE FROM documents WHERE number='I9'").run();
  assert.equal(releaseCertificateNumber(db, 'islr', '20261100000009'), true);
  assert.equal(nextCertificateNumber(db, 'islr', '2026-11').number, 9);
  assert.equal(reserveCertificateNumber(db, 'islr', '2026-11'), '20261100000009');
  assert.equal(nextCertificateNumber(db, 'islr', '2026-11').number, 10);

  // A production database with duplicate old certificates must reject the
  // migration atomically, without leaving a half-created free-number table.
  const collisionDb = new DatabaseSync(':memory:');
  try {
    collisionDb.exec('CREATE TABLE documents(iva_certificate_number TEXT, islr_certificate_number TEXT)');
    collisionDb.exec("INSERT INTO documents VALUES('20261100000045',''),('20261100000045','')");
    const migration = readFileSync(resolve('drizzle/0006_released_certificates.sql'), 'utf8');
    collisionDb.exec('BEGIN IMMEDIATE');
    assert.throws(() => {
      for (const statement of migration.split('--> statement-breakpoint').map(part => part.trim()).filter(Boolean)) collisionDb.exec(statement);
    }, /UNIQUE/);
    collisionDb.exec('ROLLBACK');
    assert.equal(collisionDb.prepare("SELECT count(*) AS total FROM sqlite_master WHERE type='table' AND name='released_certificate_numbers'").get().total, 0);
  } finally { collisionDb.close(); }
} finally {
  try { db?.close(); } catch { /* already closed */ }
  const absolute = resolve(directory), temp = realpathSync(tmpdir());
  if (!absolute.startsWith(temp + '\\') && !absolute.startsWith(temp + '/')) throw new Error('Directorio temporal inesperado');
  try { rmSync(absolute, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  catch { /* Windows can release SQLite files after process exit. */ }
}
