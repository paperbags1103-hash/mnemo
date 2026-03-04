"""
Dynamic category management.
Categories = unique `cat:` prefix tags collected from all notes.
No separate table needed — source of truth is tags.

GET  /api/v1/categories         → list all categories
POST /api/v1/categories         → add a new category (creates a stub entry for discovery)
DELETE /api/v1/categories/{name} → remove category (removes cat:name tag from all notes)
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.core.db import db

router = APIRouter(tags=["categories"])

DEFAULT_CATEGORIES = ["투자", "기술", "문화", "여행", "일기", "기타"]


@router.get("/categories")
async def list_categories():
    """Return all categories derived from cat: tags across all notes."""
    cats = await db.get_all_categories()
    # Merge with defaults; deduplicate; sort (defaults first, then custom)
    merged = list(dict.fromkeys(DEFAULT_CATEGORIES + cats))
    return {"categories": merged}


class CategoryCreate(BaseModel):
    name: str


@router.post("/categories", status_code=201)
async def add_category(body: CategoryCreate):
    name = body.name.strip()
    if not name or len(name) > 30:
        raise HTTPException(status_code=422, detail="Category name must be 1–30 chars")
    await db.add_custom_category(name)
    return {"ok": True, "category": name}


@router.delete("/categories/{name}")
async def remove_category(name: str):
    """Remove from custom table + retag all notes to 기타."""
    await db.remove_custom_category(name)
    await db.replace_category_tag(name, "기타")
    return {"ok": True, "removed": name}
