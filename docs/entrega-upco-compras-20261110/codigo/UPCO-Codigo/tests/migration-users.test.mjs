import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

test('existing first account becomes master; later accounts remain operators', () => {
  const db = new DatabaseSync(':memory:');
  const directory = path.resolve('drizzle');
  const files = readdirSync(directory).filter(name => /^\d{4}_.+\.sql$/.test(name)).sort();
  for (const name of files.filter(name => name < '0010_')) {
    for (const statement of readFileSync(path.join(directory, name), 'utf8').split('--> statement-breakpoint').map(x => x.trim()).filter(Boolean)) db.exec(statement);
  }
  db.prepare("INSERT INTO users(username,password_hash,salt) VALUES ('elio','hash','salt')").run();
  for (const statement of readFileSync(path.join(directory, '0010_user_permissions.sql'), 'utf8').split('--> statement-breakpoint').map(x => x.trim()).filter(Boolean)) db.exec(statement);
  const first = db.prepare("SELECT role, permissions FROM users WHERE username='elio'").get();
  assert.equal(first.role, 'master');
  assert.equal(first.permissions, '[]');
  db.prepare("INSERT INTO users(username,password_hash,salt) VALUES ('operador','hash','salt')").run();
  assert.equal(db.prepare("SELECT role FROM users WHERE username='operador'").get().role, 'operator');
  db.close();
});
