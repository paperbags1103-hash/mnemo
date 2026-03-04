from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel

CATEGORY_TAG_PREFIX = "cat:"
DEFAULT_CATEGORY = "기타"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def extract_category(tags: list[str] | None) -> str:
    for tag in tags or []:
        if tag.startswith(CATEGORY_TAG_PREFIX):
            category = tag[len(CATEGORY_TAG_PREFIX) :].strip()
            if category:
                return category
    return DEFAULT_CATEGORY


def apply_category_tag(tags: list[str] | None, category: str | None) -> list[str]:
    # If tags already contain a cat: tag (possibly with subcategory like "기술/AI"),
    # honour it — tags is the source of truth for category+subcategory.
    # The category param is only used when there is no cat: tag in tags.
    existing_cat = next((t[len(CATEGORY_TAG_PREFIX):] for t in (tags or []) if t.startswith(CATEGORY_TAG_PREFIX)), None)
    normalized_tags = [tag for tag in tags or [] if not tag.startswith(CATEGORY_TAG_PREFIX)]
    if existing_cat:
        # Tags already carry the full category (+ optional subcategory); keep as-is
        final_category = existing_cat
    elif category and category.strip():
        final_category = category.strip()
    else:
        final_category = DEFAULT_CATEGORY
    return [f"{CATEGORY_TAG_PREFIX}{final_category}", *normalized_tags]


class NoteBase(SQLModel):
    title: str = Field(default="Untitled", max_length=255)
    content: str = Field(default="", max_length=1_000_000)
    folder_id: str | None = Field(default=None, max_length=255)
    tags: list[str] = Field(default_factory=list)
    source_ref: str | None = Field(default=None, max_length=1024, description="Origin of the content (URL, book title, etc.)")


class Note(NoteBase):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
    version: int = Field(default=1)


class NoteRead(NoteBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    version: int


class NoteCreate(NoteBase):
    category: str | None = Field(default=None, max_length=255)


class NoteUpdate(SQLModel):
    title: Optional[str] = Field(default=None, max_length=255)
    content: Optional[str] = Field(default=None, max_length=1_000_000)
    folder_id: Optional[str] = Field(default=None, max_length=255)
    tags: Optional[list[str]] = None
    category: Optional[str] = Field(default=None, max_length=255)
    version: Optional[int] = None
