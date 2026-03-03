import json

import typer
from rich.console import Console
from rich.markdown import Markdown
from rich.table import Table

from .client import MnemoClient
from .config import get_api_url, set_config

app = typer.Typer(
    help="mnemo - AI agent's Obsidian. Knowledge management CLI.",
    no_args_is_help=True,
)
console = Console()


def get_client() -> MnemoClient:
    return MnemoClient()


@app.command()
def save(
    content: str = typer.Argument(..., help="Note content (markdown supported)"),
    title: str = typer.Option("", "--title", "-t", help="Note title (auto-generated if empty)"),
) -> None:
    """Save a new note. Alias: mnemo save 'content'."""
    if not title:
        first_line = content.split("\n", 1)[0].strip("#").strip()
        title = first_line[:60] if first_line else "Untitled"

    note = get_client().create_note(title=title, content=content)
    console.print(f"[green]OK[/green] Saved note: [bold]{note['title']}[/bold] (id: {note['id'][:8]}...)")


@app.command()
def upsert(
    content: str = typer.Argument(..., help="Note content"),
    title: str = typer.Option("", "--title", "-t"),
) -> None:
    """Create or update note by title."""
    if not title:
        first_line = content.split("\n", 1)[0].strip("#").strip()
        title = first_line[:60] if first_line else "Untitled"

    note = get_client().upsert_note(title=title, content=content)
    console.print(f"[green]OK[/green] Upserted: [bold]{note['title']}[/bold] (id: {note['id'][:8]}...)")


@app.command()
def webhook(
    content: str = typer.Argument(..., help="Webhook note content"),
    title: str = typer.Option("", "--title", "-t"),
    source: str = typer.Option("", "--source", "-s"),
    upsert: bool = typer.Option(False, "--upsert", help="Update latest note with matching title"),
    tags: list[str] = typer.Option([], "--tag", help="Repeatable tag"),
) -> None:
    """Send a note through the webhook endpoint."""
    if not title:
        first_line = content.split("\n", 1)[0].strip("#").strip()
        title = first_line[:60] if first_line else "Untitled"

    note = get_client().webhook_save(
        title=title,
        content=content,
        source=source,
        upsert=upsert,
        tags=tags,
    )
    console.print(f"[green]OK[/green] Webhook saved: [bold]{note['title']}[/bold] (id: {note['id'][:8]}...)")


@app.command()
def search(
    query: str = typer.Argument(..., help="Search query"),
    limit: int = typer.Option(10, "--limit", "-n"),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON"),
) -> None:
    """Search notes by title and content."""
    results = get_client().search_notes(query, limit=limit)
    if json_output:
        print(json.dumps(results, indent=2))
        return
    if not results:
        console.print(f"[yellow]No results for '{query}'[/yellow]")
        return
    for result in results:
        console.print(f"[bold]{result['title']}[/bold] [dim]{result['id'][:8]}...[/dim]")
        if result.get("content"):
            snippet = result["content"][:100].replace("\n", " ")
            console.print(f"  [dim]{snippet}[/dim]")


@app.command(name="list")
def list_notes(
    limit: int = typer.Option(20, "--limit", "-n"),
    json_output: bool = typer.Option(False, "--json"),
) -> None:
    """List recent notes."""
    notes = get_client().list_notes(limit=limit)
    if json_output:
        print(json.dumps(notes, indent=2))
        return
    if not notes:
        console.print("[dim]No notes yet. Use 'mnemo save' to create one.[/dim]")
        return
    table = Table(show_header=True, header_style="bold")
    table.add_column("Title", style="bold", width=40)
    table.add_column("ID", style="dim", width=10)
    table.add_column("Updated", style="dim", width=20)
    for note in notes:
        updated_at = note.get("updated_at", "")[:16]
        table.add_row(note["title"][:38], f"{note['id'][:8]}...", updated_at)
    console.print(table)


@app.command()
def get(
    note_id: str = typer.Argument(..., help="Note ID"),
    json_output: bool = typer.Option(False, "--json"),
) -> None:
    """Get a note by ID."""
    note = get_client().get_note(note_id)
    if json_output:
        print(json.dumps(note, indent=2))
        return
    console.print(f"[bold]{note['title']}[/bold]")
    console.print(Markdown(note.get("content", "")))


@app.command()
def ingest(
    path: str = typer.Argument(..., help="File path to ingest (.md, .txt)"),
) -> None:
    """Ingest a file as a note."""
    note = get_client().ingest_file(path)
    console.print(f"[green]OK[/green] Ingested: [bold]{note['title']}[/bold] (id: {note['id'][:8]}...)")


@app.command()
def delete(
    note_id: str = typer.Argument(..., help="Note ID to delete"),
    force: bool = typer.Option(False, "--force", "-f", help="Skip confirmation"),
) -> None:
    """Delete a note."""
    if not force:
        confirm = typer.confirm(f"Delete note {note_id}?")
        if not confirm:
            raise typer.Abort()
    ok = get_client().delete_note(note_id)
    if ok:
        console.print(f"[green]OK[/green] Deleted {note_id[:8]}...")
        return
    console.print("[red]Error[/red] Note not found")
    raise typer.Exit(1)


@app.command()
def config(
    api_url: str | None = typer.Option(None, "--api-url", help="Set mnemo API URL"),
    show: bool = typer.Option(False, "--show", help="Show current config"),
) -> None:
    """Configure mnemo CLI."""
    if api_url:
        set_config("api_url", api_url)
        console.print(f"[green]OK[/green] API URL set to: {api_url}")
    if show or not api_url:
        console.print(f"API URL: [bold]{get_api_url()}[/bold]")


if __name__ == "__main__":
    app()
