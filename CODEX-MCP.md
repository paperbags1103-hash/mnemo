# mnemo MCP Server

Build an MCP (Model Context Protocol) server for mnemo at `apps/mcp/`.

## Setup

```bash
mkdir -p apps/mcp
cd apps/mcp
python3 -m venv .venv
.venv/bin/pip install mcp httpx
```

## Files to create

### apps/mcp/pyproject.toml
```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "mnemo-mcp"
version = "0.1.0"
description = "MCP server for mnemo knowledge management"
requires-python = ">=3.11"
dependencies = [
    "mcp>=1.0.0",
    "httpx>=0.27.0",
]

[project.scripts]
mnemo-mcp = "mnemo_mcp.server:main"

[tool.hatch.build.targets.wheel]
packages = ["mnemo_mcp"]
```

### apps/mcp/mnemo_mcp/__init__.py
Empty file.

### apps/mcp/mnemo_mcp/server.py
```python
"""mnemo MCP server — exposes mnemo REST API as MCP tools."""

import os
from typing import Any

import httpx
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import (
    CallToolResult,
    ListToolsResult,
    TextContent,
    Tool,
)

MNEMO_API_URL = os.environ.get("MNEMO_API_URL", "http://localhost:8000").rstrip("/")

server = Server("mnemo")


def _client() -> httpx.Client:
    return httpx.Client(base_url=MNEMO_API_URL, timeout=10)


# ── Tool definitions ──────────────────────────────────────────────────────────

@server.list_tools()
async def list_tools() -> ListToolsResult:
    return ListToolsResult(tools=[
        Tool(
            name="mnemo_save",
            description="Save a new note to mnemo knowledge base.",
            inputSchema={
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Note title"},
                    "content": {"type": "string", "description": "Note content (markdown supported)"},
                },
                "required": ["title", "content"],
            },
        ),
        Tool(
            name="mnemo_search",
            description="Search notes in mnemo by title and content.",
            inputSchema={
                "type": "object",
                "properties": {
                    "q": {"type": "string", "description": "Search query"},
                    "limit": {"type": "integer", "description": "Max results (default 10)", "default": 10},
                },
                "required": ["q"],
            },
        ),
        Tool(
            name="mnemo_list",
            description="List recent notes from mnemo.",
            inputSchema={
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Max notes to return (default 20)", "default": 20},
                },
            },
        ),
        Tool(
            name="mnemo_get",
            description="Get a specific note by ID from mnemo.",
            inputSchema={
                "type": "object",
                "properties": {
                    "note_id": {"type": "string", "description": "Note UUID"},
                },
                "required": ["note_id"],
            },
        ),
        Tool(
            name="mnemo_delete",
            description="Delete a note from mnemo by ID.",
            inputSchema={
                "type": "object",
                "properties": {
                    "note_id": {"type": "string", "description": "Note UUID to delete"},
                },
                "required": ["note_id"],
            },
        ),
    ])


# ── Tool handlers ─────────────────────────────────────────────────────────────

@server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> CallToolResult:
    try:
        with _client() as client:
            if name == "mnemo_save":
                r = client.post("/api/v1/notes", json={
                    "title": arguments["title"],
                    "content": arguments["content"],
                })
                r.raise_for_status()
                note = r.json()
                text = f"Saved note '{note['title']}' (id: {note['id']})"

            elif name == "mnemo_search":
                r = client.get("/api/v1/search", params={
                    "q": arguments["q"],
                    "limit": arguments.get("limit", 10),
                })
                r.raise_for_status()
                data = r.json()
                results = data.get("results", [])
                if not results:
                    text = f"No results for '{arguments['q']}'"
                else:
                    lines = [f"Found {len(results)} result(s) for '{arguments['q']}':"]
                    for n in results:
                        snippet = (n.get("content") or "")[:80].replace("\n", " ")
                        lines.append(f"- [{n['id'][:8]}] {n['title']}: {snippet}")
                    text = "\n".join(lines)

            elif name == "mnemo_list":
                r = client.get("/api/v1/notes")
                r.raise_for_status()
                notes = r.json()
                limit = arguments.get("limit", 20)
                notes = notes[:limit]
                if not notes:
                    text = "No notes found."
                else:
                    lines = [f"{len(notes)} note(s):"]
                    for n in notes:
                        lines.append(f"- [{n['id'][:8]}] {n['title']} ({n['updated_at'][:10]})")
                    text = "\n".join(lines)

            elif name == "mnemo_get":
                r = client.get(f"/api/v1/notes/{arguments['note_id']}")
                r.raise_for_status()
                note = r.json()
                text = f"# {note['title']}\n\n{note['content']}"

            elif name == "mnemo_delete":
                r = client.delete(f"/api/v1/notes/{arguments['note_id']}")
                if r.status_code == 404:
                    text = f"Note {arguments['note_id']} not found."
                else:
                    r.raise_for_status()
                    text = f"Deleted note {arguments['note_id']}"

            else:
                text = f"Unknown tool: {name}"

    except httpx.ConnectError:
        text = f"Error: mnemo backend not running at {MNEMO_API_URL}. Start it with: cd ~/Documents/mnemo/apps/backend && .venv/bin/uvicorn app.main:app"
    except httpx.HTTPStatusError as e:
        text = f"Error: {e.response.status_code} — {e.response.text}"
    except Exception as e:
        text = f"Error: {e}"

    return CallToolResult(content=[TextContent(type="text", text=text)])


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    import asyncio
    asyncio.run(stdio_server(server))


if __name__ == "__main__":
    main()
```

### apps/mcp/README.md
Write a README explaining:
- What mnemo MCP server is
- Installation: `pip install -e .` inside apps/mcp/
- Configuration: add to Claude Desktop config at `~/Library/Application Support/Claude/claude_desktop_config.json`:
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
- Available tools: mnemo_save, mnemo_search, mnemo_list, mnemo_get, mnemo_delete
- Note: mnemo backend must be running (uvicorn)

## Final steps

1. `cd apps/mcp && .venv/bin/pip install -e . -q`
2. Verify: `.venv/bin/mnemo-mcp --help 2>/dev/null || echo "server ready (stdio mode, no --help)"` 
3. Test import: `.venv/bin/python -c "from mnemo_mcp.server import server; print('MCP server ok')"`
4. `cd ~/Documents/mnemo && git add apps/mcp && git commit -m "feat: mnemo MCP server — Claude Desktop integration"`
5. `git push origin main`

Note: git push will fail due to sandbox network restrictions — that's OK, just commit locally.
