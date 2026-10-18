// Bundles the server and its dependencies into one file, so `npx hlplanet-mcp` installs nothing else.
import { build } from 'esbuild';
import { chmodSync, readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  minify: false,
  legalComments: 'linked',
  define: { __VERSION__: JSON.stringify(version) },
  // Some bundled CommonJS code calls require(); give the ESM bundle one
  banner: { js: "import { createRequire as __hlpCreateRequire } from 'node:module';\nconst require = __hlpCreateRequire(import.meta.url);" }
});
chmodSync('dist/index.js', 0o755);
console.log(`built dist/index.js (v${version})`);
