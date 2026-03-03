# mnemo CLI — Python Package

Build `mnemo-cli`, a thin CLI wrapper around the mnemo REST API.

## Package Structure
Create at `apps/cli/` (new folder):

```
apps/cli/
├── pyproject.toml
├── README.md
├── mnemo/
│   ├── __init__.py
│   ├── cli.py          — main CLI entrypoint
│   ├── client.py       — REST API client
│   └── config.py       — config (API URL, stored in ~/.mnemo/config.json)
```

## pyproject.toml
```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "mnemo-cli"
version = "0.1.0"
description = "CLI for mnemo — AI agent's Obsidian knowledge manager"
requires-python = ">=3.10"
dependencies = [
    "httpx>=0.27",
    "typer>=0.12",
    "rich>=13",
]

[project.scripts]
mnemo = "mnemo.cli:app"
```

## config.py
```python
import json
from pathlib import Path

DEFAULT_API_URL = "http://localhost:8000"
CONFIG_PATH = Path.home() / ".mnemo" / "config.json"

def get_config() -> dict:
    if CONFIG_PATH.exists():
        return json.loads(CONFIG_PATH.read_text())
    return {"api_url": DEFAULT_API_URL}

def set_config(key: str, value: str):
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    config = get_config()
    config[key] = value
    CONFIG_PATH.write_text(json.dumps(config, indent=2))

def get_api_url() -> str:
    return get_config().get("api_url", DEFAULT_API_URL)
```

## client.py
```python
import httpx
from .config import get_api_url

class MnemoClient:
    def __init__(self):
        self.base_url = get_api_url()
    
    def list_notes(self, limit: int = 20) -> list[dict]:
        r = httpx.get(f"{self.base_url}/api/v1/notes", params={"limit": limit}, timeout=10)
        r.raise_for_status()
        return r.json()
    
    def get_note(self, note_id: str) -> dict:
        r = httpx.get(f"{self.base_url}/api/v1/notes/{note_id}", timeout=10)
        r.raise_for_status()
        return r.json()
    
    def create_note(self, title: str, content: str) -> dict:
        r = httpx.post(f"{self.base_url}/api/v1/notes",
                      json={"title": title, "content": content}, timeout=10)
        r.raise_for_status()
        return r.json()
    
    def search_notes(self, query: str, limit: int = 10) -> list[dict]:
        r = httpx.get(f"{self.base_url}/api/v1/search",
                     params={"q": query, "limit": limit}, timeout=10)
        r.raise_for_status()
        return r.json()
    
    def ingest_file(self, path: str) -> dict:
        """Read a file and create a note from it."""
        from pathlib import Path as P
        p = P(path).expanduser()
        content = p.read_text(encoding="utf-8")
        title = p.stem
        return self.create_note(title=title, content=content)
    
    def delete_note(self, note_id: str) -> bool:
        r = httpx.delete(f"{self.base_url}/api/v1/notes/{note_id}", timeout=10)
        return r.status_code == 204
```

## cli.py — ALL COMMANDS

