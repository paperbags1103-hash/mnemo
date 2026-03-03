# mnemo v0.2 — Webhook, FTS5, Tags, API Key, Upsert

Implement the following features on top of the existing codebase at `/Users/superdog/Documents/mnemo`.

---

## Feature 1: API Key Authentication

Add `MNEMO_API_KEY` environment variable check to all API endpoints.

### apps/backend/app/core/config.py — add field:
```python
mnemo_api_key: str = Field(default="", env="MNEMO_API_KEY")
```

### apps/backend/app/core/auth.py — create new file:
```python
from fastapi import Header, HTTPException, status
from app.core.config import settings

async def verify_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """If MNEMO_API_KEY is set, require it in X-Api-Key header."""
    if not settings.mnemo_api_key:
        return  # No key configured — open access (dev mode)
    if x_api_key != settings.mnemo_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key. Set X-Api-Key header.",
        )
```

Add `dependencies=[Depends(verify_api_key)]` to notes, search, tree, and webhook routers:
```python
from app.core.auth import verify_api_key
from fastapi import Depends

router = APIRouter(prefix="/notes", tags=["notes"], dependencies=[Depends(verify_api_key)])
```

Add to Vercel functions too: `api/notes.py`, `api/search.py`, `api/tree.py`, `api/health.py`:
```python
import os
MNEMO_API_KEY = os.environ.get("MNEMO_API_KEY", "")

def _check_auth(headers) -> bool:
    if not MNEMO_API_KEY:
        return True
    return headers.get("X-Api-Key") == MNEMO_API_KEY
```

In each handler's do_GET/do_POST etc:
```python
if not _check_auth(self.headers):
    self._write_json(401, {"detail": "Invalid or missing API key"})
    return
```

Also update `api/_lib/config.py`:
```python
MNEMO_API_KEY = os.environ.get("MNEMO_API_KEY", "")
```

---

## Feature 2: SQLite FTS5 Full-Text Search

### apps/backend/app/core/db.py

In `initialize()`, add FTS5 virtual table after note table:
```python
await connection.execute(
    """
    CREATE VIRTUAL TABLE IF NOT EXISTS note_fts
    USING fts5(
        id UNINDEXED,
        title,
        content,
        tokenize='trigram'
    )
    """
)
# Sync FTS from existing notes
await connection.execute(
    """
    INSERT OR IGNORE INTO note_fts (id, title, content)
    SELECT id, title, content FROM note
    """
)
```

After INSERT in `create_note()`, also insert into FTS:
```python
await connection.execute(
    "INSERT INTO note_fts (id, title, content) VALUES (?, ?, ?)",
    (str(note.id), note.title, note.content),
)
```

After UPDATE in `update_note()`, update FTS:
```python
await connection.execute(
    "DELETE FROM note_fts WHERE id = ?", (str(current.id),)
)
await connection.execute(
    "INSERT INTO note_fts (id, title, content) VALUES (?, ?, ?)",
    (str(current.id), current.title, current.content),
)
```

After DELETE in `delete_note()`, delete from FTS:
```python
await connection.execute("DELETE FROM note_fts WHERE id = ?", (str(note_id),))
```

Replace `search_notes` with FTS5 version:
```python
async def search_notes(self, query: str, limit: int = 10) -> list[NoteRead]:
    """FTS5 full-text search with trigram tokenizer (supports Korean)."""
    async with aiosqlite.connect(self.sqlite_path) as connection:
        connection.row_factory = aiosqlite.Row
        try:
            cursor = await connection.execute(
                """
                SELECT n.id, n.title, n.content, n.folder_id, n.created_at, n.updated_at, n.version
                FROM note n
                JOIN note_fts fts ON n.id = fts.id
                WHERE note_fts MATCH ?
                ORDER BY rank
                LIMIT ?
                """,
                (query, limit),
            )
        except Exception:
            # Fallback to LIKE if FTS fails (e.g. special chars)
            pattern = f"%{query}%"
            cursor = await connection.execute(
                """
                SELECT id, title, content, folder_id, created_at, updated_at, version
                FROM note
                WHERE title LIKE ? OR content LIKE ?
                ORDER BY datetime(updated_at) DESC
                LIMIT ?
                """,
                (pattern, pattern, limit),
            )
        rows = await cursor.fetchall()
        return [self._row_to_note(row) for row in rows]
```

