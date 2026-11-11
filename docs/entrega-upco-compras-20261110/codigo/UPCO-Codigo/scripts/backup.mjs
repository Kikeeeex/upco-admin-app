import { DatabaseSync } from 'node:sqlite';
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const dataDir = path.resolve(process.env.UPCO_DATA_DIR || path.join(process.cwd(), 'data'));
const sourceDb = path.join(dataDir, 'upco.sqlite');
if (!existsSync(sourceDb)) throw new Error('No existe la base de datos.');
try {
  const response = await fetch('http://127.0.0.1:3000/login', { signal: AbortSignal.timeout(800) });
  if (response) throw new Error('Detenga el servicio UPCO antes de respaldar datos y adjuntos coherentemente.');
} catch (error) {
  if (error instanceof Error && error.message.startsWith('Detenga el servicio')) throw error;
}
const backupRoot = path.resolve(process.env.UPCO_BACKUP_DIR || path.join(path.dirname(dataDir), 'Backups'));
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-');
const destination = path.join(backupRoot, stamp);
mkdirSync(destination, { recursive: true });
const db = new DatabaseSync(sourceDb, { timeout: 5000 });
db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
db.prepare('VACUUM INTO ?').run(path.join(destination, 'upco.sqlite'));
db.close();
const snapshot = new DatabaseSync(path.join(destination, 'upco.sqlite'));
const integrity = snapshot.prepare('PRAGMA integrity_check').get();
if (integrity?.integrity_check !== 'ok') throw new Error('El respaldo de SQLite no pasó la revisión de integridad.');
const counts = {
  vendors: snapshot.prepare('SELECT COUNT(*) AS total FROM vendors').get().total,
  documents: snapshot.prepare('SELECT COUNT(*) AS total FROM documents').get().total,
  users: snapshot.prepare('SELECT COUNT(*) AS total FROM users').get().total,
};
snapshot.close();
const attachments = path.join(dataDir, 'attachments');
if (existsSync(attachments)) cpSync(attachments, path.join(destination, 'attachments'), { recursive: true });
const count = existsSync(path.join(destination, 'attachments')) ? readdirSync(path.join(destination, 'attachments')).length : 0;
writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify({ createdAt: new Date().toISOString(), database: 'upco.sqlite', counts, attachmentDirectories: count }, null, 2));
process.stdout.write(destination + '\n');
