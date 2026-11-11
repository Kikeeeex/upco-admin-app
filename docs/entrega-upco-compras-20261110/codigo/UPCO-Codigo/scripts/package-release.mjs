import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = process.cwd();
const lan = process.argv.includes('--lan');
const built = path.join(root, '.next', 'standalone');
if (!existsSync(path.join(built, 'server.js'))) throw new Error('Primero ejecute pnpm build');
const cssDirectory = path.join(root, '.next', 'static', 'css');
const cssFiles = existsSync(cssDirectory) ? readdirSync(cssDirectory).filter(name => name.endsWith('.css')) : [];
const hasCurrentBrand = cssFiles.some(name => {
  const css = readFileSync(path.join(cssDirectory, name), 'utf8');
  return css.includes('.login-shell') && css.includes('--upco-ink') && css.includes('Satoshi');
});
if (!hasCurrentBrand) throw new Error('El CSS compilado no contiene el diseño UPCO actual. Elimine .next y compile de nuevo antes de empaquetar.');
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-');
const release = path.join(root, 'release', `${lan ? 'upco-compras-lan' : 'upco-compras'}-${stamp}`);
mkdirSync(path.dirname(release), { recursive: true });
cpSync(built, release, {
  recursive: true, force: false, errorOnExist: true, dereference: true,
  filter(source) {
    const relative = path.relative(built, source);
    const top = relative.split(path.sep)[0];
    return !['data', '.test-data', 'import', 'release'].includes(top)
      && !path.basename(source).toLowerCase().endsWith('.sqlite')
      && path.basename(source) !== 'install-config.json'
      && !path.basename(source).toLowerCase().startsWith('.env');
  },
});
cpSync(path.join(root, '.next', 'static'), path.join(release, '.next', 'static'), { recursive: true });
cpSync(path.join(root, 'public'), path.join(release, 'public'), { recursive: true });
mkdirSync(path.join(release, 'assets'), { recursive: true });
cpSync(path.join(root, 'assets', 'retention'), path.join(release, 'assets', 'retention'), { recursive: true });
cpSync(path.join(root, 'drizzle'), path.join(release, 'drizzle'), { recursive: true });
mkdirSync(path.join(release, 'import'), { recursive: true });
cpSync(path.join(root, 'import', 'suppliers.json'), path.join(release, 'import', 'suppliers.json'));
cpSync(path.join(root, 'import', 'certificate_maxima.json'), path.join(release, 'import', 'certificate_maxima.json'));
mkdirSync(path.join(release, 'scripts'), { recursive: true });
for (const name of ['start.mjs','migrate.mjs','create-admin.mjs','import-suppliers.mjs','backup.mjs']) {
  cpSync(path.join(root, 'scripts', name), path.join(release, 'scripts', name));
}
cpSync(path.join(root, 'scripts', 'install-windows.ps1'), path.join(release, 'scripts', 'install-windows.ps1'));
if (lan) {
  const nodeBinary = path.join(root, 'release', 'node-v24.22.2-win-x64.exe');
  if (!existsSync(nodeBinary)) throw new Error('Falta el ejecutable oficial de Node 24 en release/');
  const nodeHash = createHash('sha256').update(readFileSync(nodeBinary)).digest('hex').toUpperCase();
  if (nodeHash !== '1C331340FA6CAC5E4294725959070A143FA0507195A78AD77EED7943F719AAC9') {
    throw new Error('El SHA-256 del ejecutable Node 24 no coincide');
  }
  mkdirSync(path.join(release, 'runtime'), { recursive: true });
  cpSync(nodeBinary, path.join(release, 'runtime', 'node.exe'));
  cpSync(path.join(root, 'scripts', 'install-lan-windows.ps1'), path.join(release, 'scripts', 'install-lan-windows.ps1'));
  cpSync(path.join(root, 'DEPLOY-LAN-WINDOWS.md'), path.join(release, 'DEPLOY-LAN-WINDOWS.md'));
} else {
  cpSync(path.join(root, 'DEPLOY-WINDOWS.md'), path.join(release, 'DEPLOY-WINDOWS.md'));
}
writeFileSync(path.join(release, 'RELEASE.txt'), `UPCO Compras y Retenciones\nBuild: ${new Date().toISOString()}\nModalidad: ${lan ? 'LAN, con acceso directo por Tailscale donde esté habilitado; reutiliza la base existente' : 'Tailscale Serve'}\nDatos: fuera de este paquete (UPCO_DATA_DIR)\n`);
process.stdout.write(release + '\n');
