# mnemo MCP Server

`mnemo-mcp` exposes the mnemo backend REST API as MCP tools so Claude Desktop and other MCP clients can save, search, list, fetch, and delete notes.

## Installation

From `apps/mcp/`:

```bash
pip install -e .
```

## Configuration

Add this server entry to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mnemo": {
      "command": "/Users/superdog/Documents/mnemo/apps/mcp/.venv/bin/mnemo-mcp",
      "env": {
        "MNEMO_API_URL": "http://localhost:8000"
      }
    }
  }
}
```

## Available Tools

- `mnemo_save`
- `mnemo_search`
- `mnemo_list`
- `mnemo_get`
- `mnemo_delete`

## Note

The mnemo backend must be running for the MCP server to work, for example:

```bash
cd ~/Documents/mnemo/apps/backend
.venv/bin/uvicorn app.main:app
```
