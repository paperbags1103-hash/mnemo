from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import aiosqlite
from libsql_client import create_client

from app.core.config import settings
from app.models.ingest_job import IngestJob
from app.models.note import Note, NoteCreate, NoteRead, NoteUpdate


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DatabaseManager:
    def __init__(self) -> None:
        self.sqlite_path = settings.resolved_sqlite_path

    async def initialize(self) -> None:
        self.sqlite_path.parent.mkdir(parents=True, exist_ok=True)
        async with aiosqlite.connect(self.sqlite_path) as connection:
            await connection.execute("PRAGMA journal_mode=WAL")
            await connection.execute("PRAGMA synchronous=NORMAL")
            await connection.execute(
                """
                CREATE TABLE IF NOT EXISTS note (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL DEFAULT '',
                    folder_id TEXT,
                    tags TEXT NOT NULL DEFAULT '[]',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 1
                )
                """
            )
            try:
                await connection.execute("ALTER TABLE note ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'")
                await connection.commit()
            except Exception:
                pass
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
            await connection.execute(
                """
                INSERT INTO note_fts (id, title, content)
                SELECT n.id, n.title, n.content
                FROM note n
                WHERE NOT EXISTS (
                    SELECT 1 FROM note_fts WHERE id = n.id
                )
                """
            )
            await connection.execute(
                """
                CREATE TABLE IF NOT EXISTS note_link (
                    source_id TEXT NOT NULL,
                    target_id TEXT NOT NULL,
                    link_type TEXT NOT NULL DEFAULT 'manual',
                    confidence REAL NOT NULL DEFAULT 1.0,
                    rationale TEXT,
                    status TEXT NOT NULL DEFAULT 'confirmed',
                    created_at TEXT NOT NULL,
                    PRIMARY KEY (source_id, target_id)
                )
                """
            )
            # migrate existing note_link if columns missing
            for col, defn in [
                ("confidence", "REAL NOT NULL DEFAULT 1.0"),
                ("rationale", "TEXT"),
                ("status", "TEXT NOT NULL DEFAULT 'confirmed'"),
            ]:
                try:
                    await connection.execute(f"ALTER TABLE note_link ADD COLUMN {col} {defn}")
                    await connection.commit()
                except Exception:
                    pass
            await connection.execute(
                """
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
                """
            )
            await connection.commit()

    async def list_notes(self) -> list[NoteRead]:
        async with aiosqlite.connect(self.sqlite_path) as connection:
            connection.row_factory = aiosqlite.Row
            cursor = await connection.execute(
                """
                SELECT id, title, content, folder_id, tags, created_at, updated_at, version
                FROM note
                ORDER BY datetime(updated_at) DESC
                """
            )
            rows = await cursor.fetchall()
            return [self._row_to_note(row) for row in rows]

    async def search_notes(self, query: str, limit: int = 10) -> list[NoteRead]:
        async with aiosqlite.connect(self.sqlite_path) as connection:
            connection.row_factory = aiosqlite.Row
            try:
                cursor = await connection.execute(
                    """
                    SELECT n.id, n.title, n.content, n.folder_id, n.tags, n.created_at, n.updated_at, n.version
                    FROM note n
                    JOIN note_fts fts ON n.id = fts.id
                    WHERE note_fts MATCH ?
                    ORDER BY rank
                    LIMIT ?
                    """,
                    (query, limit),
                )
            except Exception:
                pattern = f"%{query}%"
                cursor = await connection.execute(
                    """
                    SELECT id, title, content, folder_id, tags, created_at, updated_at, version
                    FROM note
                    WHERE title LIKE ? OR content LIKE ?
                    ORDER BY datetime(updated_at) DESC
                    LIMIT ?
                    """,
                    (pattern, pattern, limit),
                )
            rows = await cursor.fetchall()
            return [self._row_to_note(row) for row in rows]

    async def get_note(self, note_id: UUID | str) -> NoteRead | None:
        async with aiosqlite.connect(self.sqlite_path) as connection:
            connection.row_factory = aiosqlite.Row
            cursor = await connection.execute(
                """
                SELECT id, title, content, folder_id, tags, created_at, updated_at, version
                FROM note
                WHERE id = ?
                """,
                (str(note_id),),
            )
            row = await cursor.fetchone()
            return self._row_to_note(row) if row else None

    async def create_note(self, payload: NoteCreate) -> NoteRead:
        created_at = utcnow()
        note = Note(
            id=uuid4(),
            title=payload.title,
            content=payload.content,
            folder_id=payload.folder_id,
            tags=payload.tags,
            source_ref=payload.source_ref,
            created_at=created_at,
            updated_at=created_at,
            version=1,
        )
        async with aiosqlite.connect(self.sqlite_path) as connection:
            await connection.execute(
                """
                INSERT INTO note (id, title, content, folder_id, tags, created_at, updated_at, version, source_ref)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(note.id),
                    note.title,
                    note.content,
                    note.folder_id,
                    json.dumps(note.tags),
                    note.created_at.isoformat(),
                    note.updated_at.isoformat(),
                    note.version,
                    note.source_ref,
                ),
            )
            await connection.execute(
                "INSERT INTO note_fts (id, title, content) VALUES (?, ?, ?)",
                (str(note.id), note.title, note.content),
            )
            await connection.commit()
        return self._note_to_read(note)

    async def update_note(self, note_id: UUID | str, payload: NoteUpdate) -> NoteRead | None:
        current = await self.get_note(note_id)
        if current is None:
            return None

        updates = payload.model_dump(exclude_unset=True)
        expected_version = updates.pop("version", None)
        if expected_version is not None and expected_version != current.version:
            raise ValueError("version_conflict")
        if not updates:
            return current

        for key, value in updates.items():
            setattr(current, key, value)

        current.updated_at = utcnow()
        current.version += 1

        async with aiosqlite.connect(self.sqlite_path) as connection:
            await connection.execute(
                """
                UPDATE note
                SET title = ?, content = ?, folder_id = ?, tags = ?, updated_at = ?, version = ?
                WHERE id = ?
                """,
                (
                    current.title,
                    current.content,
                    current.folder_id,
                    json.dumps(current.tags),
                    current.updated_at.isoformat(),
                    current.version,
                    str(current.id),
                ),
            )
            await connection.execute("DELETE FROM note_fts WHERE id = ?", (str(current.id),))
            await connection.execute(
                "INSERT INTO note_fts (id, title, content) VALUES (?, ?, ?)",
                (str(current.id), current.title, current.content),
            )
            await connection.commit()
        return current

    async def delete_note(self, note_id: UUID | str) -> bool:
        async with aiosqlite.connect(self.sqlite_path) as connection:
            cursor = await connection.execute("DELETE FROM note WHERE id = ?", (str(note_id),))
            await connection.execute("DELETE FROM note_fts WHERE id = ?", (str(note_id),))
            await connection.commit()
            return cursor.rowcount > 0

    async def upsert_note(self, payload: NoteCreate) -> tuple[NoteRead, bool]:
        """Find note by title and update content, or create new."""
        async with aiosqlite.connect(self.sqlite_path) as connection:
            connection.row_factory = aiosqlite.Row
            cursor = await connection.execute(
                "SELECT id FROM note WHERE title = ? ORDER BY datetime(created_at) DESC LIMIT 1",
                (payload.title,),
            )
            row = await cursor.fetchone()
        if row:
            note = await self.update_note(
                row["id"],
                NoteUpdate(content=payload.content, folder_id=payload.folder_id, tags=payload.tags),
            )
            if note is None:
                raise RuntimeError("upsert_target_missing")
            return note, False
        note = await self.create_note(payload)
        return note, True

    async def create_link(self, source_id: str, target_id: str, link_type: str = "manual",
                          confidence: float = 1.0, rationale: str | None = None,
                          status: str = "confirmed") -> None:
        async with aiosqlite.connect(self.sqlite_path) as connection:
            await connection.execute(
                """
                INSERT OR REPLACE INTO note_link (source_id, target_id, link_type, confidence, rationale, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (source_id, target_id, link_type, confidence, rationale, status, utcnow().isoformat()),
            )
            await connection.commit()

    async def get_backlinks(self, note_id: str) -> list[dict]:
        """Notes that link TO note_id."""
        async with aiosqlite.connect(self.sqlite_path) as connection:
            connection.row_factory = aiosqlite.Row
            cursor = await connection.execute(
                """
                SELECT nl.source_id, nl.link_type, nl.confidence, nl.rationale, nl.status,
                       n.title, n.tags
                FROM note_link nl
                JOIN note n ON n.id = nl.source_id
                WHERE nl.target_id = ? AND nl.status != 'rejected'
                ORDER BY nl.created_at DESC
                """,
                (note_id,),
            )
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

    async def get_pending_links(self) -> list[dict]:
        async with aiosqlite.connect(self.sqlite_path) as connection:
            connection.row_factory = aiosqlite.Row
            cursor = await connection.execute(
                """
                SELECT nl.source_id, nl.target_id, nl.confidence, nl.rationale, nl.status,
                       ns.title as source_title, nt.title as target_title
                FROM note_link nl
                JOIN note ns ON ns.id = nl.source_id
                JOIN note nt ON nt.id = nl.target_id
                WHERE nl.status = 'pending'
                ORDER BY nl.created_at DESC
                """,
            )
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

    async def update_link_status(self, source_id: str, target_id: str, status: str) -> bool:
        async with aiosqlite.connect(self.sqlite_path) as connection:
            cursor = await connection.execute(
                "UPDATE note_link SET status = ? WHERE source_id = ? AND target_id = ?",
                (status, source_id, target_id),
            )
            await connection.commit()
            return cursor.rowcount > 0

    async def get_digest(self, hours: int = 24, limit: int = 30) -> dict:
        async with aiosqlite.connect(self.sqlite_path) as connection:
            connection.row_factory = aiosqlite.Row
            cursor = await connection.execute(
                """
                SELECT n.id, n.title, n.tags, n.created_at, n.source_ref,
                       (SELECT COUNT(*) FROM note_link nl
                        WHERE nl.source_id = n.id OR nl.target_id = n.id) as connection_count
                FROM note n
                WHERE datetime(n.created_at) > datetime('now', ?)
                ORDER BY datetime(n.created_at) DESC
                LIMIT ?
                """,
                (f"-{hours} hours", limit),
            )
            rows = await cursor.fetchall()
            import json as _json
            notes = []
            by_category: dict[str, int] = {}
            for row in rows:
                tags = _json.loads(row["tags"] or "[]")
                cat = next((t.replace("cat:", "") for t in tags if t.startswith("cat:")), "기타")
                by_category[cat] = by_category.get(cat, 0) + 1
                notes.append({
                    "id": row["id"],
                    "title": row["title"],
                    "category": cat,
                    "tags": [t for t in tags if not t.startswith("cat:")],
                    "created_at": row["created_at"],
                    "source": row["source_ref"] or "manual",
                    "connection_count": row["connection_count"],
                })
            return {
                "notes": notes,
                "by_category": by_category,
                "total": len(notes),
            }

    async def ready_status(self) -> dict[str, str]:
        turso = "error"
        if settings.turso_url:
            try:
                client = create_client(settings.turso_url, auth_token=settings.turso_auth_token)
                await client.execute("SELECT 1")
                await client.close()
                turso = "connected"
            except Exception:
                turso = "error"
        return {
            "turso": turso,
            "lorien": "available" if settings.resolved_lorien_db_path.exists() else "unavailable",
        }

    async def enqueue_ingest(self, note_id: str) -> IngestJob:
        created_at = utcnow()
        job = IngestJob(
            note_id=note_id,
            status="pending",
            retry_count=0,
            max_retries=3,
            next_retry_at=None,
            error=None,
            created_at=created_at,
            updated_at=created_at,
        )
        async with aiosqlite.connect(self.sqlite_path) as connection:
            await connection.execute(
                """
                INSERT INTO ingest_job (
                    id, note_id, status, retry_count, max_retries,
                    next_retry_at, error, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(job.id),
                    job.note_id,
                    job.status,
                    job.retry_count,
                    job.max_retries,
                    None,
                    None,
                    job.created_at.isoformat(),
                    job.updated_at.isoformat(),
                ),
            )
            await connection.commit()
        return job

    async def get_pending_jobs(self, limit: int = 10) -> list[IngestJob]:
        async with aiosqlite.connect(self.sqlite_path) as connection:
            connection.row_factory = aiosqlite.Row
            cursor = await connection.execute(
                """
                SELECT id, note_id, status, retry_count, max_retries,
                       next_retry_at, error, created_at, updated_at
                FROM ingest_job
                WHERE status = 'pending'
                  AND (next_retry_at IS NULL OR datetime(next_retry_at) <= datetime('now'))
                ORDER BY datetime(created_at) ASC
                LIMIT ?
                """,
                (limit,),
            )
            rows = await cursor.fetchall()
            return [self._row_to_ingest_job(row) for row in rows]

    async def get_job(self, job_id: UUID | str) -> IngestJob | None:
        async with aiosqlite.connect(self.sqlite_path) as connection:
            connection.row_factory = aiosqlite.Row
            cursor = await connection.execute(
                """
                SELECT id, note_id, status, retry_count, max_retries,
                       next_retry_at, error, created_at, updated_at
                FROM ingest_job
                WHERE id = ?
                """,
                (str(job_id),),
            )
            row = await cursor.fetchone()
            return self._row_to_ingest_job(row) if row else None

    async def mark_job_processing(self, job_id: UUID | str) -> None:
        async with aiosqlite.connect(self.sqlite_path) as connection:
            await connection.execute(
                """
                UPDATE ingest_job
                SET status = 'processing', next_retry_at = NULL, error = NULL, updated_at = ?
                WHERE id = ?
                """,
                (utcnow().isoformat(), str(job_id)),
            )
            await connection.commit()

    async def mark_job_done(self, job_id: UUID | str) -> None:
        async with aiosqlite.connect(self.sqlite_path) as connection:
            await connection.execute(
                """
                UPDATE ingest_job
                SET status = 'done', next_retry_at = NULL, error = NULL, updated_at = ?
                WHERE id = ?
                """,
                (utcnow().isoformat(), str(job_id)),
            )
            await connection.commit()

    async def mark_job_failed(self, job_id: UUID | str, error: str) -> None:
        job = await self.get_job(job_id)
        if job is None:
            return

        retry_count = job.retry_count + 1
        updated_at = utcnow()
        terminal = retry_count >= job.max_retries
        next_retry_at: datetime | None = None
        if not terminal:
            backoff_seconds = 30 * (2 ** retry_count)
            next_retry_at = updated_at + timedelta(seconds=backoff_seconds)

        async with aiosqlite.connect(self.sqlite_path) as connection:
            await connection.execute(
                """
                UPDATE ingest_job
                SET status = ?,
                    retry_count = ?,
                    next_retry_at = ?,
                    error = ?,
                    updated_at = ?
                WHERE id = ?
                """,
                (
                    "failed" if terminal else "pending",
                    retry_count,
                    next_retry_at.isoformat() if next_retry_at is not None else None,
                    error,
                    updated_at.isoformat(),
                    str(job_id),
                ),
            )
            await connection.commit()

    async def retry_job(self, job_id: UUID | str) -> IngestJob | None:
        job = await self.get_job(job_id)
        if job is None:
            return None

        updated_at = utcnow()
        async with aiosqlite.connect(self.sqlite_path) as connection:
            await connection.execute(
                """
                UPDATE ingest_job
                SET status = 'pending', retry_count = 0, next_retry_at = NULL, error = NULL, updated_at = ?
                WHERE id = ?
                """,
                (updated_at.isoformat(), str(job_id)),
            )
            await connection.commit()
        return await self.get_job(job_id)

    async def list_jobs(
        self,
        note_id: str | None = None,
        status: str | None = None,
        limit: int = 20,
    ) -> list[IngestJob]:
        async with aiosqlite.connect(self.sqlite_path) as connection:
            connection.row_factory = aiosqlite.Row
            conditions: list[str] = []
            parameters: list[str | int] = []

            if note_id:
                conditions.append("note_id = ?")
                parameters.append(note_id)
            if status:
                conditions.append("status = ?")
                parameters.append(status)

            where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
            parameters.append(limit)
            cursor = await connection.execute(
                f"""
                SELECT id, note_id, status, retry_count, max_retries,
                       next_retry_at, error, created_at, updated_at
                FROM ingest_job
                {where_clause}
                ORDER BY datetime(created_at) DESC
                LIMIT ?
                """,
                parameters,
            )
            rows = await cursor.fetchall()
            return [self._row_to_ingest_job(row) for row in rows]

    @staticmethod
    def _row_to_note(row: aiosqlite.Row) -> NoteRead:
        return NoteRead(
            id=UUID(row["id"]),
            title=row["title"],
            content=row["content"],
            folder_id=row["folder_id"],
            tags=json.loads(row["tags"] or "[]"),
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
            version=row["version"],
            source_ref=row["source_ref"] if "source_ref" in row.keys() else None,
        )

    @staticmethod
    def _note_to_read(note: Note) -> NoteRead:
        return NoteRead.model_validate(note.model_dump())

    @staticmethod
    def _row_to_ingest_job(row: aiosqlite.Row) -> IngestJob:
        return IngestJob(
            id=UUID(row["id"]),
            note_id=row["note_id"],
            status=row["status"],
            retry_count=row["retry_count"],
            max_retries=row["max_retries"],
            next_retry_at=datetime.fromisoformat(row["next_retry_at"]) if row["next_retry_at"] else None,
            error=row["error"],
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
        )


db = DatabaseManager()
