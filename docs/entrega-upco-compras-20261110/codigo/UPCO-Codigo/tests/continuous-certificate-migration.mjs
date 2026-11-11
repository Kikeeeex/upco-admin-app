import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'vite';

const directory = mkdtempSync(join(tmpdir(), 'upco-continuous-certificates-'));
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
  const { nextCertificateNumber, reserveCertificateNumber } =
    await import(pathToFileURL(join(directory, 'certificateSequences.mjs')).href);
  db = new DatabaseSync(join(directory, 'upco.sqlite'));
  db.prepare("DELETE FROM certificate_sequences WHERE period='*'").run();
  db.prepare("INSERT INTO certificate_sequences(kind,period,last_number) VALUES('iva','2026-10',2274)").run();
  db.prepare("INSERT INTO certificate_sequences(kind,period,last_number) VALUES('iva','2026-11',2299)").run();
  db.prepare("INSERT INTO certificate_sequences(kind,period,last_number) VALUES('islr','2026-11',935)").run();
  db.prepare("INSERT INTO certificate_sequences(kind,period,last_number) VALUES('iva','2025-00',10109)").run();
  db.prepare("INSERT INTO vendors(rif,name) VALUES('J123456789','Prueba')").run();
  const insert = db.prepare("INSERT INTO documents(vendor_id,issued_at,event_at,period,half,number,iva_certificate_number,islr_certificate_number) VALUES(1,'2026-11-09','2026-11-09','2026-11',1,?,?,?)");
  insert.run('F2294', '20261100002294', '');
  insert.run('F2298', '20261100002298', '20261100000935');
  insert.run('F2299', '20261100002299', '');
  for (const number of [2295, 2296, 2297]) db.prepare("INSERT INTO released_certificate_numbers(kind,period,number) VALUES('iva','2026-11',?)").run(number);
  for (const number of [933, 934]) db.prepare("INSERT INTO released_certificate_numbers(kind,period,number) VALUES('islr','2026-11',?)").run(number);

  const migration = readFileSync(resolve('drizzle/0007_continuous_certificates.sql'), 'utf8');
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const statement of migration.split('--> statement-breakpoint').map(part => part.trim()).filter(Boolean)) db.exec(statement);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  assert.equal(db.prepare("SELECT last_number FROM certificate_sequences WHERE kind='iva' AND period='*'").get().last_number, 2299);
  assert.equal(db.prepare("SELECT last_number FROM certificate_sequences WHERE kind='islr' AND period='*'").get().last_number, 935);
  assert.deepEqual(nextCertificateNumber(db, 'iva', '2026-12'), { number: 2295, released: true });
  assert.deepEqual(nextCertificateNumber(db, 'islr', '2026-12'), { number: 933, released: true });
  assert.equal(reserveCertificateNumber(db, 'iva', '2026-12'), '20261200002295');
  assert.equal(reserveCertificateNumber(db, 'iva', '2026-12'), '20261200002296');
  assert.equal(reserveCertificateNumber(db, 'iva', '2026-12'), '20261200002297');
  assert.equal(nextCertificateNumber(db, 'iva', '2027-01').number, 2300);
  assert.equal(reserveCertificateNumber(db, 'islr', '2026-12'), '20261200000933');
  assert.equal(reserveCertificateNumber(db, 'islr', '2026-12'), '20261200000934');
  assert.equal(nextCertificateNumber(db, 'islr', '2027-01').number, 936);
} finally {
  try { db?.close(); } catch { /* already closed */ }
  const absolute = resolve(directory), temporary = realpathSync(tmpdir());
  if (!absolute.startsWith(temporary + '\\') && !absolute.startsWith(temporary + '/')) throw new Error('Directorio temporal inesperado');
  try { rmSync(absolute, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  catch { /* Windows can release SQLite files after process exit. */ }
}
