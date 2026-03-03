from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class IngestJob(SQLModel):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    note_id: str = Field(max_length=255)
    status: str = Field(default="pending", max_length=32)
    retry_count: int = Field(default=0, ge=0)
    max_retries: int = Field(default=3, ge=1)
    next_retry_at: datetime | None = None
    error: str | None = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
