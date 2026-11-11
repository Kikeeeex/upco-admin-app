import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'vite';

const directory = mkdtempSync(join(tmpdir(), 'upco-issued-correction-'));
let db;
try {
  execFileSync(process.execPath, ['scripts/migrate.mjs'], {
    cwd: process.cwd(), env: { ...process.env, UPCO_DATA_DIR: directory }, stdio: 'pipe',
  });
  await build({ configFile: false, logLevel: 'error', resolve: { alias: { '@': resolve('.') } }, build: {
    outDir: directory, emptyOutDir: false,
    lib: { entry: resolve('lib/tax/issuedCorrection.ts'), formats: ['es'], fileName: () => 'issuedCorrection.mjs' },
    rollupOptions: { external: ['node:sqlite'] },
  } });
  const { validateIssuedCorrection, saveIssuedCorrection } =
    await import(pathToFileURL(join(directory, 'issuedCorrection.mjs')).href);
  db = new DatabaseSync(join(directory, 'upco.sqlite'));
  db.exec('PRAGMA foreign_keys=ON');
  db.prepare("INSERT INTO vendors(rif,name) VALUES('J123456789','Proveedor')").run();
  db.prepare("INSERT INTO documents(vendor_id,issued_at,event_at,period,half,number,control_number,status,iva_certificate_number,iva_retention_cents,updated_at) VALUES(1,'2026-11-09','2026-11-09','2026-11',1,'F1','C1','issued','20261100000045',1200,'2026-11-09T12:00:00.000Z')").run();

  const original = {
    id: 1, vendorId: 1, status: 'issued', type: 'factura', number: 'F1', period: '2026-11',
    accountingSnapshot: '', ivaCertificateNumber: '20261100000045', islrCertificateNumber: '',
    updatedAt: '2026-11-09T12:00:00.000Z',
  };
  const next = {
    type: 'factura', status: 'issued', affectedDocumentId: null, number: 'F1-CORREGIDA',
    issuedAt: '2026-11-09', eventAt: '2026-11-09', period: '2026-11', half: 1,
    ivaRetentionCents: 1320, islrRetentionCents: 0, base16Cents: 11000,
    cecoAllocations: '[{"cecoId":1,"percentage":100}]', paymentAccountId: 1,
    description: 'Corrección por error en la base imponible', accountingSnapshot: '',
  };
  saveIssuedCorrection(db, original, next, 1, '{"description":"Corregida"}', 'Base imponible rectificada', original.updatedAt, 1);
  const saved = db.prepare('SELECT status,number,iva_certificate_number,iva_retention_cents,base16_cents,accounting_snapshot FROM documents WHERE id=1').get();
  assert.equal(saved.status, 'issued');
  assert.equal(saved.number, 'F1-CORREGIDA');
  assert.equal(saved.iva_certificate_number, '20261100000045');
  assert.equal(saved.iva_retention_cents, 1320);
  assert.equal(saved.base16_cents, 11000);
  assert.equal(saved.accounting_snapshot, '{"description":"Corregida"}');
  const audit = db.prepare("SELECT snapshot FROM audit_events WHERE action='corrected' AND entity_id=1").get();
  assert.equal(JSON.parse(audit.snapshot).reason, 'Base imponible rectificada');

  assert.throws(() => saveIssuedCorrection(db, original, next, 1, '{}', 'Segundo intento erróneo', original.updatedAt, 1), /cambió/);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE action='corrected'").get().n, 1);
  db.prepare("INSERT INTO documents(vendor_id,issued_at,event_at,period,half,number,control_number,status) VALUES(1,'2026-11-09','2026-11-09','2026-11',1,'F2','C2','issued')").run();
  const fresh = { ...original, updatedAt: db.prepare('SELECT updated_at AS value FROM documents WHERE id=1').get().value };
  assert.throws(() => saveIssuedCorrection(db, fresh, { ...next, number: 'F2' }, 1, '{}', 'Intento de número repetido', fresh.updatedAt, 1), /UNIQUE/);
  assert.equal(db.prepare('SELECT number FROM documents WHERE id=1').get().number, 'F1-CORREGIDA');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE action='corrected'").get().n, 1);
  assert.throws(() => validateIssuedCorrection(original, { ...next, ivaRetentionCents: 0 }, 'Motivo suficiente', original.updatedAt, false), /eliminaría una retención de IVA/);
  assert.throws(() => validateIssuedCorrection(original, { ...next, islrRetentionCents: 100 }, 'Motivo suficiente', original.updatedAt, false), /agregaría o eliminaría una retención de ISLR/);
  assert.throws(() => validateIssuedCorrection(original, { ...next, period: '2026-12' }, 'Motivo suficiente', original.updatedAt, false), /mes de IVA/);
  assert.throws(() => validateIssuedCorrection(original, next, 'Motivo suficiente', original.updatedAt, true), /nota relacionada/);
  assert.throws(() => validateIssuedCorrection({ ...original, accountingSnapshot: '{"historicalImport":true}' }, next, 'Motivo suficiente', original.updatedAt, false), /históricas importadas/);
  console.log('issued correction: preserved certificates, updated amounts, audit and guards OK');
} finally {
  db?.close();
  rmSync(directory, { recursive: true, force: true });
}
