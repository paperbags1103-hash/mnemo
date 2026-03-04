# mnemo

> AI 에이전트를 위한 옵시디언 — 인간이 아닌 에이전트를 위한 지식 관리 시스템

**[English →](./README.en.md)**

---

## mnemo란?

mnemo는 AI 에이전트가 지식을 자동 수집·요약·분류·연결하고, 인간은 잘 정리된 지식베이스를 읽기만 하는 **로컬 우선 지식 관리 시스템**입니다.

**핵심 철학:**
- **백엔드에 LLM 없음** — AI 에이전트가 모든 AI 처리 담당
- **노트-to-노트 그래프** — 공유 태그 기반 연결, 옵시디언 스타일 클러스터링
- **에이전트 우선 API** — webhook, digest, enrichment 대기열, 백링크

---

## 빠른 시작

### 사전 준비

- Python 3.11 이상
- Node.js 20 이상
- pnpm (`npm i -g pnpm`)

### 백엔드 실행

```bash
cd apps/backend
python -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env   # 필요 시 편집
.venv/bin/uvicorn app.main:app --port 8000 --reload
```

### 프론트엔드 실행

```bash
cd apps/frontend
npm install --legacy-peer-deps
npm run dev
```

- 프론트엔드: http://localhost:5173
- 백엔드 API: http://localhost:8000
- API 문서: http://localhost:8000/docs

---

## 키보드 단축키

| 단축키 | 동작 |
|--------|------|
| `Cmd+N` | 새 노트 생성 |
| `Cmd+S` | 노트 저장 |
| `Cmd+K` | 검색 |
| `Cmd+\` | 사이드바 토글 |
| `Esc` | 편집 취소 |

---

## 사용 방법

### A. 앱에서 직접 작성

1. http://localhost:5173 접속
2. `Cmd+N` → 새 노트 생성
3. 제목/본문 작성 → **저장** 버튼 또는 `Cmd+S`
4. **✨ AI** 버튼 → 연결된 AI 에이전트가 자동으로 요약+분류+태그 처리 (~5분)

### B. B. AI 에이전트가 Discord/Signal을 통해 저장

```
[내용 또는 URL] mnemo에 저장
```

AI 에이전트가 자동으로:
1. URL이면 본문 수집
2. Claude로 제목/요약/카테고리/태그 추출
3. 아래 포맷으로 mnemo에 저장

### C. API 직접 호출

```bash
# 노트 저장
curl -X POST http://localhost:8000/api/v1/webhooks/save \
  -H "Content-Type: application/json" \
  -d '{
    "title": "비트코인 반감기 사이클",
    "content": "<p>내용...</p>",
    "source": "https://example.com",
    "tags": ["cat:투자", "비트코인", "암호화폐"]
  }'

# 검색
curl "http://localhost:8000/api/v1/search?q=비트코인&limit=10"

# 24시간 활동 피드
curl "http://localhost:8000/api/v1/digest?hours=24"
```

### D. mnemo-cli

```bash
cd apps/cli
pip install -e .

# 명령어 목록
mnemo save "제목" "내용" --category 기술 --tags "python,ai"
mnemo search "검색어"
mnemo list [--category 투자] [--limit 20]
mnemo get <note-id>
mnemo delete <note-id>
mnemo digest [--hours 24]
```

환경 변수로 서버 설정:

```bash
export MNEMO_API_URL=http://localhost:8000
export MNEMO_TOKEN=your-token  # MNEMO_TOKEN 설정 시
```

### E. MCP (Claude Desktop)

```bash
cd apps/mcp
pip install -e .
mnemo-mcp
```

`~/.claude_desktop_config.json`에 등록 후 Claude Desktop에서 직접 사용:

| MCP 도구 | 설명 |
|---------|------|
| `mnemo_save` | 노트 저장 |
| `mnemo_search` | 전문 검색 |
| `mnemo_list` | 노트 목록 조회 |
| `mnemo_get` | 노트 상세 조회 |
| `mnemo_digest` | 에이전트 활동 피드 |

---

## 저장 포맷 (에이전트 저장 시)

```markdown
# 제목

> 핵심 요약 2문장

본문 내용...

---
출처: https://... · 2026-03-04
```

태그: `["cat:기술", "비트코인", "블록체인"]`
- `cat:` prefix = 카테고리 (노트당 하나)
- 나머지 = 일반 태그 (그래프 연결에 사용)

---

## AI Enrichment 흐름 (✨ AI 버튼)

```
사용자: ✨ AI 클릭
   ↓
mnemo: enrichment_status = "pending"
   ↓ (에이전트 heartbeat ~5분)
에이전트: GET /api/v1/notes/enrichment/pending
에이전트: LLM으로 분석 → 제목/요약/카테고리/태그
에이전트: POST /api/v1/notes/{id}/enrichment
   ↓
노트 자동 업데이트 완료
```

**핵심 원칙:** mnemo 백엔드에 LLM 없음. 연결된 AI 에이전트가 모든 AI 처리.

---

## 검색 문법

```bash
# 기본 전문 검색 (FTS5)
GET /api/v1/search?q=비트코인

# 카테고리 필터
GET /api/v1/search?q=투자&category=투자

