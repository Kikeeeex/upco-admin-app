"""Empaqueta fuente y compilado sin base viva, sesiones ni secretos."""
from pathlib import Path
import hashlib
import sys
import zipfile

handoff = Path(__file__).resolve().parent
root = handoff.parent
app = root / 'upco-compras'
source_zip = handoff / 'UPCO-Compras-Codigo-Completo.zip'
release_zip = handoff / 'UPCO-Compras-Windows-LAN.zip'
outer_zip = root / 'UPCO-Entrega-Integral-20261110.zip'

source_dirs = ('app', 'assets', 'components', 'db', 'drizzle', 'hooks', 'import', 'lib',
               'public', 'reports', 'scripts', 'tests', 'vendor', 'worker')
source_files = ('AGENTS.md', 'CLAUDE.md', 'README.md', '.gitignore', '.npmrc',
                'cloudflare-env.d.ts', 'components.json', 'DEPLOY-LAN-WINDOWS.md',
                'DEPLOY-UPDATE-WINDOWS.md', 'DEPLOY-WINDOWS.md', 'drizzle.config.ts',
                'eslint.config.mjs', 'GUIA-DISENADORA-FRONTEND.md', 'next-env.d.ts',
                'next.config.ts', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml',
                'postcss.config.mjs', 'tsconfig.json', 'vite.config.ts')

def excluded(path):
    return any(part in {'__pycache__', '.next', 'node_modules', '.test-data', 'data', 'release'} for part in path.parts) or path.name.endswith(('.pyc', '.sqlite', '.sqlite-wal', '.sqlite-shm', '.inspect.ndjson')) or path.name.startswith('.env')

def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()

def write_source():
    with zipfile.ZipFile(source_zip, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6, strict_timestamps=False) as archive:
        for name in source_files:
            path = app / name
            if path.is_file(): archive.write(path, 'UPCO-Codigo/' + name)
        for name in source_dirs:
            directory = app / name
            if not directory.exists(): continue
            for path in directory.rglob('*'):
                if path.is_file() and not excluded(path.relative_to(app)):
                    archive.write(path, 'UPCO-Codigo/' + path.relative_to(app).as_posix())
    with zipfile.ZipFile(source_zip) as archive:
        bad = archive.testzip()
        if bad: raise RuntimeError(f'ZIP de código dañado: {bad}')
    print(source_zip, source_zip.stat().st_size, sha(source_zip))

def write_final():
    releases = sorted((app / 'release').glob('upco-compras-lan-*'))
    releases = [path for path in releases if path.is_dir() and (path / 'server.js').exists()]
    if not releases: raise RuntimeError('No hay compilado LAN válido; ejecutar package-release.mjs --lan')
    release = releases[-1]
    with zipfile.ZipFile(release_zip, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6, strict_timestamps=False) as archive:
        for path in release.rglob('*'):
            if path.is_file() and not path.name.startswith('.env') and not path.name.lower().endswith(('.sqlite', '.sqlite-wal', '.sqlite-shm')):
                archive.write(path, 'UPCO-Compras-Windows-LAN/' + path.relative_to(release).as_posix())
    with zipfile.ZipFile(release_zip) as archive:
        bad = archive.testzip()
        if bad: raise RuntimeError(f'ZIP Windows dañado: {bad}')
    checksum_lines = []
    for path in sorted(handoff.rglob('*')):
        if path.is_file() and path.name != 'CHECKSUMS-SHA256.txt':
            checksum_lines.append(f'{sha(path)}  {path.relative_to(handoff).as_posix()}')
    (handoff / 'CHECKSUMS-SHA256.txt').write_text('\n'.join(checksum_lines) + '\n', encoding='utf-8')
    with zipfile.ZipFile(outer_zip, 'w', strict_timestamps=False) as archive:
        for path in sorted(handoff.rglob('*')):
            if path.is_file():
                method = zipfile.ZIP_STORED if path.suffix == '.zip' else zipfile.ZIP_DEFLATED
                archive.write(path, 'ENTREGA-UPCO-INTEGRAL-20261110/' + path.relative_to(handoff).as_posix(), compress_type=method)
    with zipfile.ZipFile(outer_zip) as archive:
        bad = archive.testzip()
        if bad: raise RuntimeError(f'ZIP integral dañado: {bad}')
    print(outer_zip, outer_zip.stat().st_size, sha(outer_zip))

if __name__ == '__main__':
    command = sys.argv[1] if len(sys.argv) > 1 else 'source'
    if command == 'source': write_source()
    elif command == 'final':
        if not source_zip.exists(): write_source()
        write_final()
    else: raise SystemExit('Use source o final')
