# mnemo Phase 1 — Foundation

## Overview
Fix search, add bearer token auth, add note_link table, delete debug files.

## Task 1: Fix Search (replace FTS5 with LIKE)

Edit `api/_lib/db.py`:
- Find the `search_notes` function
- Remove ALL FTS5/virtual table creation code (note_fts table, tokenize='trigram', etc.)
- Replace with simple LIKE query:
  ```python
  def search_notes(conn, q: str, limit: int = 20) -> list[NoteRead]:
      q_like = f"%{q}%"
      rows = conn.execute(
          "SELECT * FROM notes WHERE title LIKE ? OR content LIKE ? ORDER BY updated_at DESC LIMIT ?",
          (q_like, q_like, limit),
      ).fetchall()
      return [NoteRead(**dict(zip([c[0] for c in conn.execute("PRAGMA table_info(notes)").fetchall()], row))) for row in rows]
  ```
  
  Actually, look at how other functions like `list_notes` retrieve rows and use the same pattern for `search_notes`. The key is: use LIKE search on title and content columns, return list of NoteRead objects.

Also in `apps/backend/app/db/notes.py` (if it exists), make the same fix.

## Task 2: Bearer Token Auth

Edit `api/_lib/config.py`:
- Add: `MNEMO_TOKEN = os.environ.get("MNEMO_TOKEN", "")`

Create `api/_lib/auth.py`:
```python
import os
from http.server import BaseHTTPRequestHandler

MNEMO_TOKEN = os.environ.get("MNEMO_TOKEN", "")

def check_write_auth(headers) -> bool:
    """Returns True if write access is allowed. GET requests skip this."""
    if not MNEMO_TOKEN:
        return True  # dev mode: no token set = open access
    auth = headers.get("Authorization", "")
    return auth == f"Bearer {MNEMO_TOKEN}"
```

Edit the following files to use `check_write_auth` for POST/PATCH/DELETE/PUT methods only (NOT GET):
- `api/notes.py` — do_POST, do_PUT
- `api/notes_id.py` — do_PATCH, do_DELETE  
- `api/webhook.py` — do_POST

Replace existing `_check_auth` calls in these files with `check_write_auth` from `api/_lib/auth.py`.

Also update CORS headers in do_OPTIONS methods to include `Authorization` header:
```
Access-Control-Allow-Headers: Content-Type, X-Api-Key, Authorization
```

## Task 3: Add note_link Table

Edit `api/_lib/db.py` in the `initialize()` function, add after the notes table creation:
```sql
CREATE TABLE IF NOT EXISTS note_link (
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    link_type TEXT DEFAULT 'manual',
    created_at TEXT NOT NULL,
    PRIMARY KEY (source_id, target_id)
)
```

Add these functions to `api/_lib/db.py`:
```python
def get_links(conn, note_id: str) -> dict:
    """Returns outlinks and backlinks for a note."""
    outlinks = conn.execute(
        "SELECT target_id, link_type, created_at FROM note_link WHERE source_id = ?",
        (note_id,)
    ).fetchall()
    backlinks = conn.execute(
        "SELECT source_id, link_type, created_at FROM note_link WHERE target_id = ?",
        (note_id,)
    ).fetchall()
    return {
        "outlinks": [{"note_id": r[0], "link_type": r[1], "created_at": r[2]} for r in outlinks],
        "backlinks": [{"note_id": r[0], "link_type": r[1], "created_at": r[2]} for r in backlinks],
    }

def create_link(conn, source_id: str, target_id: str, link_type: str = "manual") -> bool:
    from datetime import datetime, timezone
    try:
        conn.execute(
            "INSERT OR IGNORE INTO note_link (source_id, target_id, link_type, created_at) VALUES (?, ?, ?, ?)",
            (source_id, target_id, link_type, datetime.now(timezone.utc).isoformat())
        )
        conn.commit()
        return True
    except Exception:
        return False

def delete_link(conn, source_id: str, target_id: str) -> bool:
    conn.execute(
        "DELETE FROM note_link WHERE source_id = ? AND target_id = ?",
        (source_id, target_id)
    )
    conn.commit()
    return True
```

Create `api/links.py`:
```python
"""GET /api/v1/notes/:noteId/links — get backlinks and outlinks
POST /api/v1/links — create a link
DELETE /api/v1/links — delete a link"""

import json
import os as _os
import sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
from _lib.db import close_conn, initialize, get_links, create_link, delete_link
from _lib.auth import check_write_auth


class handler(BaseHTTPRequestHandler):
    def _write_json(self, status: int, payload) -> None:
        body = json.dumps(payload)
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body.encode())

    def do_GET(self):
        params = parse_qs(urlparse(self.path).query)
        note_id = params.get("note_id", [None])[0]
        if not note_id:
            self._write_json(400, {"detail": "note_id required"})
            return
        conn = initialize()
        try:
            links = get_links(conn, note_id)
        finally:
            close_conn(conn)
        self._write_json(200, links)

    def do_POST(self):
        if not check_write_auth(self.headers):
            self._write_json(401, {"detail": "Unauthorized"})
            return
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        data = json.loads(raw or b"{}")
        source_id = data.get("source_id")
        target_id = data.get("target_id")
        link_type = data.get("link_type", "manual")
        if not source_id or not target_id:
            self._write_json(400, {"detail": "source_id and target_id required"})
            return
        conn = initialize()
        try:
            create_link(conn, source_id, target_id, link_type)
        finally:
            close_conn(conn)
        self._write_json(201, {"source_id": source_id, "target_id": target_id, "link_type": link_type})

    def do_DELETE(self):
        if not check_write_auth(self.headers):
            self._write_json(401, {"detail": "Unauthorized"})
            return
        params = parse_qs(urlparse(self.path).query)
        source_id = params.get("source_id", [None])[0]
        target_id = params.get("target_id", [None])[0]
        if not source_id or not target_id:
            self._write_json(400, {"detail": "source_id and target_id required"})
            return
        conn = initialize()
        try:
            delete_link(conn, source_id, target_id)
        finally:
            close_conn(conn)
        self._write_json(204, {})

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
```

## Task 4: Update vercel.json

Add these rewrites to `vercel.json` (before the catch-all `/(.*)`):
```json
{ "source": "/api/v1/notes/:noteId/links", "destination": "/api/links?note_id=:noteId" },
{ "source": "/api/v1/links", "destination": "/api/links" }
```

## Task 5: Delete debug files

Delete these files:
- `api/health_test.py`
- `api/dbg_path.py`

## Task 6: Build verification

Run: `cd apps/frontend && npm run build 2>&1 | tail -5`
Must pass with no errors.

## Final Steps

1. Run build verification
2. `cd ~/Documents/mnemo && git add -A && git commit -m "feat: Phase 1 — LIKE search, bearer token auth, note_link table"`

Note: git push will fail in sandbox. That's OK.
