import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { LAYOUTS, MODELS, PADS, SITE, SIZE_TOOL_URL, TESTING_TOOLS } from './data.js';
import {
  Board,
  LookupError,
  both,
  deskFit,
  describeKeys,
  dims,
  missingKeys,
  modelBoard,
  resolveBoard,
  resolveKeys,
  sizeBoard,
  toolLink
} from './keyboards.js';

declare const __VERSION__: string;
export const VERSION = typeof __VERSION__ === 'string' ? __VERSION__ : '0.0.0-dev';

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

function text(body: string) {
  return { content: [{ type: 'text' as const, text: body }] };
}

function fail(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

// Tool handlers return a readable message for lookup mistakes instead of a protocol error
function guard<A>(fn: (args: A) => ReturnType<typeof text> | Promise<ReturnType<typeof text>>) {
  return async (args: A) => {
    try {
      return await fn(args);
    } catch (err) {
      if (err instanceof LookupError) return fail(err.message);
      throw err;
    }
  };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, '');
}

export function createServer(): McpServer {
  const server = new McpServer(
    { name: 'hlplanet-mcp', title: 'HLPlanet Keyboard Sizes', version: VERSION, websiteUrl: SIZE_TOOL_URL },
    {
      instructions:
        'Keyboard size data from HLPlanet.com: standard layouts (100%, 98%, TKL, 75%, 65%, 60%), measured dimensions of ' +
        'keyboards reviewed on HLPlanet, desk and mousepad fit, which keys each size has, and a search of HLPlanet reviews. ' +
        'Sizes are in centimetres; convert inches by multiplying by 2.54. Include the HLPlanet links from the results ' +
        'when you answer, so people can check the visual comparison and the full reviews.'
    }
  );

  server.registerTool(
    'list_keyboard_sizes',
    {
      title: 'List keyboard sizes',
      description:
        'List the standard keyboard sizes (full-size 100%, 98%/1800, TKL 80%, 75%, 65%, 60%) with key count, typical ' +
        'dimensions, the keys each one drops compared to full-size, and who it suits. Use it for general questions like ' +
        '"what keyboard sizes are there" or "which size should I get".',
      annotations: { title: 'List keyboard sizes', ...READ_ONLY }
    },
    async () => {
      const full = sizeBoard(LAYOUTS[0]);
      const lines = ['# Keyboard sizes (ANSI)', ''];
      for (const def of LAYOUTS) {
        const b = sizeBoard(def);
        const lost = missingKeys(full, b);
        lines.push(`## ${b.name}`);
        lines.push(`- Keys: ${b.parsed.count}`);
        lines.push(`- Typical size: ${dims(b)}`);
        lines.push(`- Narrower than full-size by: ${both(full.widthMm - b.widthMm)}`);
        lines.push(`- Missing vs full-size: ${lost.length ? describeKeys(lost) : 'nothing'}`);
        lines.push(`- Best for: ${def.bestFor}`);
        lines.push(`- Reviews: ${def.reviews.map(([n, slug]) => `${n} (${SITE}${slug}/)`).join(', ')}`);
        lines.push('');
      }
      lines.push('Typical sizes use the standard 19.05 mm key spacing plus an estimated 10 mm case border.');
      lines.push(`Compare them visually, to scale: ${toolLink(LAYOUTS.map((l) => sizeBoard(l)))}`);
      return text(lines.join('\n'));
    }
  );

  server.registerTool(
    'compare_keyboards',
    {
      title: 'Compare keyboards',
      description:
        'Compare two to six keyboard sizes or real keyboards side by side: width, depth, key count, the keys each one ' +
        'is missing compared to the first, and how much desk / mouse room you gain. Accepts sizes ("TKL", "75%", "60") ' +
        `and keyboards reviewed on HLPlanet ("Wooting 60HE v2", "MCHOSE Jet 75"). Known keyboards: ${MODELS.map((m) => m.name).join(', ')}.`,
      inputSchema: {
        keyboards: z.array(z.string().min(1)).min(2).max(6).describe('Sizes or keyboard names. The first one is the reference, e.g. ["TKL", "75%", "Wooting 80HE"]'),
        iso: z.boolean().optional().describe('Use the ISO layout (UK/EU, tall Enter, extra key by left Shift). Default ANSI.')
      },
      annotations: { title: 'Compare keyboards', ...READ_ONLY }
    },
    guard(async ({ keyboards, iso }: { keyboards: string[]; iso?: boolean }) => {
      const boards = keyboards.map((k) => resolveBoard(k, iso));
      const ref = boards[0];
      const lines = [`# ${boards.map((b) => b.name).join(' vs ')}`, ''];
      lines.push('| Keyboard | Layout | Keys | Size (W x D) | Width vs ' + ref.name + ' |');
      lines.push('|---|---|---|---|---|');
      for (const b of boards) {
        const dw = b.widthMm - ref.widthMm;
        const delta = b === ref ? 'reference' : `${dw > 0 ? '+' : '-'}${both(Math.abs(dw))}`;
        lines.push(`| ${b.name} | ${b.layout.size} | ${b.parsed.count} | ${dims(b)} | ${delta} |`);
      }
      lines.push('');
      for (const b of boards.slice(1)) {
        const lost = missingKeys(ref, b);
        const added = missingKeys(b, ref);
        const dw = ref.widthMm - b.widthMm;
        lines.push(`## ${b.name} compared to ${ref.name}`);
        if (Math.abs(dw) >= 1) lines.push(`- ${dw > 0 ? 'Narrower' : 'Wider'} by ${both(Math.abs(dw))}${dw > 0 ? ': that much more room for the mouse' : ''}`);
        lines.push(`- Depth difference: ${both(Math.abs(ref.depthMm - b.depthMm))}`);
        lines.push(`- Missing keys: ${lost.length ? describeKeys(lost) + '. These are usually reached through an Fn layer.' : 'none'}`);
        if (added.length) lines.push(`- Extra keys: ${describeKeys(added)}`);
        lines.push('');
      }
      const reviews = boards.filter((b) => b.kind === 'model').map((b) => `${b.name}: ${b.link}`);
      if (reviews.length) lines.push('Reviews: ' + reviews.join(' | '));
      if (boards.some((b) => b.kind === 'model')) lines.push('Real keyboards use the case size measured in the HLPlanet review; key lists follow the standard layout of that size.');
      lines.push(`See them to scale, one under another: ${toolLink(boards, ['ref-' + ref.token])}`);
      return text(lines.join('\n'));
    })
  );

  server.registerTool(
    'get_keyboard_dimensions',
    {
      title: 'Get keyboard dimensions',
      description:
        'Measured case dimensions (width x depth) of keyboards reviewed on HLPlanet, with a link to each review. Search by ' +
        'name ("NuPhy Air75"), list every keyboard of one size ("75%"), or leave both empty to list all of them.',
      inputSchema: {
        query: z.string().optional().describe('Keyboard name or part of it, e.g. "Wooting" or "Jet 75"'),
        size: z.string().optional().describe('Only keyboards of this size: 100%, 98%, TKL, 75%, 65% or 60%')
      },
      annotations: { title: 'Get keyboard dimensions', ...READ_ONLY }
    },
    guard(async ({ query, size }: { query?: string; size?: string }) => {
      let models = MODELS;
      if (size) {
        const def = resolveBoard(size).layout;
        models = models.filter((m) => m.layout === def.id);
      }
      if (query) {
        const words = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
        models = models.filter((m) => words.every((w) => m.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(w)));
      }
      if (!models.length) {
        // Maybe they asked for a size, not a model
        if (query) {
          try {
            const b = resolveBoard(query);
            if (b.kind === 'size') return text(`${b.name}: typical size ${dims(b)}, ${b.parsed.count} keys (estimated from the standard layout).\nCompare to scale: ${toolLink([b])}`);
          } catch {
            // fall through
          }
        }
        return fail(`No reviewed keyboard matches${query ? ` "${query}"` : ''}${size ? ` in ${size}` : ''}. Known keyboards: ${MODELS.map((m) => m.name).join(', ')}.`);
      }
      const boards = models.map((m) => modelBoard(m)).sort((a, b) => b.widthMm - a.widthMm);
      const lines = ['| Keyboard | Size | Dimensions (W x D) | Review |', '|---|---|---|---|'];
      for (const b of boards) lines.push(`| ${b.name} | ${b.layout.size} | ${dims(b)} | ${b.link} |`);
      lines.push('');
      lines.push('Dimensions are the case size measured in the HLPlanet review.');
      lines.push(`Compare these to scale: ${toolLink(boards.slice(0, 6))}`);
      return text(lines.join('\n'));
    })
  );

  server.registerTool(
    'check_desk_fit',
    {
      title: 'Check desk and mousepad fit',
      description:
        'Check whether a keyboard and mousepad fit side by side on a desk. The keyboard is placed with its B key in front ' +
        'of the screen centre (move it with keyboard_offset_cm). Returns the mouse room left, whether the pad fits or how ' +
        'far it hangs off, how far the mouse sits from the screen centre, and whether a full 360-degree turn at the given ' +
        'sensitivity (cm/360) fits on the pad. Compare several keyboards at once to see which one leaves the most room.',
      inputSchema: {
        keyboards: z.array(z.string().min(1)).min(1).max(6).describe('Sizes or keyboard names, e.g. ["TKL", "75%"]'),
        desk_width_cm: z.number().positive().max(400).describe('Desk width in cm'),
        mousepad: z.enum(['small', 'medium', 'large', 'xl', 'deskmat', 'custom']).default('large').describe(
          'small 25x21, medium 36x30, large 45x40, xl 49x42, deskmat 90x40 (under keyboard and mouse), or custom'
        ),
        mousepad_width_cm: z.number().positive().max(200).optional().describe('Mousepad width in cm, when mousepad is "custom"'),
        cm_per_360: z.number().positive().max(200).optional().describe('Mouse sensitivity as cm of movement for a full 360 turn'),
        left_handed: z.boolean().optional().describe('Mouse on the left of the keyboard'),
        keyboard_offset_cm: z.number().min(-100).max(100).optional().describe('Move the keyboard from centred; negative moves it left')
      },
      annotations: { title: 'Check desk and mousepad fit', ...READ_ONLY }
    },
    guard(async (a: {
      keyboards: string[];
      desk_width_cm: number;
      mousepad?: string;
      mousepad_width_cm?: number;
      cm_per_360?: number;
      left_handed?: boolean;
      keyboard_offset_cm?: number;
    }) => {
      const padKey = a.mousepad || 'large';
      let padWidthCm: number;
      let padName: string;
      if (padKey === 'custom') {
        if (!a.mousepad_width_cm) return fail('Set mousepad_width_cm when mousepad is "custom".');
        padWidthCm = a.mousepad_width_cm;
        padName = `custom mousepad (${padWidthCm} cm wide)`;
      } else {
        padWidthCm = PADS[padKey].widthMm / 10;
        padName = PADS[padKey].name;
      }
      const boards: Board[] = a.keyboards.map((k) => resolveBoard(k));
      const input = {
        deskWidthCm: a.desk_width_cm,
        padWidthCm,
        isDeskMat: padKey === 'deskmat',
        leftHanded: !!a.left_handed,
        cmPer360: a.cm_per_360,
        offsetCm: a.keyboard_offset_cm || 0
      };
      const lines = [`# Desk fit: ${a.desk_width_cm} cm desk, ${padName}${a.cm_per_360 ? `, ${a.cm_per_360} cm/360` : ''}`, ''];
      for (const b of boards) {
        const r = deskFit(b, input);
        lines.push(`## ${b.name} (${dims(b)})`);
        lines.push(`- Mouse room next to the keyboard: ${r.mouseRoomCm.toFixed(1)} cm`);
        if (input.isDeskMat) lines.push(`- ${r.padFits ? 'Plenty of mat left for the mouse' : 'The mat leaves little room for the mouse'}`);
        else lines.push(`- ${r.padFits ? `Mousepad fits, ${r.padSpareCm.toFixed(1)} cm to spare` : `Mousepad hangs ${(-r.padSpareCm).toFixed(1)} cm off the desk`}`);
        lines.push(`- Mouse sits ${r.mouseFromCentreCm.toFixed(1)} cm from the screen centre`);
        if (r.swipeFits !== undefined) lines.push(`- 360 turn: ${r.swipeFits ? 'fits' : `needs ${r.swipeShortCm!.toFixed(1)} cm more`}`);
        if (r.slideToFitCm) lines.push(`- Tip: slide the keyboard ${r.slideToFitCm.toFixed(1)} cm to the ${input.leftHanded ? 'right' : 'left'} and the pad fits`);
        if (r.deskTooNarrowCm) lines.push(`- This desk is ${r.deskTooNarrowCm.toFixed(1)} cm too narrow for this keyboard and pad side by side`);
        if (b.kind === 'model') lines.push(`- Review: ${b.link}`);
        lines.push('');
      }
      lines.push('Assumes 3 cm between keyboard and mousepad, with the keyboard centred on the screen.');
      lines.push(`Try it on a drawing of your desk: ${toolLink(boards, ['desk'])}`);
      return text(lines.join('\n'));
    })
  );

  server.registerTool(
    'which_sizes_have_key',
    {
      title: 'Which keyboard sizes have a key',
      description:
        'Check which keyboard sizes have a key or key group, e.g. "Delete", "F5", "Insert", "Print Screen", "backtick", ' +
        '"arrow keys", "numpad", "function keys". Sizes without it usually reach it through an Fn layer.',
      inputSchema: {
        key: z.string().min(1).describe('A key name or group: "Delete", "F12", "Home", "arrow keys", "numpad"...'),
        iso: z.boolean().optional().describe('Use the ISO layout (UK/EU)')
      },
      annotations: { title: 'Which keyboard sizes have a key', ...READ_ONLY }
    },
    guard(async ({ key, iso }: { key: string; iso?: boolean }) => {
      const found = resolveKeys(key);
      if (!found) return fail(`Unknown key "${key}". Try a name like "Delete", "F5", "Page Up", "Print Screen", "arrow keys" or "numpad".`);
      const boards = LAYOUTS.map((l) => sizeBoard(l, iso));
      const lines = [`# ${found.label}`, ''];
      for (const b of boards) {
        const have = found.codes.filter((c) => b.parsed.codes.has(c));
        let state: string;
        if (have.length === found.codes.length) state = 'yes';
        else if (have.length) state = `partly (${have.length} of ${found.codes.length} keys)`;
        else state = 'no, usually on an Fn layer';
        lines.push(`- ${b.name}: ${state}`);
      }
      lines.push('');
      lines.push('Layouts vary slightly by brand; this follows the most common arrangement of each size.');
      lines.push(`Press the key on the interactive comparison to see where it sits: ${SIZE_TOOL_URL}`);
      return text(lines.join('\n'));
    })
  );

  server.registerTool(
    'search_hlplanet',
    {
      title: 'Search HLPlanet reviews',
      description:
        'Search HLPlanet.com, a review site for Hall effect, TMR and rapid trigger keyboards, gaming controllers and ' +
        'gaming gear. Returns matching reviews, comparisons and guides with links. Use it to find a review of a ' +
        'specific keyboard or controller, or articles on a topic like "TMR 75%" or "stick drift".',
      inputSchema: {
        query: z.string().min(2).max(100).describe('What to search for, e.g. "Wooting 80HE" or "low profile hall effect"'),
        limit: z.number().int().min(1).max(10).default(5).describe('Number of results (1-10)')
      },
      annotations: { title: 'Search HLPlanet reviews', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ query, limit }: { query: string; limit?: number }) => {
      const url = `${SITE}wp-json/wp/v2/search?search=${encodeURIComponent(query)}&per_page=${limit || 5}&_fields=title,url,subtype`;
      let results: { title: string; url: string; subtype: string }[];
      try {
        const res = await fetch(url, { headers: { 'User-Agent': `hlplanet-mcp/${VERSION}`, Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
        if (!res.ok) return fail(`HLPlanet search failed (HTTP ${res.status}). Try again later or search at ${SITE}?s=${encodeURIComponent(query)}`);
        results = (await res.json()) as typeof results;
      } catch (err) {
        return fail(`HLPlanet search is unreachable (${(err as Error).message}). Search directly at ${SITE}?s=${encodeURIComponent(query)}`);
      }
      if (!results.length) return text(`No HLPlanet articles match "${query}". Browse all reviews at ${SITE}`);
      const lines = [`HLPlanet results for "${query}":`, ''];
      for (const r of results) lines.push(`- ${decodeEntities(r.title)}: ${r.url}`);
      return text(lines.join('\n'));
    }
  );

  server.registerTool(
    'list_testing_tools',
    {
      title: 'List free testing tools',
      description:
        'List free browser tools from HLPlanet for testing keyboards and controllers: keyboard tester (every key, ' +
        'rollover, chatter, rapid trigger, SOCD / Snap Tap), gamepad and stick drift tester, controller reaction time test ' +
        'and keyboard size comparison. These need a person at the device, so share the links rather than running them.',
      annotations: { title: 'List free testing tools', ...READ_ONLY }
    },
    async () => text(['Free HLPlanet tools:', '', ...TESTING_TOOLS.map(([n, u, d]) => `- ${n}: ${u}\n  ${d}`)].join('\n'))
  );

  return server;
}
