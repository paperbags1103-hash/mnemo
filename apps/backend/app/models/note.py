from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class NoteBase(SQLModel):
    title: str = Field(default="Untitled", max_length=255)
    content: str = Field(default="")
    folder_id: str | None = Field(default=None, max_length=255)


class Note(NoteBase, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
    version: int = Field(default=1)


class NoteCreate(NoteBase):
    pass


class NoteUpdate(SQLModel):
    title: Optional[str] = Field(default=None, max_length=255)
    content: Optional[str] = None
    folder_id: Optional[str] = Field(default=None, max_length=255)