Also update `api/_lib/db.py` search_notes with the same FTS5 logic (using sqlite3 sync, not aiosqlite):
```python
def search_notes(conn, query: str, limit: int = 10) -> list[NoteRead]:
    # Ensure FTS table exists
    conn.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS note_fts
        USING fts5(id UNINDEXED, title, content, tokenize='trigram')
    """)
    try:
        cur = conn.execute(
            """
            SELECT n.id, n.title, n.content, n.folder_id, n.created_at, n.updated_at, n.version
            FROM note n JOIN note_fts fts ON n.id = fts.id
            WHERE note_fts MATCH ? ORDER BY rank LIMIT ?
            """,
            (query, limit),
        )
    except Exception:
        pattern = f"%{query}%"
        cur = conn.execute(
            "SELECT id, title, content, folder_id, created_at, updated_at, version FROM note WHERE title LIKE ? OR content LIKE ? ORDER BY datetime(updated_at) DESC LIMIT ?",
            (pattern, pattern, limit),
        )
    return [_row_to_note(row) for row in cur.fetchall()]
```

---

## Feature 3: Tags Support

### apps/backend/app/models/note.py

Add `tags` field to NoteBase, NoteUpdate:
```python
class NoteBase(SQLModel):
    title: str = Field(default="Untitled", max_length=255)
    content: str = Field(default="", max_length=1_000_000)
    folder_id: str | None = Field(default=None, max_length=255)
    tags: list[str] = Field(default_factory=list)
```

### apps/backend/app/core/db.py

In `initialize()`, add tags column migration:
```python
# Add tags column if not exists (migration)
try:
    await connection.execute("ALTER TABLE note ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'")
    await connection.commit()
except Exception:
    pass  # Column already exists
```

In all SELECT queries, add `tags` column:
```sql
SELECT id, title, content, folder_id, tags, created_at, updated_at, version FROM note ...
```

In INSERT: add `tags` field (store as JSON string `json.dumps(tags)`)
In `_row_to_note`: parse `json.loads(row["tags"] or "[]")`

Update `NoteRead` to include `tags: list[str]`

Update `_row_to_note` static method:
```python
import json
...
return NoteRead(
    ...
    tags=json.loads(row["tags"] or "[]"),
)
```

---

## Feature 4: Upsert (find-or-create by title)

Add `upsert_note` method to DatabaseManager in db.py:
```python
async def upsert_note(self, payload: NoteCreate) -> tuple[NoteRead, bool]:
    """Find note by title and update content, or create new. Returns (note, created)."""
    async with aiosqlite.connect(self.sqlite_path) as connection:
        connection.row_factory = aiosqlite.Row
        cursor = await connection.execute(
            "SELECT id FROM note WHERE title = ? ORDER BY datetime(created_at) DESC LIMIT 1",
            (payload.title,),
        )
        row = await cursor.fetchone()
        if row:
            note_id = row["id"]
            note = await self.update_note(
                note_id,
                NoteUpdate(content=payload.content, folder_id=payload.folder_id),
            )
            return note, False
        else:
            note = await self.create_note(payload)
            return note, True
```

Add upsert endpoint to `apps/backend/app/api/v1/notes.py`:
```python
@router.put("", response_model=NoteRead)
async def upsert_note(payload: NoteCreate) -> NoteRead:
    """Create note or update if title already exists (idempotent write for agents)."""
    note, created = await db.upsert_note(payload)
    try:
        await db.enqueue_ingest(str(note.id))
    except Exception as exc:
        logger.warning("Failed to enqueue ingest for note %s: %s", note.id, exc)
    return note
```

---

## Feature 5: Webhook Receiver

Create `apps/backend/app/api/v1/webhook.py`:
```python
"""POST /api/v1/webhooks/save — external agents push notes directly."""
import logging
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, status
from app.core.db import db
from app.models.note import NoteCreate, NoteRead

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
logger = logging.getLogger(__name__)


class WebhookPayload(BaseModel):
    title: str = "Untitled"
    content: str = ""
    tags: list[str] = []
    source: str = ""  # Optional: who sent this (e.g. "binancebot", "치레")
    upsert: bool = False  # If True, update existing note with same title


@router.post("/save", response_model=NoteRead, status_code=status.HTTP_201_CREATED)
async def webhook_save(payload: WebhookPayload) -> NoteRead:
    """
    Receive a note from any external agent.
    
    Example:
        curl -X POST http://localhost:8000/api/v1/webhooks/save \\
          -H "Content-Type: application/json" \\
          -H "X-Api-Key: your_key" \\
          -d '{"title": "Meeting notes", "content": "...", "source": "claude"}'
    """
    note_payload = NoteCreate(
        title=payload.title,
        content=f"**Source:** {payload.source}\n\n{payload.content}" if payload.source else payload.content,
        folder_id=None,
    )
    
    if payload.upsert:
        note, created = await db.upsert_note(note_payload)
    else:
        note = await db.create_note(note_payload)
    
    try:
        await db.enqueue_ingest(str(note.id))
    except Exception as exc:
        logger.warning("Failed to enqueue ingest for note %s: %s", note.id, exc)
    
    return note
```

