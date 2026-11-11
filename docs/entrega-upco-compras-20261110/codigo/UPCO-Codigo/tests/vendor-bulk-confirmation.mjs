import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { confirmImportedVendors, ImportConfirmationError } from '../lib/tax/confirmImportedVendors.ts';

const db = new DatabaseSync(':memory:');
try {
  db.exec(`
    CREATE TABLE vendors(id INTEGER PRIMARY KEY, import_confidence TEXT NOT NULL,
      needs_review INTEGER NOT NULL, updated_at TEXT NOT NULL DEFAULT '');
    CREATE TABLE audit_events(id INTEGER PRIMARY KEY, entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL, action TEXT NOT NULL, snapshot TEXT NOT NULL);
    INSERT INTO vendors(id, import_confidence, needs_review) VALUES
      (1, 'high', 1), (2, 'medium', 1), (3, '', 1), (4, 'high', 0);
  `);
  assert.throws(() => confirmImportedVendors(db, 3), ImportConfirmationError);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM vendors WHERE needs_review = 1').get().n, 3);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM audit_events').get().n, 0);

  const result = confirmImportedVendors(db, 2);
  assert.deepEqual(result, { updated: 2, imported: 3, officialSeniatCheck: false });
  assert.deepEqual(db.prepare('SELECT id FROM vendors WHERE needs_review = 1').all().map(row => row.id), [3]);
  const [event] = db.prepare('SELECT action, snapshot FROM audit_events').all();
  assert.equal(event.action, 'bulk_fiscal_review_confirmed');
  assert.deepEqual(JSON.parse(event.snapshot).vendorIds, [1, 2]);
  assert.throws(() => confirmImportedVendors(db, 2), ImportConfirmationError);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM audit_events').get().n, 1);
  console.log('Confirmación masiva transaccional y auditoría: OK');
} finally {
  db.close();
}
