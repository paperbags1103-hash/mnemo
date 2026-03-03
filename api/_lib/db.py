from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4

from .config import SQLITE_PATH, TURSO_AUTH_TOKEN, TURSO_URL, is_turso
from .models import NoteCreate, NoteRead, NoteUpdate


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _get_conn():
    if is_turso():
        import libsql_experimental as libsql

        return libsql.connect(TURSO_URL, auth_token=TURSO_AUTH_TOKEN)

    db_path = Path(SQLITE_PATH)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    return conn


def initialize():
    conn = _get_conn()
    conn.execute(
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
    conn.commit()
    return conn


def close_conn(conn) -> None:
    close = getattr(conn, "close", None)
    if callable(close):
        close()


def _row_to_note(row) -> NoteRead:
    if isinstance(row, sqlite3.Row):
        data = dict(row)
    else:
        data = {
            "id": row[0],
            "title": row[1],
            "content": row[2],
            "folder_id": row[3],
            "created_at": row[4],
            "updated_at": row[5],
            "version": row[6],
        }

    return NoteRead(
        id=UUID(data["id"]),
        title=data["title"],
        content=data["content"],
        folder_id=data["folder_id"],
        created_at=datetime.fromisoformat(data["created_at"]),
        updated_at=datetime.fromisoformat(data["updated_at"]),
        version=int(data["version"]),
    )


def list_notes(conn) -> list[NoteRead]:
    cur = conn.execute(
        """
        SELECT id, title, content, folder_id, created_at, updated_at, version
        FROM note
        ORDER BY datetime(updated_at) DESC
        """
    )
    return [_row_to_note(row) for row in cur.fetchall()]


def get_note(conn, note_id: str) -> NoteRead | None:
    cur = conn.execute(
        """
        SELECT id, title, content, folder_id, created_at, updated_at, version
        FROM note
        WHERE id = ?
        """,
        (note_id,),
    )
    row = cur.fetchone()
    return _row_to_note(row) if row else None


def create_note(conn, payload: NoteCreate) -> NoteRead:
    now = utcnow().isoformat()
    note_id = str(uuid4())
    conn.execute(
        """
        INSERT INTO note (id, title, content, folder_id, created_at, updated_at, version)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
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
        """
        UPDATE note
        SET title = ?, content = ?, folder_id = ?, updated_at = ?, version = ?
        WHERE id = ?
        """,
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
        """
        SELECT id, title, content, folder_id, created_at, updated_at, version
        FROM note
        WHERE title LIKE ? OR content LIKE ?
        ORDER BY datetime(updated_at) DESC
        LIMIT ?
        """,
        (pattern, pattern, limit),
    )
    return [_row_to_note(row) for row in cur.fetchall()]
