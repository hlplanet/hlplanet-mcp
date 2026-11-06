# HLPlanet MCP: keyboard sizes, dimensions and desk fit

An [MCP](https://modelcontextprotocol.io) server that lets AI assistants answer keyboard size questions with real data:

- Compare **full-size, 98%, TKL, 75%, 65% and 60%** layouts: size difference, missing keys, extra mouse room
- Look up the **measured dimensions of 30 keyboards** reviewed on [HLPlanet](https://www.hlplanet.com/)
- Check whether a keyboard and **mousepad fit on your desk**, including a full 360° turn at your sensitivity
- Find out **which sizes have a key** (Delete, F5, Insert, arrows, numpad...)
- **Search HLPlanet reviews** of Hall effect, TMR and rapid trigger keyboards and gaming controllers

The data matches the interactive [keyboard size comparison](https://www.hlplanet.com/keyboard-layout/) on HLPlanet, and every answer links to it so you can see the layouts to scale.

> "Will a TKL and my 45 cm mousepad fit on a 120 cm desk?"
> "How much smaller is a 75% than a TKL, and what keys do I lose?"
> "How wide is the MCHOSE Jet 75 compared to the Wooting 80HE?"
> "Which keyboard sizes still have a Delete key?"

## Install

No API key or account needed.

**Hosted, nothing to install**: connect any client that supports remote MCP servers to `https://api.hlplanet.com/mcp` (Streamable HTTP, [docs](https://api.hlplanet.com/docs/mcp)). In Claude Code: `claude mcp add --transport http hlplanet https://api.hlplanet.com/mcp`.

To run it locally instead, you need Node.js 18 or newer.

**Claude Desktop**: download `hlplanet-mcp.mcpb` from the [latest release](https://github.com/hlplanet/hlplanet-mcp/releases/latest) and double-click it. Or add this to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "hlplanet": {
      "command": "npx",
      "args": ["-y", "hlplanet-mcp"]
    }
  }
}
```

**Claude Code**

```bash
claude mcp add hlplanet -- npx -y hlplanet-mcp
```

**Cursor**: add the same `mcpServers` block as above to `~/.cursor/mcp.json`.

**VS Code**

```bash
code --add-mcp "{\"name\":\"hlplanet\",\"command\":\"npx\",\"args\":[\"-y\",\"hlplanet-mcp\"]}"
```

**Streamable HTTP**: `npx -y hlplanet-mcp --http` serves the MCP endpoint at `http://localhost:3000/mcp` (set `PORT` to change it).

## Tools

| Tool | What it does |
|---|---|
| `list_keyboard_sizes` | Every standard size with key count, typical dimensions, missing keys and who it suits |
| `compare_keyboards` | Compare 2–6 sizes or real keyboards: width, depth, keys lost or gained, mouse room |
| `get_keyboard_dimensions` | Measured case size of reviewed keyboards, searchable by name or size |
| `check_desk_fit` | Keyboard + mousepad on your desk: room left, pad overhang, distance from screen centre, 360° turn fit |
| `which_sizes_have_key` | Which sizes have a key or key group, and which need an Fn layer |
| `search_hlplanet` | Search HLPlanet.com reviews, comparisons and guides |
| `list_testing_tools` | Links to HLPlanet's free keyboard, gamepad and reaction time testers |

All tools are read-only. `search_hlplanet` is the only one that uses the internet (the HLPlanet.com search API); everything else runs offline.

## About the data

- Standard sizes use the 19.05 mm key spacing plus an estimated 10 mm case border. Layouts follow the most common arrangement of each size; some brands move a few keys.
- Real keyboards use the case dimensions measured in each [HLPlanet review](https://www.hlplanet.com/keyboards-hall-effect-switches/).
- The desk check places the keyboard with its B key in front of the screen centre and leaves 3 cm between keyboard and mousepad, the same as the desk planner on the website.

## More from HLPlanet

- [Keyboard size comparison](https://www.hlplanet.com/keyboard-layout/): all layouts drawn to scale, with a desk planner
- [Online keyboard tester](https://www.hlplanet.com/online-keyboard-tester-tool/): every key, rollover, chatter, rapid trigger and SOCD
- [Gamepad tester](https://www.hlplanet.com/gamepad-tester/): buttons, triggers, stick drift and rumble
- [Best rapid trigger keyboards](https://www.hlplanet.com/best-rapid-trigger-keyboards-for-gaming/)
- [Rapid Trigger & SOCD Tester](https://github.com/hlplanet/rt-socd-tester): browser extension and Windows app

## Development

```bash
npm install
npm test        # builds dist/index.js and runs the end-to-end tests over stdio and HTTP
npm run mcpb    # builds hlplanet-mcp.mcpb for Claude Desktop
```

## License

MIT © [HLPlanet](https://www.hlplanet.com/)
