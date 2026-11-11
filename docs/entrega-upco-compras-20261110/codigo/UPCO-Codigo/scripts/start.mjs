import path from 'node:path';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import Module from 'node:module';

process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '3000';
const rootServer = path.resolve('server.js');
const localServer = path.resolve('.next/standalone/server.js');
const isRelease = existsSync(rootServer);
if (isRelease) {
  const virtualStore = path.resolve('node_modules/.pnpm');
  if (existsSync(virtualStore)) {
    const entries = readdirSync(virtualStore, { withFileTypes: true }).filter(item => item.isDirectory());
    entries.sort((a, b) => Number(b.name.startsWith('next@')) - Number(a.name.startsWith('next@')));
    process.env.NODE_PATH = [
      ...entries.map(item => path.join(virtualStore, item.name, 'node_modules')),
      process.env.NODE_PATH,
    ].filter(Boolean).join(path.delimiter);
    Module._initPaths();
  }
}
const configPath = path.resolve('install-config.json');
const installConfig = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : {};
const listenHost = process.env.UPCO_LISTEN_HOST || installConfig.listenHost || '127.0.0.1';
if (!['127.0.0.1', '0.0.0.0'].includes(listenHost)) throw new Error('Dirección de escucha UPCO no válida.');
process.env.HOSTNAME = listenHost;
const defaultDataDir = process.platform === 'win32' && isRelease
  ? path.join(process.env.ProgramData || 'C:\\ProgramData', 'UPCO', 'Compras')
  : path.join(process.cwd(), 'data');
process.env.UPCO_DATA_DIR = path.resolve(process.env.UPCO_DATA_DIR || installConfig.dataDir || defaultDataDir);
if (!process.env.UPCO_BACKUP_DIR && installConfig.backupDir) process.env.UPCO_BACKUP_DIR = path.resolve(installConfig.backupDir);
await import('./migrate.mjs');
const server = existsSync(rootServer) ? rootServer : localServer;
if (!existsSync(server)) throw new Error('Falta el build de Next. Ejecute pnpm build o use el paquete release.');
await import(pathToFileURL(server).href);
