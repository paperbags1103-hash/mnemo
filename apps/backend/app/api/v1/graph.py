from __future__ import annotations

from itertools import combinations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.auth import verify_api_key
from app.core.db import db
from app.models.note import CATEGORY_TAG_PREFIX, extract_category

router = APIRouter(prefix="/graph", tags=["graph"], dependencies=[Depends(verify_api_key)])


class GraphNode(BaseModel):
    id: str
    title: str
    category: str
    tag_count: int


class GraphEdge(BaseModel):
    source: str
    target: str
    shared_tag: str


class NotesGraphResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


@router.get("/notes", response_model=NotesGraphResponse)
async def get_notes_graph() -> NotesGraphResponse:
    notes = await db.list_notes()
    tag_map: dict[str, list[str]] = {}
    nodes: list[GraphNode] = []

    for note in notes:
        non_category_tags = sorted({tag for tag in note.tags if not tag.startswith(CATEGORY_TAG_PREFIX)})
        nodes.append(
            GraphNode(
                id=str(note.id),
                title=note.title,
                category=extract_category(note.tags),
                tag_count=len(non_category_tags),
            )
        )
        for tag in non_category_tags:
            tag_map.setdefault(tag, []).append(str(note.id))

    edges: list[GraphEdge] = []
    for tag, note_ids in sorted(tag_map.items()):
        for source, target in combinations(sorted(set(note_ids)), 2):
            edges.append(GraphEdge(source=source, target=target, shared_tag=tag))

    return NotesGraphResponse(nodes=nodes, edges=edges)
