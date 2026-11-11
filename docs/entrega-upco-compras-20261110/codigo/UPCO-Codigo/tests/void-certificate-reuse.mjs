import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'vite';

const directory = mkdtempSync(join(tmpdir(), 'upco-void-certificates-'));
let db;
try {
  execFileSync(process.execPath, ['scripts/migrate.mjs'], {
    cwd: process.cwd(), env: { ...process.env, UPCO_DATA_DIR: directory }, stdio: 'pipe',
  });
  await build({ configFile: false, logLevel: 'error', build: {
    outDir: directory, emptyOutDir: false,
    lib: { entry: resolve('lib/tax/voidDocument.ts'), formats: ['es'], fileName: () => 'voidDocument.mjs' },
    rollupOptions: { external: ['node:sqlite'] },
  } });
  const { voidIssuedDocument } = await import(pathToFileURL(join(directory, 'voidDocument.mjs')).href);
  db = new DatabaseSync(join(directory, 'upco.sqlite'));
  db.exec('PRAGMA foreign_keys=ON');
  db.prepare("INSERT INTO vendors(rif,name) VALUES('J123456789','Prueba')").run();
  db.prepare("UPDATE certificate_sequences SET last_number=47 WHERE kind='iva' AND period='*'").run();
  db.prepare("UPDATE certificate_sequences SET last_number=9 WHERE kind='islr' AND period='*'").run();
  const add = db.prepare(`
    INSERT INTO documents(vendor_id, issued_at, event_at, period, half, number, status,
      iva_certificate_number, islr_certificate_number, accounting_snapshot, affected_document_id)
    VALUES(1,'2026-11-09','2026-11-09','2026-11',1,?,'issued',?,?,?,?)
  `);
  add.run('F45', '20261100000045', '20261100000009', '{}', null);
  add.run('F46', '20261100000046', '', '{}', null);
  add.run('F47', '20261100000047', '', '{}', null);
  add.run('N1', '', '', '{}', 1);

  // A linked active note blocks voiding; the transaction must leave numbers intact.
  assert.throws(() => voidIssuedDocument(db, 1), /nota N1/);
  assert.equal(db.prepare('SELECT status FROM documents WHERE id=1').get().status, 'issued');
  db.prepare("UPDATE documents SET status='void' WHERE number='N1'").run();

  // If even one release fails, both the status and earlier releases roll back.
  db.prepare("DELETE FROM certificate_sequences WHERE kind='islr' AND period='*'").run();
  assert.throws(() => voidIssuedDocument(db, 1), /no se pudo liberar|No se pudo liberar/);
  assert.deepEqual({ ...db.prepare('SELECT status,iva_certificate_number,islr_certificate_number FROM documents WHERE id=1').get() }, {
    status: 'issued', iva_certificate_number: '20261100000045', islr_certificate_number: '20261100000009',
  });
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM released_certificate_numbers").get().n, 0);
  db.prepare("INSERT INTO certificate_sequences(kind,period,last_number) VALUES('islr','*',9)").run();

  const result = voidIssuedDocument(db, 1);
  assert.deepEqual(result.released, { iva: '20261100000045', islr: '20261100000009' });
  assert.deepEqual({ ...db.prepare('SELECT status,iva_certificate_number,islr_certificate_number FROM documents WHERE id=1').get() }, {
    status: 'void', iva_certificate_number: '', islr_certificate_number: '',
  });
  const event = JSON.parse(db.prepare("SELECT snapshot FROM audit_events WHERE entity_type='document' AND entity_id=1 AND action='voided'").get().snapshot);
  assert.equal(event.before.iva_certificate_number, '20261100000045');
  assert.equal(event.after.iva_certificate_number, '');
  assert.equal(event.released.islr, '20261100000009');

  // Reusing the gap leaves 46 and 47 intact and the following number is 48.
  assert.deepEqual(db.prepare("SELECT kind,number FROM released_certificate_numbers ORDER BY kind").all().map(row => ({ ...row })), [
    { kind: 'islr', number: 9 }, { kind: 'iva', number: 45 },
  ]);
  db.prepare("DELETE FROM released_certificate_numbers WHERE kind='iva' AND period='2026-11' AND number=45").run();
  add.run('F45-REUSADA', '20261100000045', '', '{}', null);
  assert.equal(db.prepare("SELECT MAX(CAST(substr(iva_certificate_number,7) AS INTEGER)) AS n FROM documents").get().n, 47);
  assert.equal(db.prepare("SELECT last_number FROM certificate_sequences WHERE kind='iva' AND period='*'").get().last_number, 47);

  // Historical imports keep their original certificate reserved when voided.
  add.run('H44', '20261100000044', '', '{"historicalImport":true}', null);
  const historical = voidIssuedDocument(db, 6);
  assert.deepEqual(historical.released, { iva: null, islr: null });
  assert.equal(historical.historicalImport, true);
  assert.deepEqual({ ...db.prepare('SELECT status,iva_certificate_number FROM documents WHERE id=6').get() }, {
    status: 'void', iva_certificate_number: '20261100000044',
  });
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM released_certificate_numbers WHERE kind='iva' AND number=44").get().n, 0);
} finally {
  try { db?.close(); } catch { /* already closed */ }
  const absolute = resolve(directory), temp = realpathSync(tmpdir());
  if (!absolute.startsWith(temp + '\\') && !absolute.startsWith(temp + '/')) throw new Error('Directorio temporal inesperado');
  try { rmSync(absolute, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  catch { /* Windows can release SQLite files after process exit. */ }
}
