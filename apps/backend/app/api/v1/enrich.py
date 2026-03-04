"""
Note enrichment via LLM.
POST /api/v1/notes/{note_id}/enrich
→ Extracts title, summary, category, tags from note content
→ Updates the note in-place

Providers (priority order):
1. Ollama  — local, free, no API key (default)
2. Groq    — GROQ_API_KEY env var
3. OpenAI  — OPENAI_API_KEY env var
"""

import json
import re
import urllib.request
import urllib.error
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
  "summary": "핵심 내용 요약 (2문장, 60자 이내)",
  "category": "투자 | 기술 | 문화 | 여행 | 일기 | 기타 중 하나",
  "tags": ["태그1", "태그2", "태그3"]
}}

규칙:
- title: 핵심을 담은 간결한 제목
- summary: 독자가 노트를 열기 전 핵심을 파악할 수 있도록
- category: 위 6개 중 하나만
- tags: 핵심 키워드 3~5개"""


def strip_html(html: str) -> str:
    return re.sub(r"<[^>]+>", " ", html).strip()


def extract_json(text: str) -> dict:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise ValueError("No JSON found in LLM response")
    return json.loads(match.group())


def call_ollama(prompt: str, model: str = "qwen2.5:7b") -> str:
    """Call local Ollama server."""
    payload = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "options": {"temperature": 0.3},
    }).encode()
    req = urllib.request.Request(
        "http://localhost:11434/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read())
        return data["message"]["content"]


def call_groq(prompt: str) -> str:
    from groq import Groq  # type: ignore
    client = Groq(api_key=settings.groq_api_key)
    resp = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=512,
    )
    return resp.choices[0].message.content or ""


def call_openai(prompt: str) -> str:
    from openai import OpenAI  # type: ignore
    client = OpenAI(api_key=settings.openai_api_key)  # type: ignore[attr-defined]
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=512,
    )
    return resp.choices[0].message.content or ""


def llm_call(prompt: str) -> str:
    """Try providers in order: Ollama → Groq → OpenAI."""
    # 1. Ollama (default, local, no key required)
    try:
        return call_ollama(prompt)
    except Exception:
        pass

    # 2. Groq (if configured)
    if getattr(settings, "groq_api_key", ""):
        try:
            return call_groq(prompt)
        except Exception:
            pass

    raise RuntimeError("No LLM provider available. Start Ollama: `ollama serve`")


@router.post("/notes/{note_id}/enrich", dependencies=[Depends(verify_api_key)])
async def enrich_note(note_id: str):
    note = await db.get_note(note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    raw_text = strip_html(note.content)
    if len(raw_text) < 30:
        raise HTTPException(status_code=422, detail="Content too short (min 30 chars)")

    prompt = EXTRACT_PROMPT.format(content=raw_text[:3000])

    try:
        raw_response = llm_call(prompt)
        extracted = extract_json(raw_response)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM error: {e}") from e

    title = str(extracted.get("title", note.title))[:100]
    summary = str(extracted.get("summary", ""))
    category = extracted.get("category", "기타")
    if category not in NOTE_CATEGORIES:
        category = "기타"
    tags: list[str] = [str(t) for t in extracted.get("tags", [])][:8]

    # Prepend blockquote summary to content
    if summary:
        enriched_content = f"<blockquote><p>{summary}</p></blockquote><hr>{note.content}"
    else:
        enriched_content = note.content

    existing_non_cat = [t for t in note.tags if not t.startswith("cat:")]
    all_tags = [f"cat:{category}"] + list(dict.fromkeys(tags + existing_non_cat))[:12]

    updated = await db.update_note(note_id, NoteUpdate(title=title, content=enriched_content, tags=all_tags))
    if not updated:
        raise HTTPException(status_code=500, detail="Update failed")

    return {"ok": True, "title": title, "summary": summary, "category": category, "tags": tags}