```python
import sys
import typer
from rich.console import Console
from rich.table import Table
from rich.markdown import Markdown
from .client import MnemoClient
from .config import set_config, get_api_url

app = typer.Typer(help="mnemo — AI agent's Obsidian. Knowledge management CLI.")
console = Console()
client = MnemoClient()

@app.command()
def save(
    content: str = typer.Argument(..., help="Note content (markdown supported)"),
    title: str = typer.Option("", "--title", "-t", help="Note title (auto-generated if empty)"),
):
    """Save a new note. Alias: mnemo save 'content'"""
    if not title:
        # Auto-generate title from first line
        first_line = content.split('\n')[0].strip('#').strip()
        title = first_line[:60] if first_line else "Untitled"
    
    note = client.create_note(title=title, content=content)
    console.print(f"[green]✓[/green] Saved note: [bold]{note['title']}[/bold] (id: {note['id'][:8]}...)")

@app.command()
def search(
    query: str = typer.Argument(..., help="Search query"),
    limit: int = typer.Option(10, "--limit", "-n"),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON"),
):
    """Search notes by title and content."""
    results = client.search_notes(query, limit=limit)
    if json_output:
        import json
        print(json.dumps(results, indent=2))
        return
    if not results:
        console.print(f"[yellow]No results for '{query}'[/yellow]")
        return
    for r in results:
        console.print(f"[bold]{r['title']}[/bold] [dim]{r['id'][:8]}...[/dim]")
        if r.get('content'):
            snippet = r['content'][:100].replace('\n', ' ')
            console.print(f"  [dim]{snippet}[/dim]")

@app.command(name="list")
def list_notes(
    limit: int = typer.Option(20, "--limit", "-n"),
    json_output: bool = typer.Option(False, "--json"),
):
    """List recent notes."""
    notes = client.list_notes(limit=limit)
    if json_output:
        import json
        print(json.dumps(notes, indent=2))
        return
    if not notes:
        console.print("[dim]No notes yet. Use 'mnemo save' to create one.[/dim]")
        return
    table = Table(show_header=True, header_style="bold")
    table.add_column("Title", style="bold", width=40)
    table.add_column("ID", style="dim", width=10)
    table.add_column("Updated", style="dim", width=20)
    for n in notes:
        table.add_row(n['title'][:38], n['id'][:8]+'...', n.get('updated_at', '')[:16])
    console.print(table)

@app.command()
def get(
    note_id: str = typer.Argument(..., help="Note ID"),
    json_output: bool = typer.Option(False, "--json"),
):
    """Get a note by ID."""
    note = client.get_note(note_id)
    if json_output:
        import json
        print(json.dumps(note, indent=2))
        return
    console.print(f"[bold]{note['title']}[/bold]")
    console.print(Markdown(note.get('content', '')))

@app.command()
def ingest(
    path: str = typer.Argument(..., help="File path to ingest (.md, .txt)"),
):
    """Ingest a file as a note."""
    note = client.ingest_file(path)
    console.print(f"[green]✓[/green] Ingested: [bold]{note['title']}[/bold] (id: {note['id'][:8]}...)")

@app.command()
def delete(
    note_id: str = typer.Argument(..., help="Note ID to delete"),
    force: bool = typer.Option(False, "--force", "-f", help="Skip confirmation"),
):
    """Delete a note."""
    if not force:
        confirm = typer.confirm(f"Delete note {note_id}?")
        if not confirm:
            raise typer.Abort()
    ok = client.delete_note(note_id)
    if ok:
        console.print(f"[green]✓[/green] Deleted {note_id[:8]}...")
    else:
        console.print(f"[red]✗[/red] Note not found")
        raise typer.Exit(1)

@app.command()
def config(
    api_url: str = typer.Option(None, "--api-url", help="Set mnemo API URL"),
    show: bool = typer.Option(False, "--show", help="Show current config"),
):
    """Configure mnemo CLI."""
    if show:
        console.print(f"API URL: [bold]{get_api_url()}[/bold]")
        return
    if api_url:
        set_config("api_url", api_url)
        console.print(f"[green]✓[/green] API URL set to: {api_url}")

if __name__ == "__main__":
    app()
```

## README.md for CLI
Write a clear README with:
- Installation: `pip install mnemo-cli`
- Quick start examples for AI agents
- All commands with examples
- Config section (how to point to deployed mnemo instance)

## Verification
1. `cd apps/cli && python -m venv .venv && .venv/bin/pip install -e ".[dev]" 2>/dev/null || .venv/bin/pip install httpx typer rich hatchling`
2. `.venv/bin/pip install -e .`
3. `.venv/bin/mnemo --help` must show all commands
4. `.venv/bin/mnemo list --help` must work

## Git commit
`git add -A && git commit -m "feat: mnemo-cli — Python CLI wrapper for AI agent integration"`

When done:
openclaw system event --text "Done: mnemo-cli 완료 — pip install mnemo-cli로 에이전트 연동 가능" --mode now
