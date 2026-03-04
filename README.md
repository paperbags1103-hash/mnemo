# mnemo

**AI Agent's Obsidian** — AI 에이전트를 위한 지식 관리 시스템.

에이전트(치레/Chire)가 지식을 자동 수집·요약·분류하고, 인간은 잘 정리된 지식베이스를 읽기만 합니다.

**Live:** https://mnemo-red.vercel.app · **Local:** http://localhost:5173

---

## 핵심 개념

| 개념 | 설명 |
|------|------|
| **에이전트 = 사서** | AI가 저장 전 요약+분류+태그 추출 처리 |
| **mnemo = 순수 데이터 레이어** | 백엔드에 LLM 없음, 저장/검색/그래프만 |
| **노트-to-노트 그래프** | 공유 태그 기반 자동 연결 (폴더 없음) |
| **카테고리** | `투자 · 기술 · 문화 · 여행 · 일기 · 기타` |

---

## 빠른 시작

### 1. 백엔드
```bash
cd apps/backend
python -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --port 8000 --reload
```

### 2. 프론트엔드
```bash
cd apps/frontend
npm install --legacy-peer-deps
npm run dev
```

- 프론트엔드: http://localhost:5173
- 백엔드 API: http://localhost:8000
- API 문서: http://localhost:8000/docs

---

## 사용 방법

### A. 앱에서 직접 작성
1. http://localhost:5173 접속
2. 좌측 사이드바 하단 **새 노트** 클릭 (또는 `Cmd+N`)
3. 제목 입력 → 본문 작성
4. **저장** 버튼 또는 `Cmd+S`
5. **✨ AI** 버튼 클릭 → 치레가 다음 heartbeat(~5분)에 요약+분류+태그 자동 처리

### B. AI 에이전트(치레)가 저장
Discord/Signal에서 "mnemo에 저장" 발화 시:
```
[URL 또는 글] mnemo에 저장
```
치레가 자동으로:
1. 내용 수집 (URL이면 웹 fetch)
2. Claude로 제목/요약/카테고리/태그 추출
3. mnemo API로 저장

### C. API 직접 호출
```bash
# 저장
curl -X POST http://localhost:8000/api/v1/webhooks/save \
  -H "Content-Type: application/json" \
  -d '{
    "title": "비트코인 투자 전략",
    "content": "<p>내용...</p>",
    "source": "https://example.com",
    "tags": ["cat:투자", "비트코인"]
  }'

# 검색
curl "http://localhost:8000/api/v1/search?q=비트코인&limit=10"

# 목록
curl "http://localhost:8000/api/v1/notes?limit=30"
```

### D. MCP (Claude Desktop)
`apps/mcp/` — FastMCP 기반 MCP 서버. Claude Desktop에서 직접 mnemo에 저장/검색 가능.

```bash
cd apps/mcp && pip install -e . && mnemo-mcp
```

---

## 저장 포맷 (에이전트 저장 시)

```markdown
# 제목

> 핵심 요약 2문장

본문 내용 (원문 또는 정리)

---
출처: https://... · 2026-03-04
```

태그: `["cat:기술", "비트코인", "블록체인"]`  
→ `cat:` prefix = 카테고리 (하나만), 나머지 = 일반 태그

---

## AI Enrichment (✨ AI 버튼)

앱에서 작성한 노트의 AI 처리 흐름:

```
사용자: ✨ AI 클릭
   ↓
mnemo: enrichment_status = "pending"
   ↓ (치레 heartbeat ~5분)
치레: GET /api/v1/notes/enrichment/pending
치레: Claude로 분석 → title/summary/category/tags
치레: POST /api/v1/notes/{id}/enrichment
   ↓
노트 자동 업데이트
```

**핵심 원칙:** mnemo 백엔드에 LLM 없음. 치레가 모든 AI 처리 담당.

---

## 주요 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/api/v1/notes` | 노트 목록 |
| `GET` | `/api/v1/notes/{id}` | 노트 상세 |
| `POST` | `/api/v1/webhooks/save` | 노트 저장 (에이전트용) |
| `PATCH` | `/api/v1/notes/{id}` | 노트 수정 |
| `GET` | `/api/v1/search?q=` | 전문 검색 |
| `GET` | `/api/v1/graph/notes` | 노트 그래프 |
| `GET` | `/api/v1/digest?hours=24` | 에이전트 활동 피드 |
| `POST` | `/api/v1/notes/{id}/request-enrich` | AI 처리 요청 |
| `GET` | `/api/v1/notes/enrichment/pending` | 처리 대기 목록 |
| `POST` | `/api/v1/notes/{id}/enrichment` | AI 처리 결과 제출 |

---

## 환경 변수

| 변수 | 대상 | 설명 |
|------|------|------|
| `VITE_API_URL` | frontend | 백엔드 URL (기본: `http://localhost:8000`) |
| `TURSO_URL` | backend | Turso DB URL (없으면 SQLite fallback) |
| `TURSO_AUTH_TOKEN` | backend | Turso 인증 토큰 |
| `SQLITE_PATH` | backend | SQLite 경로 (기본: `./mnemo.db`) |
| `LORIEN_DB_PATH` | backend | lorien DB 경로 |

---

## 아키텍처

```
Browser (Vite + React)
  ├── NotesSidebar  — 노트 목록, 태그 필터, 검색
  ├── NoteEditor    — Notion 스타일 TipTap 에디터
  └── UnifiedPanel  — Ego-graph + 링크 + 엔티티

FastAPI Backend
  ├── /api/v1/notes       — CRUD
  ├── /api/v1/search      — FTS5 전문 검색
  ├── /api/v1/graph       — 노트-to-노트 그래프
  ├── /api/v1/digest      — 24h 활동 피드
  ├── /api/v1/links       — 양방향 링크 관리
  └── /api/v1/enrichment  — AI 처리 job queue

Storage
  ├── Turso (libSQL cloud) — production
  └── SQLite              — local dev
```

---

## Vercel 배포

```bash
vercel --prod --yes
```

환경변수 (Vercel Dashboard):
- `TURSO_URL`, `TURSO_AUTH_TOKEN`
- `VITE_API_URL=https://mnemo-red.vercel.app`

---

## 관련 프로젝트

- [lorien](https://github.com/paperbags1103-hash/lorien) — AI 에이전트용 지식 그래프 백엔드