Register webhook router in `apps/backend/app/main.py`:
```python
from app.api.v1 import health, ingest, lorien, notes, search, tree, webhook
...
app.include_router(webhook.router, prefix=settings.api_v1_prefix)
```

Also add webhook handler to `api/webhook.py` for Vercel:
```python
"""POST /api/v1/webhooks/save"""
import json
from http.server import BaseHTTPRequestHandler
from _lib.db import initialize, create_note, close_conn, upsert_note
from _lib.models import NoteCreate
from _lib.config import MNEMO_API_KEY

class handler(BaseHTTPRequestHandler):
    def _write_json(self, status, payload):
        body = json.dumps(payload)
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body.encode())

    def do_POST(self):
        if MNEMO_API_KEY and self.headers.get("X-Api-Key") != MNEMO_API_KEY:
            self._write_json(401, {"detail": "Invalid or missing API key"})
            return
        length = int(self.headers.get("Content-Length", 0))
        data = json.loads(self.rfile.read(length) or b"{}")
        title = data.get("title", "Untitled")
        content = data.get("content", "")
        source = data.get("source", "")
        do_upsert = data.get("upsert", False)
        if source:
            content = f"**Source:** {source}\n\n{content}"
        payload = NoteCreate(title=title, content=content)
        conn = initialize()
        try:
            if do_upsert:
                note, _ = upsert_note(conn, payload)
            else:
                note = create_note(conn, payload)
        finally:
            close_conn(conn)
        self._write_json(201, note.model_dump(mode="json"))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Api-Key")
        self.end_headers()
```

Add upsert_note to `api/_lib/db.py`:
```python
def upsert_note(conn, payload: NoteCreate) -> tuple:
    cur = conn.execute(
        "SELECT id FROM note WHERE title = ? ORDER BY datetime(created_at) DESC LIMIT 1",
        (payload.title,),
    )
    row = cur.fetchone()
    if row:
        note_id = row[0] if not isinstance(row, sqlite3.Row) else row["id"]
        # Update content
        now = utcnow().isoformat()
        conn.execute(
            "UPDATE note SET content=?, updated_at=?, version=version+1 WHERE id=?",
            (payload.content, now, note_id),
        )
        conn.commit()
        return get_note(conn, note_id), False
    else:
        return create_note(conn, payload), True
```

Add webhook rewrite to `vercel.json`:
```json
{ "source": "/api/v1/webhooks/save", "destination": "/api/webhook" }
```
(Add this before the catch-all rewrite)

---

## Feature 6: mnemo-cli — add upsert and webhook commands

Add to `apps/cli/mnemo/client.py`:
```python
def upsert_note(self, title: str, content: str) -> dict:
    """Create or update note by title (idempotent)."""
    response = httpx.put(
        f"{self.base_url}/api/v1/notes",
        json={"title": title, "content": content},
        timeout=10,
    )
    response.raise_for_status()
    return response.json()
```

Add to `apps/cli/mnemo/cli.py`:
```python
@app.command()
def upsert(
    content: str = typer.Argument(..., help="Note content"),
    title: str = typer.Option("", "--title", "-t"),
) -> None:
    """Create or update note by title (idempotent — safe to call repeatedly)."""
    if not title:
        first_line = content.split("\n", 1)[0].strip("#").strip()
        title = first_line[:60] if first_line else "Untitled"
    note = get_client().upsert_note(title=title, content=content)
    console.print(f"[green]OK[/green] Upserted: [bold]{note['title']}[/bold] (id: {note['id'][:8]}...)")
```

---

## Final Steps

1. Run: `cd apps/backend && .venv/bin/python -c "from app.main import app; print('ok')"`
2. Start backend and test:
   - `curl -X POST http://localhost:8000/api/v1/webhooks/save -H "Content-Type: application/json" -d '{"title":"Webhook test","content":"Hello from webhook","source":"test"}'`
   - `curl -s "http://localhost:8000/api/v1/search?q=webhook"` should return the note
3. `git add -A && git commit -m "feat: v0.2 — webhook, FTS5, tags, API key auth, upsert"`

Note: git push will fail in sandbox (network blocked). That's OK — just commit locally.
