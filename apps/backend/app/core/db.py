from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

import aiosqlite
from libsql_client import create_client

from app.core.config import settings
from app.models.note import Note, NoteCreate, NoteRead, NoteUpdate


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DatabaseManager:
    def __init__(self) -> None:
        self.sqlite_path = settings.resolved_sqlite_path

    async def initialize(self) -> None:
        self.sqlite_path.parent.mkdir(parents=True, exist_ok=True)
        async with aiosqlite.connect(self.sqlite_path) as connection:
            await connection.execute(
                """
                CREATE TABLE IF NOT EXISTS note (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL DEFAULT '',
                    folder_id TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 1
                )
                """
            )
            await connection.commit()

    async def list_notes(self) -> list[NoteRead]:
        async with aiosqlite.connect(self.sqlite_path) as connection:
            connection.row_factory = aiosqlite.Row
            cursor = await connection.execute(
                """
                SELECT id, title, content, folder_id, created_at, updated_at, version
                FROM note
                ORDER BY datetime(updated_at) DESC
                """
            )
            rows = await cursor.fetchall()
            return [self._row_to_note(row) for row in rows]

    async def get_note(self, note_id: UUID | str) -> NoteRead | None:
        async with aiosqlite.connect(self.sqlite_path) as connection:
            connection.row_factory = aiosqlite.Row
            cursor = await connection.execute(
                """
                SELECT id, title, content, folder_id, created_at, updated_at, version
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
            created_at=created_at,
            updated_at=created_at,
            version=1,
        )
        async with aiosqlite.connect(self.sqlite_path) as connection:
            await connection.execute(
                """
                INSERT INTO note (id, title, content, folder_id, created_at, updated_at, version)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(note.id),
                    note.title,
                    note.content,
                    note.folder_id,
                    note.created_at.isoformat(),
                    note.updated_at.isoformat(),
                    note.version,
                ),
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
                SET title = ?, content = ?, folder_id = ?, updated_at = ?, version = ?
                WHERE id = ?
                """,
                (
                    current.title,
                    current.content,
                    current.folder_id,
                    current.updated_at.isoformat(),
                    current.version,
                    str(current.id),
                ),
            )
            await connection.commit()
        return current

    async def delete_note(self, note_id: UUID | str) -> bool:
        async with aiosqlite.connect(self.sqlite_path) as connection:
            cursor = await connection.execute("DELETE FROM note WHERE id = ?", (str(note_id),))
            await connection.commit()
            return cursor.rowcount > 0

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

    @staticmethod
    def _row_to_note(row: aiosqlite.Row) -> NoteRead:
        return NoteRead(
            id=UUID(row["id"]),
            title=row["title"],
            content=row["content"],
            folder_id=row["folder_id"],
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
            version=row["version"],
        )

    @staticmethod
    def _note_to_read(note: Note) -> NoteRead:
        return NoteRead.model_validate(note.model_dump())


db = DatabaseManager()
