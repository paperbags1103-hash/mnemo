# mnemo-cli

`mnemo-cli` is a thin Python CLI wrapper around the mnemo REST API. It is intended for quick terminal usage and for AI agents that need to save, fetch, search, and manage notes in a running mnemo instance.

## Installation

```bash
pip install mnemo-cli
```

For local development from this repository:

```bash
cd apps/cli
python -m venv .venv
.venv/bin/pip install -e .
```

## Quick Start

Start by pointing the CLI at your mnemo API, then save and search notes:

```bash
mnemo config --api-url http://localhost:8000 --show
mnemo save "# Daily log\nInvestigate retrieval latency in ingest worker" --title "Daily log"
mnemo list
mnemo search "retrieval latency"
```

AI agent oriented examples:

```bash
mnemo save "User prefers concise technical explanations." --title "Agent memory"
mnemo ingest ~/notes/product-brief.md
mnemo get 123e4567-e89b-12d3-a456-426614174000
mnemo search "product brief" --json
```

## Commands

### `mnemo save`

Create a note from inline content.

```bash
mnemo save "Ship the backend hotfix before noon"
mnemo save "# Spec\nAdd note versioning" --title "Spec draft"
```

### `mnemo search`

Search notes by title and content.

```bash
mnemo search "versioning"
mnemo search "agent memory" --limit 5
mnemo search "meeting notes" --json
```

### `mnemo list`

List recent notes.

```bash
mnemo list
mnemo list --limit 10
mnemo list --json
```

### `mnemo get`

Fetch a note by ID.

```bash
mnemo get 123e4567-e89b-12d3-a456-426614174000
mnemo get 123e4567-e89b-12d3-a456-426614174000 --json
```

### `mnemo ingest`

Read a local file and create a note from it.

```bash
mnemo ingest ./notes/roadmap.md
mnemo ingest ~/Documents/context.txt
```

### `mnemo delete`

Delete a note by ID.

```bash
mnemo delete 123e4567-e89b-12d3-a456-426614174000
mnemo delete 123e4567-e89b-12d3-a456-426614174000 --force
```

### `mnemo config`

Show or update CLI configuration.

```bash
mnemo config --show
mnemo config --api-url https://mnemo.example.com
mnemo config --api-url https://mnemo.example.com --show
```

## Configuration

The CLI stores configuration in `~/.mnemo/config.json`.

Default configuration:

```json
{
  "api_url": "http://localhost:8000"
}
```

To point the CLI at a deployed mnemo instance:

```bash
mnemo config --api-url https://your-mnemo-host.example.com
```

You can inspect the active value at any time:

```bash
mnemo config --show
```

## Notes

- The CLI targets the mnemo REST API under `/api/v1`.
- `mnemo save` auto-generates a title from the first content line when `--title` is omitted.
- `mnemo ingest` reads files as UTF-8 text.
