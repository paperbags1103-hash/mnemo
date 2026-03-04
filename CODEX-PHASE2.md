# mnemo Phase 2 — Agent-Native Features

## Overview
Build the agent-native layer: Daily Digest view, source badges, backlinks panel, [[wikilink]] syntax, tag sidebar.

## Task 1: Add `source` column to notes table

Edit `api/_lib/db.py`:
- In `initialize()`, after the note table creation, add migration:
  ```python
  try:
      conn.execute("ALTER TABLE note ADD COLUMN source TEXT DEFAULT 'human'")
      conn.commit()
  except Exception:
      pass  # column already exists
  ```

Edit `api/_lib/models.py`:
- Add `source: str = "human"` to `NoteBase` (or `NoteRead` and `NoteCreate`)
- Make sure it's included in `NoteRead`

Edit `api/_lib/db.py` in `_row_to_note()` and all SELECT queries to include `source` column.

Edit `api/webhook.py` do_POST to save the `source` field from request body into the note.

## Task 2: Daily Digest API endpoint

Create `api/digest.py`:
```python
"""GET /api/v1/digest — last 24h notes grouped by source"""
import json
import os as _os
import sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from datetime import datetime, timezone, timedelta
from http.server import BaseHTTPRequestHandler
from _lib.db import close_conn, initialize

class handler(BaseHTTPRequestHandler):
    def _write_json(self, status, payload):
        body = json.dumps(payload)
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body.encode())

    def do_GET(self):
        since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        conn = initialize()
        try:
            rows = conn.execute(
                """SELECT id, title, content, source, created_at, updated_at
                   FROM note
                   WHERE created_at >= ?
                   ORDER BY created_at DESC""",
                (since,)
            ).fetchall()
        finally:
            close_conn(conn)
        
        # Group by source
        groups = {}
        for row in rows:
            note_id, title, content, source, created_at, updated_at = row
            src = source or "human"
            if src not in groups:
                groups[src] = []
            groups[src].append({
                "id": note_id,
                "title": title,
                "content": content[:200] + "..." if content and len(content) > 200 else content,
                "created_at": created_at,
            })
        
        self._write_json(200, {
            "since": since,
            "groups": [{"source": src, "notes": notes} for src, notes in groups.items()],
            "total": len(rows),
        })

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
```

Add to `vercel.json` rewrites (before the catch-all):
```json
{ "source": "/api/v1/digest", "destination": "/api/digest" }
```

## Task 3: Digest page in React frontend

Create `apps/frontend/src/features/digest/DigestPage.tsx`:
- A full page component showing the 24h digest
- Fetch from `GET /api/v1/digest` using the existing `api` client
- Layout: 
  - Header: "Daily Digest" + timestamp showing "Last 24 hours"
  - For each source group: a section with source badge + list of note cards
  - Each note card: title (clickable to navigate to note), content preview, time ago
  - Source badge colors: "human" = blue, "chire" = purple, others = gray
- If no notes: empty state "No notes in the last 24 hours"

Add routing in `apps/frontend/src/App.tsx` (or wherever routes are defined):
- Add route `/digest` → `DigestPage`
- Add a "Digest" link in the sidebar navigation

Use existing UI components (Button, Card if available) and Tailwind classes.
The page should match the existing light/white Notion-style aesthetic.

## Task 4: Backlinks panel in NoteEditor

Edit `apps/frontend/src/features/notes/components/NoteEditor.tsx`:

Add a backlinks section below the editor. When a note is selected:
1. Fetch `GET /api/v1/notes/{noteId}/links` 
2. Display backlinks (notes that link TO this note) as clickable list items
3. Show outlinks (notes this note links TO) as well
4. Only show the panel if there are any links (hide if empty)

Layout suggestion (below the editor area):
```
─────────────────────────────
Links (2 backlinks, 1 outlink)
  ← From: [Note Title A]
  ← From: [Note Title B]  
  → To: [Note Title C]
─────────────────────────────
```

Clicking a linked note title navigates to that note (update selectedNoteId in store).

You'll need to fetch note titles for the link IDs. Add a helper that fetches `GET /api/v1/notes/{id}` for each linked note ID to get its title.

## Task 5: Replace folder sidebar with tag sidebar

Edit `apps/frontend/src/features/notes/components/NotesSidebar.tsx` (or similar sidebar component):

Current: Shows folder tree or flat list
New: Shows tag filter pills + flat note list

Add `GET /api/v1/tags` endpoint in `api/tags.py`:
```python
"""GET /api/v1/tags — list all unique tags"""
import json
import os as _os
import sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from http.server import BaseHTTPRequestHandler
from _lib.db import close_conn, initialize

class handler(BaseHTTPRequestHandler):
    def _write_json(self, status, payload):
        body = json.dumps(payload)
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body.encode())

    def do_GET(self):
        conn = initialize()
        try:
            rows = conn.execute("SELECT tags FROM note WHERE tags != '[]' AND tags IS NOT NULL").fetchall()
        finally:
            close_conn(conn)
        all_tags = set()
        for (tags_json,) in rows:
            try:
                import json as _json
                tags = _json.loads(tags_json)
                all_tags.update(tags)
            except Exception:
                pass
        self._write_json(200, {"tags": sorted(all_tags)})

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
```

Add to `vercel.json`: `{ "source": "/api/v1/tags", "destination": "/api/tags" }`

In the sidebar:
- Top: search input (existing)
- Below: scrollable tag pills (if tags exist). Clicking a tag filters the note list to show only notes with that tag. Clicking again deselects.
- Below: note list (filtered by selected tag if any, otherwise all notes)
- Each note list item: title + source badge (small, colored)

## Task 6: Build and verify

Run: `cd apps/frontend && npm run build 2>&1 | tail -5`
Must succeed.

## Final Steps

1. `git add -A && git commit -m "feat: Phase 2 — Daily Digest, backlinks panel, tag sidebar, source field"`

Note: git push will fail in sandbox. That's OK — commit locally.
