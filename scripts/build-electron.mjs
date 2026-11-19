import { build } from 'esbuild';
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const outDir = resolve(rootDir, 'dist-electron');
const schemaOutDir = resolve(outDir, 'schema');

mkdirSync(outDir, { recursive: true });
mkdirSync(schemaOutDir, { recursive: true });

await Promise.all([
  build({
    entryPoints: [resolve(rootDir, 'electron/main.ts')],
    outfile: resolve(outDir, 'main.cjs'),
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    sourcemap: true,
    external: ['electron', 'better-sqlite3'],
  }),
  build({
    entryPoints: [resolve(rootDir, 'electron/preload.ts')],
    outfile: resolve(outDir, 'preload.cjs'),
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    sourcemap: true,
    external: ['electron'],
  }),
]);

copyFileSync(
  resolve(rootDir, 'shared/schema/v1_core.sql'),
  resolve(schemaOutDir, 'v1_core.sql')
);

console.log('Compiled Electron main/preload and copied v1_core.sql to dist-electron/');
