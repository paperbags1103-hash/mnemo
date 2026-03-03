# mnemo Code Fixes — Opus Review Round 2

Apply ALL the following fixes. These are ordered by severity. Do not skip any.

## 🔴 Fix 1: Implement search endpoint
**File:** `apps/backend/app/api/v1/search.py`

Replace the stub with real SQLite LIKE search:
```python
from fastapi import APIRouter
from app.core.db import db

router = APIRouter(prefix="/search", tags=["search"])

@router.get("")
async def search_notes(q: str = "", limit: int = 10) -> dict:
    """Search notes by title and content."""
    if not q.strip():
        notes = await db.list_notes()
        return {"query": q, "results": [n.model_dump() for n in notes[:limit]]}
    results = await db.search_notes(q, limit=limit)
    return {"query": q, "results": [n.model_dump() for n in results]}
```

Add `search_notes` method to `apps/backend/app/core/db.py`:
```python
async def search_notes(self, query: str, limit: int = 10) -> list[NoteRead]:
    pattern = f"%{query}%"
    async with aiosqlite.connect(self.sqlite_path) as connection:
        connection.row_factory = aiosqlite.Row
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

## 🔴 Fix 2: Fix CLI search parameter mismatch
**File:** `apps/cli/mnemo/client.py`

Change `search_notes` to use `q` parameter (matching the server):
```python
def search_notes(self, query: str, limit: int = 10) -> list[dict]:
    response = httpx.get(
        f"{self.base_url}/api/v1/search",
        params={"q": query, "limit": limit},
        timeout=10,
    )
    response.raise_for_status()
    payload = response.json()
    if isinstance(payload, dict):
        results = payload.get("results", [])
    else:
        results = payload
    return results[:limit]
```

## 🔴 Fix 3: Enable SQLite WAL mode
**File:** `apps/backend/app/core/db.py`

In `initialize()`, add WAL mode after creating tables:
```python
async def initialize(self) -> None:
    self.sqlite_path.parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(self.sqlite_path) as connection:
        await connection.execute("PRAGMA journal_mode=WAL")
        await connection.execute("PRAGMA synchronous=NORMAL")
        # ... rest of CREATE TABLE statements
```

## 🔴 Fix 4: Validate note_id in Kuzu queries
**File:** `apps/backend/app/services/lorien_client.py`

Add UUID validation before Kuzu queries:
```python
import re

_UUID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)

async def get_note_entities(self, note_id: str) -> list[dict]:
    if not _UUID_RE.match(note_id):
        return []
    # rest of method unchanged

async def get_note_facts(self, note_id: str) -> list[dict]:
    if not _UUID_RE.match(note_id):
        return []
    # rest of method unchanged
```

## 🟡 Fix 5: Fix Content-Length ValueError
**File:** `apps/backend/app/main.py`

```python
@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            size = int(content_length)
        except ValueError:
            size = 0
        if size > 2_000_000:
            return JSONResponse(status_code=413, content={"detail": "Request too large"})
    return await call_next(request)
```

## 🟡 Fix 6: Add worker restart on failure
**File:** `apps/backend/app/workers/ingest_worker.py`

Wrap the worker loop with proper error handling and add done callback in main.py:
```python
# In ingest_worker.py - already has try/except, but ensure it never stops:
async def run_worker(interval_seconds: int = 10) -> None:
    """Background worker loop. Restarts automatically on unexpected errors."""
    consecutive_errors = 0
    while True:
        try:
            await process_pending_jobs()
            consecutive_errors = 0
        except asyncio.CancelledError:
            raise  # Let CancelledError propagate to stop the task
        except Exception as exc:
            consecutive_errors += 1
            wait = min(interval_seconds * consecutive_errors, 60)
            logger.error("Worker error (attempt %d): %s. Retrying in %ds", consecutive_errors, exc, wait)
            await asyncio.sleep(wait)
            continue
        await asyncio.sleep(interval_seconds)
```

In `apps/backend/app/main.py`, add done callback:
```python
@asynccontextmanager
async def lifespan(_: FastAPI):
    await db.initialize()
    worker_task = asyncio.create_task(run_worker(interval_seconds=10))
    
    def on_worker_done(task: asyncio.Task) -> None:
        if not task.cancelled():
            exc = task.exception()
            if exc:
                logger.error("Ingest worker stopped unexpectedly: %s", exc)
    
    worker_task.add_done_callback(on_worker_done)
    yield
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass
```

## 🟡 Fix 7: Prevent sys.path duplicate insertion
**File:** `apps/backend/app/services/lorien_client.py`

```python
def _get_memory(self):
    if self._memory is not None:
        return self._memory
    try:
        lorien_src = Path("~/Documents/lorien/src").expanduser()
        if lorien_src.exists() and str(lorien_src) not in sys.path:
            sys.path.insert(0, str(lorien_src))
        # If lorien_src doesn't exist, try installed package
        from lorien import LorienMemory
        db_path = settings.resolved_lorien_db_path
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self._memory = LorienMemory(str(db_path))
        logger.info("lorien loaded from %s", db_path)
        return self._memory
    except Exception as exc:
        logger.warning("lorien unavailable: %s", exc)
        return None
```

## 🟡 Fix 8: Add model_dump() conversion in search results
**File:** `apps/backend/app/api/v1/search.py`

Ensure NoteRead objects are properly serialized (model_dump() for Pydantic v2).
The search results should include `id` as string, not UUID object, for JSON serialization.
Use `model_dump(mode='json')` to ensure UUID and datetime are properly serialized.

Update db.search_notes return and search endpoint to use `model_dump(mode='json')`:
```python
return {"query": q, "results": [n.model_dump(mode='json') for n in results]}
```

Also update db.list_notes route to be consistent:
```python
# In notes.py - response_model=list[NoteRead] handles this via FastAPI
# In search.py - manual serialization needs mode='json'
```

## Final Steps
1. `cd apps/frontend && npm run build` — must still pass
2. `cd apps/backend && .venv/bin/python -c "from app.main import app; print('ok')"`
3. Start backend and test:
   - `curl -s "http://localhost:8000/api/v1/search?q=test"` should return results (not empty)
4. `git add -A && git commit -m "fix: search implementation, WAL mode, UUID validation, worker resilience"`
5. `git push origin main`

When done:
openclaw system event --text "Done: mnemo 코드 수정 완료 — search 구현, WAL, UUID 검증, worker 개선" --mode now