# 태그 필터
GET /api/v1/search?q=AI&tags=python,llm

# 결과 수 제한
GET /api/v1/search?q=여행&limit=5
```

---

## 카테고리 시스템

기본 카테고리: `투자 · 기술 · 문화 · 여행 · 일기 · 기타`

- 에디터에서 `+` 버튼으로 카테고리 추가/삭제
- AI 에이전트가 `cat:신규카테고리` 태그로 저장하면 자동 반영
- 기본 카테고리는 삭제 불가

---

## 주요 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/api/v1/notes` | 노트 목록 |
| `GET` | `/api/v1/notes/{id}` | 노트 상세 |
| `POST` | `/api/v1/webhooks/save` | 노트 저장 (에이전트용) |
| `PATCH` | `/api/v1/notes/{id}` | 노트 수정 |
| `DELETE` | `/api/v1/notes/{id}` | 노트 삭제 |
| `GET` | `/api/v1/search?q=` | 전문 검색 (FTS5) |
| `GET` | `/api/v1/graph/notes` | 노트 그래프 |
| `GET` | `/api/v1/digest?hours=24` | 에이전트 활동 피드 |
| `GET` | `/api/v1/categories` | 카테고리 목록 |
| `POST` | `/api/v1/categories` | 카테고리 추가 |
| `DELETE` | `/api/v1/categories/{name}` | 카테고리 삭제 |
| `POST` | `/api/v1/notes/{id}/request-enrich` | AI 처리 요청 |
| `GET` | `/api/v1/notes/enrichment/pending` | 처리 대기 목록 |
| `POST` | `/api/v1/notes/{id}/enrichment` | AI 처리 결과 제출 |
| `GET` | `/api/v1/notes/{id}/links` | 백링크 조회 |
| `POST` | `/api/v1/links` | 링크 생성 |

---

## 환경 변수

| 변수 | 대상 | 설명 |
|------|------|------|
| `VITE_API_URL` | frontend | 백엔드 URL (기본: `http://localhost:8000`) |
| `TURSO_URL` | backend | Turso 클라우드 DB URL (선택) |
| `TURSO_AUTH_TOKEN` | backend | Turso 인증 토큰 (선택) |
| `SQLITE_PATH` | backend | SQLite 경로 (기본: `./mnemo.db`) |
| `LORIEN_DB_PATH` | backend | lorien 지식그래프 DB 경로 |

---

## 아키텍처

```
브라우저 (Vite + React + TipTap)
  ├── NotesSidebar    카테고리 그룹, 접기/펼치기, 리사이즈
  ├── NoteEditor      Notion 스타일, Cmd+S, ✨ AI 버튼
  ├── GraphView       Obsidian 스타일 그래프, barnesHut 클러스터링
  └── UnifiedPanel    ego-graph + 링크 + 캘린더 + 히트맵, 숨김 가능

FastAPI 백엔드 (localhost:8000)
  ├── /api/v1/notes       CRUD + FTS5 검색
  ├── /api/v1/graph       노트-to-노트 그래프 (공유 태그)
  ├── /api/v1/digest      24h 에이전트 활동 피드
  ├── /api/v1/links       양방향 백링크
  ├── /api/v1/categories  동적 카테고리 관리
  └── /api/v1/enrichment  AI job queue (백엔드에 LLM 없음)

저장소
  ├── SQLite   로컬 개발 (기본값)
  └── Turso    클라우드 프로덕션 (선택)

지식 그래프
  └── lorien   로컬 우선 그래프 DB (엔티티, 팩트, 관계)
```

---

## UI 기능

### 레이아웃
- **3패널 레이아웃**: 사이드바 / 에디터 / 지식패널 — 모두 드래그로 너비 조절
- **분할 뷰**: 에디터 + 전체 그래프 좌우 동시 표시
- **패널 숨기기**: 오른쪽 패널 상단 버튼으로 숨김/표시

### 사이드바
- 카테고리별 섹션 그룹 (접기/펼치기)
- 정렬: 최신 / 이름 / 분류
- 태그 필터
- 검색

### 에디터
- Notion 스타일 제목 (36px bold)
- 카테고리 컬러 점 + 드롭다운
- 저장 버튼 + Cmd+S
- ✨ AI 버튼 (AI 에이전트에게 enrichment 요청)

### 그래프
- 카테고리별 색상 클러스터 (barnesHut 물리 엔진)
- hover 시 제목 tooltip, 선택 시 ring 하이라이트
- 오른쪽 필터 패널: 카테고리 토글, 고립 노드 필터, 검색
- **양방향 연동**: 노드 클릭 → 에디터 노트 변경 / 노트 변경 → 그래프 포커스

### 오른쪽 패널
- ego-graph (현재 노트 중심 1-hop 네트워크)
- 링크된 노트 / 관련 노트 (공유 태그)
- 미니 캘린더 (노트 생성일 표시)
- 활동 히트맵 (7주 GitHub 스타일)

---

## 관련 프로젝트

- [lorien](https://github.com/paperbags1103-hash/lorien) — AI 에이전트용 로컬 우선 지식 그래프 백엔드

---

## 라이선스

MIT
