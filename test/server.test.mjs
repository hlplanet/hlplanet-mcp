// End-to-end tests: start the built server over stdio and call every tool like an MCP client would.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

let client;

before(async () => {
  client = new Client({ name: 'hlplanet-mcp-test', version: '1.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: ['dist/index.js'] }));
});

after(async () => {
  await client?.close();
});

const call = async (name, args = {}) => {
  const res = await client.callTool({ name, arguments: args });
  return { text: res.content.map((c) => c.text).join('\n'), isError: !!res.isError };
};

test('lists all tools with read-only annotations', async () => {
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  assert.deepEqual(names, [
    'check_desk_fit',
    'compare_keyboards',
    'get_keyboard_dimensions',
    'list_keyboard_sizes',
    'list_testing_tools',
    'search_hlplanet',
    'which_sizes_have_key'
  ]);
  for (const t of tools) {
    assert.ok(t.description.length > 40, `${t.name} has a description`);
    assert.equal(t.annotations?.readOnlyHint, true, `${t.name} is read-only`);
  }
});

test('server identifies itself', () => {
  const info = client.getServerVersion();
  assert.equal(info.name, 'hlplanet-mcp');
  assert.match(info.version, /^\d+\.\d+\.\d+/);
});

test('list_keyboard_sizes gives standard key counts', async () => {
  const { text } = await call('list_keyboard_sizes');
  for (const [name, keys] of [['Full-size', 104], ['TKL', 87], ['75%', 84], ['65%', 68], ['60%', 61]]) {
    assert.match(text, new RegExp(`## ${name.replace('%', '%')}[^#]*Keys: ${keys}`));
  }
  assert.match(text, /Missing vs full-size: Numpad \(17 keys\)/);
  assert.match(text, /hlplanet\.com\/keyboard-layout\/\?compare=/);
});

test('compare_keyboards: TKL vs 75%', async () => {
  const { text, isError } = await call('compare_keyboards', { keyboards: ['TKL', '75%'] });
  assert.equal(isError, false);
  assert.match(text, /Narrower by 4\.3 cm/);
  assert.match(text, /System: Scroll Lock, Pause\/Break/);
  assert.match(text, /compare=tkl,75,ref-tkl/);
});

test('compare_keyboards: real models and ISO', async () => {
  const { text } = await call('compare_keyboards', { keyboards: ['Wooting 80HE', 'wooting 60he v2'], iso: true });
  assert.match(text, /Wooting 80HE \| 80% \| 88 \| 34\.6 x 14\.2 cm/);
  assert.match(text, /Wooting 60HE v2 \| 60% \| 62 /);
  assert.match(text, /wooting-80he-vs-60he/);
});

test('compare_keyboards: unknown and ambiguous names are explained', async () => {
  let r = await call('compare_keyboards', { keyboards: ['75%', 'Banana Board'] });
  assert.equal(r.isError, true);
  assert.match(r.text, /Unknown keyboard or size "Banana Board"/);
  r = await call('compare_keyboards', { keyboards: ['TKL', 'wooting'] });
  assert.equal(r.isError, true);
  assert.match(r.text, /matches several keyboards/);
});

test('get_keyboard_dimensions by name, by size and as a size fallback', async () => {
  let r = await call('get_keyboard_dimensions', { query: 'Jet 75' });
  assert.match(r.text, /MCHOSE Jet 75 \| 75% \| 32\.2 x 13\.7 cm/);
  assert.match(r.text, /mchose-jet-75-review/);
  r = await call('get_keyboard_dimensions', { size: '60%' });
  assert.equal(r.text.match(/\| 60% \|/g).length, 6);
  r = await call('get_keyboard_dimensions', { query: 'tkl' });
  assert.match(r.text, /typical size 36\.9 x 14\.5 cm/);
  r = await call('get_keyboard_dimensions', { query: 'zzz' });
  assert.equal(r.isError, true);
});

test('check_desk_fit matches the website planner', async () => {
  // Same setup as the website: 120 cm desk, large pad, 42 cm/360, 75% keyboard centred
  const { text } = await call('check_desk_fit', { keyboards: ['75%', '60%'], desk_width_cm: 120, mousepad: 'large', cm_per_360: 42 });
  assert.match(text, /## 75%[^#]*Mouse room next to the keyboard: 38\.3 cm[^#]*hangs 6\.7 cm off the desk/);
  assert.match(text, /## 75%[^#]*slide the keyboard 6\.7 cm to the left/);
  assert.match(text, /## 60%[^#]*Mouse room next to the keyboard: 40\.2 cm/);
  assert.match(text, /360 turn: fits/);
});

test('check_desk_fit: custom pad needs a width', async () => {
  const r = await call('check_desk_fit', { keyboards: ['TKL'], desk_width_cm: 140, mousepad: 'custom' });
  assert.equal(r.isError, true);
  assert.match(r.text, /mousepad_width_cm/);
});

test('which_sizes_have_key', async () => {
  let { text } = await call('which_sizes_have_key', { key: 'del' });
  assert.match(text, /# Delete/);
  assert.match(text, /- 65%: yes/);
  assert.match(text, /- 60%: no/);
  ({ text } = await call('which_sizes_have_key', { key: 'F5' }));
  assert.match(text, /- 75%: yes/);
  assert.match(text, /- 65%: no/);
  ({ text } = await call('which_sizes_have_key', { key: 'arrow keys' }));
  assert.match(text, /- 65%: yes/);
  assert.match(text, /- 60%: no/);
  ({ text } = await call('which_sizes_have_key', { key: 'numpad' }));
  assert.match(text, /- Full-size \(100%\): yes/);
  assert.match(text, /- TKL \(tenkeyless\) \(80%\): no/);
  const r = await call('which_sizes_have_key', { key: 'hyper key' });
  assert.equal(r.isError, true);
});

test('list_testing_tools links the HLPlanet tools', async () => {
  const { text } = await call('list_testing_tools');
  assert.match(text, /online-keyboard-tester-tool/);
  assert.match(text, /gamepad-tester/);
});

test('search_hlplanet returns HLPlanet links (needs internet)', { skip: process.env.OFFLINE === '1' }, async () => {
  const { text, isError } = await call('search_hlplanet', { query: 'TMR 75', limit: 3 });
  assert.equal(isError, false, text);
  assert.match(text, /https:\/\/www\.hlplanet\.com\//);
  assert.doesNotMatch(text, /&#\d+;/, 'HTML entities are decoded');
});

test('HTTP transport answers MCP requests', async () => {
  const port = 38000 + Math.floor(Math.random() * 1000);
  const proc = spawn(process.execPath, ['dist/index.js', '--http'], { env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'ignore', 'pipe'] });
  try {
    await new Promise((resolve, reject) => {
      proc.stderr.on('data', (d) => d.toString().includes('listening') && resolve());
      proc.on('exit', reject);
      setTimeout(() => reject(new Error('server did not start')), 5000);
    });
    const health = await fetch(`http://localhost:${port}/health`).then((r) => r.json());
    assert.equal(health.ok, true);
    const res = await fetch(`http://localhost:${port}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'which_sizes_have_key', arguments: { key: 'Insert' } } })
    });
    const body = await res.json();
    assert.match(body.result.content[0].text, /# Insert/);
  } finally {
    proc.kill();
  }
});
