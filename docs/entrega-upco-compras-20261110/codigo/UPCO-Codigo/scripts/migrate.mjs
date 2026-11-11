import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const dataDir = path.resolve(process.env.UPCO_DATA_DIR || path.join(process.cwd(), 'data'));
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'upco.sqlite'), { timeout: 5000 });
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
db.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
const migrationDir = path.resolve('drizzle');
const files = readdirSync(migrationDir).filter(name => /^\d{4}_.+\.sql$/.test(name)).sort();
for (const file of files) {
  if (db.prepare('SELECT 1 FROM local_migrations WHERE name = ?').get(file)) continue;
  const source = readFileSync(path.join(migrationDir, file), 'utf8');
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const statement of source.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean)) db.exec(statement);
    db.prepare('INSERT INTO local_migrations (name) VALUES (?)').run(file);
    db.exec('COMMIT');
    process.stdout.write(`Applied ${file}\n`);
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
db.close();
