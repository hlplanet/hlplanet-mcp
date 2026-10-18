#!/usr/bin/env node
// HLPlanet MCP server. Runs over stdio by default; pass --http (or set PORT) for Streamable HTTP.
import { createServer as createHttpServer, IncomingMessage, ServerResponse } from 'node:http';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer, VERSION } from './server.js';

const args = process.argv.slice(2);

if (args.includes('--version') || args.includes('-v')) {
  console.log(VERSION);
  process.exit(0);
}

if (args.includes('--help') || args.includes('-h')) {
  console.log(`hlplanet-mcp ${VERSION}
Keyboard size data and HLPlanet review search as an MCP server.

Usage:
  hlplanet-mcp            run over stdio (for Claude Desktop, Cursor, VS Code...)
  hlplanet-mcp --http     run a Streamable HTTP server on PORT (default 3000), endpoint /mcp`);
  process.exit(0);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : undefined;
}

async function runHttp(port: number) {
  const http = createHttpServer(async (req: IncomingMessage, res: ServerResponse) => {
    const path = (req.url || '/').split('?')[0];
    if (path === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, version: VERSION }));
      return;
    }
    if (path !== '/mcp') {
      res.writeHead(404).end('Not found. The MCP endpoint is /mcp');
      return;
    }
    if (req.method !== 'POST') {
      // Stateless server: no SSE stream or sessions to resume
      res.writeHead(405, { Allow: 'POST' }).end('Method not allowed');
      return;
    }
    try {
      const body = await readJson(req);
      const server = createServer();
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      res.on('close', () => {
        transport.close();
        server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(400, { 'Content-Type': 'application/json' }).end(
          JSON.stringify({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error: ' + (err as Error).message }, id: null })
        );
      }
    }
  });
  http.listen(port, () => console.error(`hlplanet-mcp ${VERSION} listening on http://localhost:${port}/mcp`));
}

if (args.includes('--http') || process.env.MCP_TRANSPORT === 'http') {
  await runHttp(Number(process.env.PORT) || 3000);
} else {
  const server = createServer();
  await server.connect(new StdioServerTransport());
}
