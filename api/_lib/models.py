from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

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
