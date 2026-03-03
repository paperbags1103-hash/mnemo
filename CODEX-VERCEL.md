# mnemo Vercel Full-Stack Migration

Migrate the FastAPI backend to Vercel Python Functions so the entire mnemo stack runs on Vercel for free. Replace SQLite with Turso (libSQL cloud).

## Architecture After Migration

```
Vercel
├── apps/frontend/dist/          → static frontend
└── api/                         → Python serverless functions
    ├── notes.py                 → GET/POST /api/v1/notes
    ├── notes_id.py              → GET/PATCH/DELETE /api/v1/notes/{id}
    ├── search.py                → GET /api/v1/search
    ├── tree.py                  → GET /api/v1/tree
    ├── health.py                → GET /health/live, /health/ready
    └── _lib/                    → shared code
        ├── db.py                → Turso client
        ├── models.py            → Pydantic models
        └── config.py            → env vars
```

## Step 1: Create api/ folder structure at project root

Create `api/` at `/Users/superdog/Documents/mnemo/api/` (NOT inside apps/).

### api/_lib/__init__.py
Empty.

### api/_lib/config.py
```python
import os
from pathlib import Path

TURSO_URL = os.environ.get("TURSO_URL", "")
TURSO_AUTH_TOKEN = os.environ.get("TURSO_AUTH_TOKEN", "")

# Fallback to local SQLite for dev (Vercel has /tmp writeable)
SQLITE_PATH = os.environ.get("SQLITE_PATH", "/tmp/mnemo.db")

def is_turso() -> bool:
    return bool(TURSO_URL)
```

### api/_lib/models.py
```python
from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4
from pydantic import BaseModel, Field

def utcnow() -> datetime:
    return datetime.now(timezone.utc)

class NoteBase(BaseModel):
    title: str = Field(default="Untitled", max_length=255)
    content: str = Field(default="", max_length=1_000_000)
    folder_id: Optional[str] = Field(default=None, max_length=255)

class NoteCreate(NoteBase):
    pass

class NoteUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=255)
    content: Optional[str] = Field(default=None, max_length=1_000_000)
    folder_id: Optional[str] = Field(default=None, max_length=255)
    version: Optional[int] = None

class NoteRead(NoteBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    version: int

    model_config = {"from_attributes": True}
```

### api/_lib/db.py
```python
from __future__ import annotations
import sqlite3
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4
from pathlib import Path

from .config import TURSO_URL, TURSO_AUTH_TOKEN, SQLITE_PATH, is_turso
from .models import NoteCreate, NoteRead, NoteUpdate

def utcnow() -> datetime:
    return datetime.now(timezone.utc)

def _get_conn():
    """Get a database connection. Uses Turso if configured, else local SQLite."""
    if is_turso():
        import libsql_client
        # libsql_client sync wrapper for serverless
        # Use libsql-experimental for Vercel
        import libsql_experimental as libsql
        conn = libsql.connect(TURSO_URL, auth_token=TURSO_AUTH_TOKEN)
        return conn
    else:
        db_path = Path(SQLITE_PATH)
        db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        return conn

def initialize():
    conn = _get_conn()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS note (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL DEFAULT '',
            folder_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            version INTEGER NOT NULL DEFAULT 1
        )
    """)
    conn.commit()
    return conn

def _row_to_note(row) -> NoteRead:
    if isinstance(row, sqlite3.Row):
        d = dict(row)
    else:
        # libsql row
        d = {
            "id": row[0], "title": row[1], "content": row[2],
            "folder_id": row[3], "created_at": row[4], "updated_at": row[5],
            "version": row[6],
        }
    return NoteRead(
        id=UUID(d["id"]),
        title=d["title"],
        content=d["content"],
        folder_id=d["folder_id"],
        created_at=datetime.fromisoformat(d["created_at"]),
        updated_at=datetime.fromisoformat(d["updated_at"]),
        version=int(d["version"]),
    )

def list_notes(conn) -> list[NoteRead]:
    cur = conn.execute("SELECT id, title, content, folder_id, created_at, updated_at, version FROM note ORDER BY datetime(updated_at) DESC")
    return [_row_to_note(row) for row in cur.fetchall()]

def get_note(conn, note_id: str) -> NoteRead | None:
    cur = conn.execute("SELECT id, title, content, folder_id, created_at, updated_at, version FROM note WHERE id = ?", (note_id,))
    row = cur.fetchone()
    return _row_to_note(row) if row else None

def create_note(conn, payload: NoteCreate) -> NoteRead:
    now = utcnow().isoformat()
    note_id = str(uuid4())
    conn.execute(
        "INSERT INTO note (id, title, content, folder_id, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (note_id, payload.title, payload.content, payload.folder_id, now, now, 1),
    )
    conn.commit()
    return get_note(conn, note_id)

def update_note(conn, note_id: str, payload: NoteUpdate) -> NoteRead | None:
    current = get_note(conn, note_id)
    if current is None:
        return None
    updates = payload.model_dump(exclude_unset=True)
    expected_version = updates.pop("version", None)
    if expected_version is not None and expected_version != current.version:
        raise ValueError("version_conflict")
    if not updates:
        return current
    title = updates.get("title", current.title)
    content = updates.get("content", current.content)
    folder_id = updates.get("folder_id", current.folder_id)
    now = utcnow().isoformat()
    new_version = current.version + 1
    conn.execute(
        "UPDATE note SET title=?, content=?, folder_id=?, updated_at=?, version=? WHERE id=?",
        (title, content, folder_id, now, new_version, note_id),
    )
    conn.commit()
    return get_note(conn, note_id)

def delete_note(conn, note_id: str) -> bool:
    cur = conn.execute("DELETE FROM note WHERE id = ?", (note_id,))
    conn.commit()
    return cur.rowcount > 0

def search_notes(conn, query: str, limit: int = 10) -> list[NoteRead]:
    pattern = f"%{query}%"
    cur = conn.execute(
        "SELECT id, title, content, folder_id, created_at, updated_at, version FROM note WHERE title LIKE ? OR content LIKE ? ORDER BY datetime(updated_at) DESC LIMIT ?",
        (pattern, pattern, limit),
    )
    return [_row_to_note(row) for row in cur.fetchall()]
```

