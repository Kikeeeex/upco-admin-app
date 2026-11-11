import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { mock } from 'bun:test';

mock.module('server-only', () => ({}));
mock.module('@/lib/auth', () => ({ currentUser: async () => ({ id: 1, username: 'tester' }) }));

const directory = mkdtempSync(join(tmpdir(), 'upco-delete-rollback-'));
process.env.UPCO_DATA_DIR = directory;
let db;
try {
  execFileSync(process.execPath, ['scripts/migrate.mjs'], {
    cwd: process.cwd(), env: process.env, stdio: 'pipe',
  });
  db = new DatabaseSync(join(directory, 'upco.sqlite'));
  db.prepare("INSERT INTO vendors(rif,name) VALUES('J123456789','Prueba')").run();
  db.prepare("UPDATE certificate_sequences SET last_number=45 WHERE kind='iva' AND period='*'").run();
  db.prepare("DELETE FROM certificate_sequences WHERE kind='islr' AND period='*'").run();
  db.prepare("INSERT INTO documents(id,vendor_id,issued_at,event_at,period,half,number,status,iva_certificate_number,islr_certificate_number) VALUES(1,1,'2026-11-09','2026-11-09','2026-11',1,'F1','issued','20261100000045','20261100000009')").run();
  const { DELETE } = await import('../app/api/documents/[id]/route');
  const remove = id => DELETE(new Request(`http://localhost/api/documents/${id}`, { method: 'DELETE' }),
    { params: Promise.resolve({ id: String(id) }) });

  const failed = await remove(1);
  assert.equal(failed.status, 400);
  assert.match((await failed.json()).error, /liberar el comprobante ISLR/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM documents WHERE id=1').get().n, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM released_certificate_numbers').get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE action='deleted'").get().n, 0);

  db.prepare("INSERT INTO certificate_sequences(kind,period,last_number) VALUES('islr','*',9)").run();
  const success = await remove(1);
  assert.equal(success.status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM documents WHERE id=1').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM released_certificate_numbers').get().n, 2);

  db.prepare("INSERT INTO documents(id,vendor_id,issued_at,event_at,period,half,number,status,iva_certificate_number,accounting_snapshot) VALUES(2,1,'2026-11-09','2026-11-09','2026-11',1,'H44','issued','20261100000044','{\"historicalImport\":true}')").run();
  assert.equal((await remove(2)).status, 200);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM retired_certificate_numbers WHERE kind='iva' AND number=44").get().n, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM released_certificate_numbers WHERE kind='iva' AND number=44").get().n, 0);
} finally {
  try { db?.close(); } catch { /* already closed */ }
  const absolute = resolve(directory), temporary = realpathSync(tmpdir());
  if (!absolute.startsWith(temporary + '\\') && !absolute.startsWith(temporary + '/')) throw new Error('Directorio temporal inesperado');
  try { rmSync(absolute, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  catch { /* Windows can release SQLite files after process exit. */ }
}
