from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class IngestJob(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    note_id: UUID
    status: str = Field(default="pending", max_length=32)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
