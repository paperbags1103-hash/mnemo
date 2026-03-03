# mnemo Phase 3 — Async lorien Ingestion & Resilience

Implement async knowledge ingestion pipeline. Note saves must ALWAYS succeed independently of lorien.

## Current State
- Backend: FastAPI + aiosqlite SQLite, Note CRUD working
- lorien: Python library at ~/Documents/lorien/, has `LorienMemory` class
- lorien serve: basic HTTP server on port 7331, no write API

## Phase 3 Tasks

### 1. IngestJob model (apps/backend/app/models/ingest_job.py)
Create/update IngestJob SQLModel (not table=True):
```python
class IngestJob:
    id: UUID (uuid4)
    note_id: str
    status: str  # "pending" | "processing" | "done" | "failed"
    retry_count: int = 0
    max_retries: int = 3
    next_retry_at: datetime | None = None
    error: str | None = None
    created_at: datetime
    updated_at: datetime
```

### 2. IngestJob DB table (apps/backend/app/core/db.py)
Add to `DatabaseManager.initialize()`:
```sql
CREATE TABLE IF NOT EXISTS ingest_job (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    next_retry_at TEXT,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
)
```

Add methods:
- `enqueue_ingest(note_id: str) -> IngestJob` — creates pending job
- `get_pending_jobs(limit: int = 10) -> list[IngestJob]` — gets jobs ready to run
- `mark_job_processing(job_id: str)` — sets status=processing
- `mark_job_done(job_id: str)` — sets status=done
- `mark_job_failed(job_id: str, error: str)` — increments retry_count, sets next_retry_at (exponential backoff: 30s * 2^retry_count), if retry_count >= max_retries set status=failed
- `list_jobs(status: str | None, limit: int) -> list[IngestJob]`

### 3. lorien client (apps/backend/app/services/lorien_client.py)
Create `LorienClient` that wraps the lorien Python library directly (not HTTP):

```python
import asyncio
from pathlib import Path
from app.core.config import settings

class LorienClient:
    def __init__(self):
        self._memory = None
    
    def _get_memory(self):
        """Lazy-load lorien. Returns None if unavailable."""
        if self._memory is not None:
            return self._memory
        try:
            # Try to import lorien from the local path
            import sys
            lorien_src = Path("~/Documents/lorien/src").expanduser()
            if lorien_src.exists() and str(lorien_src) not in sys.path:
                sys.path.insert(0, str(lorien_src))
            from lorien import LorienMemory
            db_path = settings.resolved_lorien_db_path
            db_path.parent.mkdir(parents=True, exist_ok=True)
            self._memory = LorienMemory(str(db_path))
            return self._memory
        except Exception:
            return None
    
    async def ingest_note(self, note_id: str, title: str, content: str) -> bool:
        """Ingest a note into lorien. Returns True on success, False on failure."""
        try:
            memory = await asyncio.get_event_loop().run_in_executor(
                None, self._get_memory
            )
            if memory is None:
                return False
            
            text = f"# {title}\n\n{content}" if title else content
            # Strip HTML tags from content (TipTap produces HTML)
            import re
            text_clean = re.sub(r'<[^>]+>', '', text)
            text_clean = re.sub(r'\s+', ' ', text_clean).strip()
            
            if not text_clean or len(text_clean) < 10:
                return True  # Skip empty notes, not a failure
            
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: memory.ingest_text(text_clean, source=f"mnemo:note:{note_id}", keyword_only=True)
            )
            return True
        except Exception as e:
            raise RuntimeError(f"lorien ingest failed: {e}") from e
    
    def is_available(self) -> bool:
        return self._get_memory() is not None

lorien_client = LorienClient()
```

### 4. Ingest worker (apps/backend/app/workers/ingest_worker.py)
```python
import asyncio
import logging
from datetime import datetime, timezone

from app.core.db import db
from app.services.lorien_client import lorien_client

logger = logging.getLogger(__name__)

async def process_pending_jobs():
    """Process up to 5 pending ingest jobs."""
    jobs = await db.get_pending_jobs(limit=5)
    for job in jobs:
        await db.mark_job_processing(job.id)
        try:
            note = await db.get_note(job.note_id)
            if note is None:
                await db.mark_job_done(job.id)  # Note deleted, skip
                continue
            
            success = await lorien_client.ingest_note(
                note_id=str(note.id),
                title=note.title,
                content=note.content,
            )
            if success:
                await db.mark_job_done(job.id)
                logger.info(f"Ingested note {note.id}")
            else:
                await db.mark_job_failed(job.id, "lorien unavailable")
        except Exception as e:
            logger.warning(f"Ingest job {job.id} failed: {e}")
            await db.mark_job_failed(str(job.id), str(e))

async def run_worker(interval_seconds: int = 10):
    """Background worker loop."""
    while True:
        try:
            await process_pending_jobs()
        except Exception as e:
            logger.error(f"Worker error: {e}")
        await asyncio.sleep(interval_seconds)
```

### 5. Wire worker into FastAPI lifespan (apps/backend/app/main.py)
```python
import asyncio
from app.workers.ingest_worker import run_worker

@asynccontextmanager
async def lifespan(_: FastAPI):
    await db.initialize()
    worker_task = asyncio.create_task(run_worker(interval_seconds=10))
    yield
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass
```

### 6. Enqueue on note save (apps/backend/app/api/v1/notes.py)
After `create_note` and `update_note`:
```python
@router.post("", response_model=NoteRead, status_code=status.HTTP_201_CREATED)
async def create_note(payload: NoteCreate) -> NoteRead:
    note = await db.create_note(payload)
    await db.enqueue_ingest(str(note.id))  # fire-and-forget queue
    return note

@router.patch("/{note_id}", response_model=NoteRead)
async def update_note(note_id: UUID, payload: NoteUpdate) -> NoteRead:
    note = await db.update_note(note_id, payload)
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    await db.enqueue_ingest(str(note.id))  # re-ingest on update
    return note
```

### 7. Ingest jobs API endpoint (apps/backend/app/api/v1/ingest.py)
Implement:
- `GET /api/v1/ingest/jobs?status=&limit=20` — list jobs for observability
- `POST /api/v1/ingest/jobs/{job_id}/retry` — manually retry a failed job

### 8. Update health/ready to show ingest queue depth (apps/backend/app/api/v1/health.py)
```python
@router.get("/ready")
async def health_ready():
    readiness = await db.ready_status()
    pending_count = len(await db.get_pending_jobs(limit=100))
    return {
        "status": "ok",
        **readiness,
        "lorien_available": lorien_client.is_available(),
        "ingest_queue_depth": pending_count,
    }
```

### 9. Create workers directory
Create `apps/backend/app/workers/__init__.py` (empty)

### 10. Verify
- Backend starts without error: `.venv/bin/python -c "from app.main import app; print('ok')"`
- Test: create a note via API, then check GET /api/v1/ingest/jobs shows a job
- `npm run build` in frontend still passes

### 11. Git commit
`git add -A && git commit -m "feat: Phase 3 — async lorien ingest queue + background worker"`

When completely finished:
openclaw system event --text "Done: mnemo Phase 3 완료 — async ingest queue + lorien worker" --mode now
