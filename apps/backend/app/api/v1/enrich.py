"""
Note enrichment via Groq LLM.
POST /api/v1/notes/{note_id}/enrich
→ Extracts title, summary, category, tags from note content
→ Updates the note in-place
"""

import json
import re
from fastapi import APIRouter, Depends, HTTPException
from app.core.auth import verify_api_key
from app.core.config import settings
from app.core.db import db
from app.models.note import NoteUpdate

router = APIRouter(tags=["enrich"])

NOTE_CATEGORIES = ["투자", "기술", "문화", "여행", "일기", "기타"]

EXTRACT_PROMPT = """당신은 개인 지식 관리 도우미입니다. 아래 노트 내용을 분석하여 JSON을 반환하세요.

노트 내용:
{content}

반환 형식 (JSON만, 다른 텍스트 없이):
{{
  "title": "간결한 제목 (30자 이내)",
  "summary": "핵심 내용 요약 (2문장, 50자 이내)",
  "category": "투자 | 기술 | 문화 | 여행 | 일기 | 기타 중 하나",
  "tags": ["태그1", "태그2", "태그3"]
}}

규칙:
- title: 내용의 핵심을 담은 간결한 제목
- summary: 독자가 노트를 열기 전 핵심을 파악할 수 있도록
- category: 위 6개 중 가장 적합한 것 하나만
- tags: 핵심 키워드 3~5개, 소문자, 공백 없이"""


def strip_html(html: str) -> str:
    return re.sub(r"<[^>]+>", " ", html).strip()


@router.post("/notes/{note_id}/enrich", dependencies=[Depends(verify_api_key)])
async def enrich_note(note_id: str):
    if not settings.groq_api_key:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY not configured")

    note = await db.get_note(note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    raw_text = strip_html(note.content)
    if len(raw_text) < 30:
        raise HTTPException(status_code=422, detail="Content too short to enrich (min 30 chars)")

    # Truncate to first 3000 chars for cost efficiency
    text_for_llm = raw_text[:3000]

    try:
        from groq import Groq  # type: ignore
        client = Groq(api_key=settings.groq_api_key)
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": EXTRACT_PROMPT.format(content=text_for_llm)}],
            temperature=0.3,
            max_tokens=512,
        )
        raw = response.choices[0].message.content or ""
        # Extract JSON block
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not match:
            raise ValueError("No JSON in response")
        extracted = json.loads(match.group())
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM error: {e}") from e

    title = str(extracted.get("title", note.title))[:100]
    summary = str(extracted.get("summary", ""))
    category = extracted.get("category", "기타")
    if category not in NOTE_CATEGORIES:
        category = "기타"
    tags: list[str] = [str(t) for t in extracted.get("tags", [])][:8]

    # Build enriched content: blockquote summary + original body
    if summary:
        enriched_content = f"<blockquote><p>{summary}</p></blockquote><hr>{note.content}"
    else:
        enriched_content = note.content

    # Merge tags: cat: + extracted tags
    existing_non_cat = [t for t in note.tags if not t.startswith("cat:")]
    all_tags = [f"cat:{category}"] + list(dict.fromkeys(tags + existing_non_cat))[:12]

    updated = await db.update_note(
        note_id,
        NoteUpdate(title=title, content=enriched_content, tags=all_tags),
    )
    if not updated:
        raise HTTPException(status_code=500, detail="Update failed")

    return {
        "ok": True,
        "title": title,
        "summary": summary,
        "category": category,
        "tags": tags,
    }
