"""mnemo MCP server - exposes mnemo REST API as MCP tools."""

import asyncio
import os
from typing import Any

import httpx

try:
    from mcp.server.fastmcp import FastMCP
except ImportError:  # pragma: no cover - depends on installed mcp version
    FastMCP = None

try:
    from mcp.server import Server
    from mcp.server.stdio import stdio_server
    from mcp.types import CallToolResult, ListToolsResult, TextContent, Tool
except ImportError:  # pragma: no cover - depends on installed mcp version
    Server = None
    stdio_server = None
    CallToolResult = ListToolsResult = TextContent = Tool = None

MNEMO_API_URL = os.environ.get("MNEMO_API_URL", "http://localhost:8000").rstrip("/")


def _snippet(content: str, limit: int = 80) -> str:
    return content[:limit].replace("\n", " ")


async def _request(method: str, path: str, **kwargs: Any) -> httpx.Response:
    async with httpx.AsyncClient(base_url=MNEMO_API_URL, timeout=10) as client:
        response = await client.request(method, path, **kwargs)
        return response


async def _save_note(title: str, content: str) -> str:
    response = await _request(
        "POST",
        "/api/v1/notes",
        json={"title": title, "content": content},
    )
    response.raise_for_status()
    note = response.json()
    return f"Saved note '{note['title']}' (id: {note['id']})"


async def _search_notes(q: str, limit: int = 10) -> str:
    response = await _request("GET", "/api/v1/search", params={"q": q, "limit": limit})
    response.raise_for_status()
    data = response.json()
    results = data.get("results", [])
    if not results:
        return f"No results for '{q}'"

    lines = [f"Found {len(results)} result(s) for '{q}':"]
    for note in results:
        lines.append(
            f"- [{note['id'][:8]}] {note['title']}: {_snippet(note.get('content') or '')}"
        )
    return "\n".join(lines)


async def _list_notes(limit: int = 20) -> str:
    response = await _request("GET", "/api/v1/notes")
    response.raise_for_status()
    notes = response.json()[:limit]
    if not notes:
        return "No notes found."

    lines = [f"{len(notes)} note(s):"]
    for note in notes:
        lines.append(f"- [{note['id'][:8]}] {note['title']} ({note['updated_at'][:10]})")
    return "\n".join(lines)


async def _get_note(note_id: str) -> str:
    response = await _request("GET", f"/api/v1/notes/{note_id}")
    response.raise_for_status()
    note = response.json()
    return f"# {note['title']}\n\n{note['content']}"


async def _delete_note(note_id: str) -> str:
    response = await _request("DELETE", f"/api/v1/notes/{note_id}")
    if response.status_code == 404:
        return f"Note {note_id} not found."
    response.raise_for_status()
    return f"Deleted note {note_id}"


async def _dispatch(name: str, arguments: dict[str, Any]) -> str:
    try:
        if name == "mnemo_save":
            return await _save_note(arguments["title"], arguments["content"])
        if name == "mnemo_search":
            return await _search_notes(arguments["q"], arguments.get("limit", 10))
        if name == "mnemo_list":
            return await _list_notes(arguments.get("limit", 20))
        if name == "mnemo_get":
            return await _get_note(arguments["note_id"])
        if name == "mnemo_delete":
            return await _delete_note(arguments["note_id"])
        return f"Unknown tool: {name}"
    except httpx.ConnectError:
        return (
            "Error: mnemo backend not running at "
            f"{MNEMO_API_URL}. Start it with: cd ~/Documents/mnemo/apps/backend && "
            ".venv/bin/uvicorn app.main:app"
        )
    except httpx.HTTPStatusError as exc:
        return f"Error: {exc.response.status_code} - {exc.response.text}"
    except Exception as exc:  # pragma: no cover - defensive error surface for MCP clients
        return f"Error: {exc}"


def _tool_definitions() -> list[dict[str, Any]]:
    return [
        {
            "name": "mnemo_save",
            "description": "Save a new note to mnemo knowledge base.",
            "schema": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Note title"},
                    "content": {
                        "type": "string",
                        "description": "Note content (markdown supported)",
                    },
                },
                "required": ["title", "content"],
            },
        },
        {
            "name": "mnemo_search",
            "description": "Search notes in mnemo by title and content.",
            "schema": {
                "type": "object",
                "properties": {
                    "q": {"type": "string", "description": "Search query"},
                    "limit": {
                        "type": "integer",
                        "description": "Max results (default 10)",
                        "default": 10,
                    },
                },
                "required": ["q"],
            },
        },
        {
            "name": "mnemo_list",
            "description": "List recent notes from mnemo.",
            "schema": {
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Max notes to return (default 20)",
                        "default": 20,
                    }
                },
            },
        },
        {
            "name": "mnemo_get",
            "description": "Get a specific note by ID from mnemo.",
            "schema": {
                "type": "object",
                "properties": {
                    "note_id": {"type": "string", "description": "Note UUID"},
                },
                "required": ["note_id"],
            },
        },
        {
            "name": "mnemo_delete",
            "description": "Delete a note from mnemo by ID.",
            "schema": {
                "type": "object",
                "properties": {
                    "note_id": {"type": "string", "description": "Note UUID to delete"},
                },
                "required": ["note_id"],
            },
        },
    ]


if FastMCP is not None:
    server = FastMCP("mnemo")

    @server.tool()
    async def mnemo_save(title: str, content: str) -> str:
        """Save a new note to mnemo knowledge base."""
        return await _save_note(title, content)

    @server.tool()
    async def mnemo_search(q: str, limit: int = 10) -> str:
        """Search notes in mnemo by title and content."""
        return await _search_notes(q, limit)

    @server.tool()
    async def mnemo_list(limit: int = 20) -> str:
        """List recent notes from mnemo."""
        return await _list_notes(limit)

    @server.tool()
    async def mnemo_get(note_id: str) -> str:
        """Get a specific note by ID from mnemo."""
        return await _get_note(note_id)

    @server.tool()
    async def mnemo_delete(note_id: str) -> str:
        """Delete a note from mnemo by ID."""
        return await _delete_note(note_id)

elif Server is not None and Tool is not None:
    server = Server("mnemo")

    @server.list_tools()
    async def list_tools() -> ListToolsResult:
        return ListToolsResult(
            tools=[
                Tool(
                    name=tool["name"],
                    description=tool["description"],
                    inputSchema=tool["schema"],
                )
                for tool in _tool_definitions()
            ]
        )

    @server.call_tool()
    async def call_tool(name: str, arguments: dict[str, Any]) -> CallToolResult:
        text = await _dispatch(name, arguments)
        return CallToolResult(content=[TextContent(type="text", text=text)])

else:  # pragma: no cover - only reached when mcp is unavailable
    server = None


def main() -> None:
    if server is None:
        raise RuntimeError("mcp package is not installed or is missing required server modules")

    if FastMCP is not None:
        if hasattr(server, "run"):
            server.run(transport="stdio")
            return
        if hasattr(server, "run_stdio_async"):
            asyncio.run(server.run_stdio_async())
            return

    if stdio_server is not None:
        result = stdio_server(server)
        if asyncio.iscoroutine(result):
            asyncio.run(result)
            return

    raise RuntimeError("Unsupported mcp stdio server API")


if __name__ == "__main__":
    main()
