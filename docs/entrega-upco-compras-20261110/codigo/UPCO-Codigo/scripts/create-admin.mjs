import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { createInterface } from 'node:readline/promises';

const dataDir = path.resolve(process.env.UPCO_DATA_DIR || path.join(process.cwd(), 'data'));
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'upco.sqlite'));
const tables = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='users'").get();
if (!tables) throw new Error('Primero ejecute: pnpm db:migrate');
const existingUsers = db.prepare('SELECT COUNT(*) AS total FROM users').get().total;
if (process.argv.includes('--if-empty') && existingUsers > 0) {
  db.close();
  process.stdout.write('Ya existe un usuario; se conserva.\n');
  process.exit(0);
}
if (!process.stdin.isTTY) throw new Error('Ejecute este comando desde una terminal interactiva.');
const prompt = createInterface({ input: process.stdin, output: process.stdout });
const username = (await prompt.question('Usuario administrador: ')).trim().toLowerCase();
prompt.close();
if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw new Error('Usuario: 3 a 40 letras, números, punto, guion o guion bajo.');
const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
if (exists) throw new Error('Ese usuario ya existe.');

function hiddenQuestion(label) {
  return new Promise((resolve, reject) => {
    process.stdout.write(label);
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    let value = '';
    const finish = (error) => {
      process.stdin.removeListener('keypress', onKey);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      error ? reject(error) : resolve(value);
    };
    function onKey(char, key) {
      if (key?.ctrl && key.name === 'c') return finish(new Error('Cancelado'));
      if (key?.name === 'return') return finish();
      if (key?.name === 'backspace') { if (value) { value = value.slice(0, -1); process.stdout.write('\b \b'); } return; }
      if (char && !key?.ctrl && !key?.meta) { value += char; process.stdout.write('*'); }
    }
    process.stdin.on('keypress', onKey);
  });
}

const password = await hiddenQuestion('Contraseña (mínimo 12 caracteres): ');
const repeated = await hiddenQuestion('Repetir contraseña: ');
if (password.length < 12 || password.length > 128) throw new Error('La contraseña debe tener entre 12 y 128 caracteres.');
if (password !== repeated) throw new Error('Las contraseñas no coinciden.');
const salt = randomBytes(24).toString('hex');
const hash = scryptSync(password, salt, 64).toString('hex');
db.prepare('INSERT INTO users (username,password_hash,salt,role,permissions) VALUES (?,?,?,?,?)')
  .run(username, hash, salt, existingUsers === 0 ? 'master' : 'operator', '[]');
db.close();
process.stdout.write(`Usuario ${username} creado.\n`);
