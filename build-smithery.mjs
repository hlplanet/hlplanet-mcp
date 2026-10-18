// Builds hlplanet-mcp-smithery.mcpb for `smithery mcp publish`.
// Smithery reads the tool list from the bundle manifest and needs each tool's input schema,
// which the standard MCPB manifest (and `mcpb pack`) doesn't allow. So this copy lists the
// full tool definitions, taken from the built server itself.
import { readFileSync, writeFileSync } from 'node:fs';
import { zipSync, strToU8 } from 'fflate';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const client = new Client({ name: 'build-smithery', version });
await client.connect(new StdioClientTransport({ command: process.execPath, args: ['dist/index.js'] }));
const { tools } = await client.listTools();
await client.close();

const manifest = JSON.parse(readFileSync('mcpb/manifest.json', 'utf8'));
manifest.version = version;
manifest.tools = tools.map(({ name, title, description, inputSchema, annotations }) => ({ name, title, description, inputSchema, annotations }));

const zip = zipSync({
  'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
  'server/index.js': readFileSync('dist/index.js'),
  'icon.png': readFileSync('icon.png')
}, { level: 9 });
writeFileSync('hlplanet-mcp-smithery.mcpb', zip);
console.log(`built hlplanet-mcp-smithery.mcpb (v${version}, ${tools.length} tools, ${Math.round(zip.length / 1024)} kB)`);
