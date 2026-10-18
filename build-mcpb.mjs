// Packs hlplanet-mcp.mcpb (one-click install for Claude Desktop, also accepted by Smithery).
// The bundled server has no dependencies, so the package is just the manifest, the icon and one file.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const manifest = JSON.parse(readFileSync('mcpb/manifest.json', 'utf8'));
if (manifest.version !== version) {
  manifest.version = version;
  writeFileSync('mcpb/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
}
mkdirSync('mcpb/server', { recursive: true });
copyFileSync('dist/index.js', 'mcpb/server/index.js');
copyFileSync('icon.png', 'mcpb/icon.png');
execSync('npx mcpb validate mcpb/manifest.json', { stdio: 'inherit' });
execSync('npx mcpb pack mcpb hlplanet-mcp.mcpb', { stdio: 'inherit' });
