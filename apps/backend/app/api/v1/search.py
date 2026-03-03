from fastapi import APIRouter

router = APIRouter(prefix="/search", tags=["search"])


@router.get("")
async def search_notes(query: str = "") -> dict[str, str | list[object]]:
    return {"query": query, "results": []}