### api/notes.py
```python
"""GET /api/v1/notes  POST /api/v1/notes"""
import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

from _lib.db import initialize, list_notes, create_note
from _lib.models import NoteCreate

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        conn = initialize()
        notes = list_notes(conn)
        conn.close()
        body = json.dumps([n.model_dump(mode="json") for n in notes])
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body.encode())

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        payload_dict = json.loads(raw)
        payload = NoteCreate(**payload_dict)
        conn = initialize()
        note = create_note(conn, payload)
        conn.close()
        body = json.dumps(note.model_dump(mode="json"))
        self.send_response(201)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body.encode())

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
```

### api/search.py
```python
"""GET /api/v1/search?q=...&limit=10"""
import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

from _lib.db import initialize, search_notes, list_notes

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        params = parse_qs(urlparse(self.path).query)
        q = params.get("q", [""])[0]
        limit = int(params.get("limit", [10])[0])
        conn = initialize()
        if q.strip():
            results = search_notes(conn, q, limit=limit)
        else:
            results = list_notes(conn)[:limit]
        conn.close()
        body = json.dumps({"query": q, "results": [n.model_dump(mode="json") for n in results]})
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body.encode())

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
```

### api/health.py
```python
"""GET /api/health"""
import json
from http.server import BaseHTTPRequestHandler
from _lib.config import is_turso, TURSO_URL

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = json.dumps({
            "status": "ok",
            "storage": "turso" if is_turso() else "sqlite-ephemeral",
            "warning": None if is_turso() else "TURSO_URL not set — data is ephemeral on Vercel",
        })
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body.encode())
```

## Step 2: Update vercel.json

Create/overwrite `vercel.json` at project root:
```json
{
  "version": 2,
  "buildCommand": "cd apps/frontend && npm install --legacy-peer-deps && npm run build",
  "outputDirectory": "apps/frontend/dist",
  "rewrites": [
    { "source": "/api/v1/notes", "destination": "/api/notes" },
    { "source": "/api/v1/search", "destination": "/api/search" },
    { "source": "/api/health", "destination": "/api/health" },
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "functions": {
    "api/**/*.py": {
      "runtime": "python3.12"
    }
  }
}
```

## Step 3: Update frontend VITE_API_URL

In `apps/frontend/.env.production` (create if not exists):
```
VITE_API_URL=
```
(Empty string means same-origin — Vercel serves both frontend and API)

In `apps/frontend/vite.config.ts`, ensure the proxy only applies in dev:
The proxy config is already dev-only (vite dev server). No changes needed.

## Step 4: requirements.txt for Vercel Python runtime

Create `api/requirements.txt`:
```
pydantic>=2.0
libsql-experimental
```

## Final steps

1. Verify: `cd api && python3 -c "from _lib.db import initialize; print('ok')"`
2. `cd ~/Documents/mnemo && git add api/ vercel.json && git commit -m "feat: Vercel full-stack — Python Functions + Turso-ready db layer"`

Note: git push likely fails in sandbox (network blocked) — that's OK.
Do NOT run npm install or frontend builds — too slow and unnecessary for this task.
