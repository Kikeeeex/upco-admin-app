import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync(':memory:');
db.exec('CREATE TABLE documents (id INTEGER PRIMARY KEY, igtf_applies INTEGER NOT NULL, igtf_base_cents INTEGER NOT NULL, net_payable_cents INTEGER NOT NULL)');
db.prepare('INSERT INTO documents VALUES (?,?,?,?)').run(1, 1, 5850, 10000);
db.prepare('INSERT INTO documents VALUES (?,?,?,?)').run(2, 1, -5850, -10000);
db.prepare('INSERT INTO documents VALUES (?,?,?,?)').run(3, 0, 5850, 10000);
const migration = readFileSync(new URL('../drizzle/0008_igtf_amount.sql', import.meta.url), 'utf8');
for (const statement of migration.split('--> statement-breakpoint').map(text => text.trim()).filter(Boolean)) db.exec(statement);
const rows = db.prepare('SELECT id, igtf_amount_cents AS amount, net_payable_cents AS net FROM documents ORDER BY id').all().map(row => ({ ...row }));
assert.deepEqual(rows, [
  { id: 1, amount: 176, net: 10176 },
  { id: 2, amount: -176, net: -10176 },
  { id: 3, amount: 0, net: 10000 },
]);
db.close();
