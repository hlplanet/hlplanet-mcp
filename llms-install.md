# Installing the HLPlanet MCP server

Notes for AI agents (Cline, Claude Code, Cursor and others) setting up this server for a user.

## What it needs

- No API key, account or environment variables.
- Node.js 18 or newer, for the local version. Check with `node --version`.
- Nothing to clone or build: the package is published on npm as `hlplanet-mcp`.

## Option 1: local (recommended)

Add this entry to the client's MCP settings file. For Cline that is `cline_mcp_settings.json` (open it from the MCP Servers panel):

```json
{
  "mcpServers": {
    "hlplanet": {
      "command": "npx",
      "args": ["-y", "hlplanet-mcp"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

On Windows, if `npx` is not found, use `"command": "cmd"` with `"args": ["/c", "npx", "-y", "hlplanet-mcp"]`.

## Option 2: hosted

If the client supports remote MCP servers, connect to `https://api.hlplanet.com/mcp` (Streamable HTTP, no sign-in) instead. Nothing runs locally. The tools are the same.

## Check that it works

The server exposes seven read-only tools: `list_keyboard_sizes`, `compare_keyboards`, `get_keyboard_dimensions`, `check_desk_fit`, `which_sizes_have_key`, `search_hlplanet` and `list_testing_tools`.

Try `compare_keyboards` with `{"keyboards": ["TKL", "75%"]}`. The answer starts with `# TKL (tenkeyless) (80%) vs 75%` and ends with a link to the to-scale comparison on https://www.hlplanet.com/keyboard-layout/.
