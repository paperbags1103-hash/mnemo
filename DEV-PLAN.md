# DEV-PLAN.md

## mnemo 개발 계획 (Phased Development Plan)

## 0) 목표와 원칙

- **목표(MVP):** Obsidian-style note editing experience를 먼저 안정적으로 제공
- **아키텍처 고정:**
  - Frontend: `Vite + React SPA` on **Vercel**
  - Backend: `FastAPI` on **Fly.io**
  - Notes storage: **Turso (libSQL)**
  - Knowledge graph: **lorien** (FastAPI wrapper로 연결)
- **핵심 제약 반영:**
  1. note save는 **항상 우선 성공**해야 함
  2. lorien ingest는 **async fire-and-forget**
  3. lorien 장애 시에도 note 기능은 **graceful degradation**
  4. graph UI는 **v1.1**로 이연

---

## 1) Phase Breakdown

## Phase 1 — Foundation & Skeleton (3일)

### 목표
- 배포 가능한 최소 뼈대(frontend/backend/DB 연결) 완성
- 팀 없이 solo로 빠르게 반복 가능한 개발환경 확보

### 작업
- Monorepo 생성 (`frontend`, `backend`)
- Frontend 초기화: `Vite + React + TypeScript + shadcn/ui + TipTap`
- Backend 초기화: `FastAPI + Pydantic + SQLModel(or SQLAlchemy)`
- Turso 연결 및 migration baseline 구성
- 공통 환경변수/설정 분리 (`.env.example`)
- Health endpoint, basic logging, CORS 설정
- CI 기본: lint/test/build (최소 수준)

### 완료 기준
- Vercel/Fly.io에 각각 “Hello + health check” 배포 성공
- Backend ↔ Turso read/write smoke test 통과

---

## Phase 2 — MVP Editor Core (7일)

### 목표
- 사용자가 실제로 note를 생성/수정/탐색할 수 있는 핵심 기능 완성

### 작업
- Obsidian-style 2-column 레이아웃
  - Left: file tree/folder tree
  - Right: TipTap editor
- Note CRUD API + frontend 연동
- Auto-save (`debounce`) + optimistic UI
- 파일/폴더 rename, move, delete
- 기본 검색(title/content LIKE 기반)
- 충돌 방지용 `updated_at`/`version` 기반 optimistic concurrency
- 에러 처리 UX (toast/retry/unsaved indicator)

### 완료 기준
- note 작성/수정/삭제/이동/검색 end-to-end 동작
- 새로고침/재접속 후 데이터 정합성 유지

---

## Phase 3 — Async lorien Ingestion & Resilience (5일)

### 목표
- note 저장과 graph ingestion의 생명주기를 분리
- lorien 불안정/장애 상황에서도 note 기능 100% 유지

### 작업
- Backend에 `IngestQueue` 도입
  - 초기 구현: DB-backed queue 테이블 + background worker
  - 상태: `pending | processing | done | failed`
  - `retry_count`, `next_retry_at`, exponential backoff
- note 저장 시 동작
  1. note 먼저 Turso commit
  2. ingest job enqueue
  3. 즉시 API 응답 (`202` 의미가 아닌 note save는 `200/201`)
- lorien wrapper client 구현 (timeout/circuit breaker)
- ingest 실패 관측 가능성 추가 (logs/metrics/admin endpoint)

### 완료 기준
- lorien down 상황에서 note save 성공률 유지
- lorien 복구 후 backlog 재처리 정상 동작

---

## Phase 4 — v1.1 Graph Read APIs + Minimal Graph UI (4일)

### 목표
- graph view를 editor에 종속되지 않게 단계적으로 노출

### 작업
- Backend에서 graph read API 프록시/정규화
- Frontend Graph 패널(또는 별도 route) 최소 구현
  - note 기준 관련 entity/fact 목록
  - contradiction/epistemic debt indicator 표시
- 성능 가드
  - pagination
  - query timeout
  - loading/empty/error 상태 분리

### 완료 기준
- 사용자가 note와 graph signal을 왕복 탐색 가능
- graph 기능 장애 시 editor 기능 영향 없음

---

## Phase 5 — Hardening & Release (3일)

### 목표
- 운영 안정성/관측성/문서화 강화 후 릴리즈

### 작업
- E2E smoke test (create/edit/search + ingest queue)
- Fly.io/Vercel production env 점검
- Sentry(or equivalent) + structured logging
- Backup/export 전략 문서화 (Turso)
- Runbook 작성 (장애 대응 절차)

### 완료 기준
- “MVP release checklist” 100% 완료
- 운영 핸드오프 가능한 문서 세트 확보

---

## 2) 권장 Repo Structure

```txt
mnemo/
├─ apps/
│  ├─ frontend/
│  │  ├─ src/
│  │  │  ├─ app/
│  │  │  │  ├─ routes/
│  │  │  │  ├─ layout/
│  │  │  │  └─ providers/
│  │  │  ├─ features/
│  │  │  │  ├─ notes/
│  │  │  │  │  ├─ components/
│  │  │  │  │  ├─ api/
│  │  │  │  │  ├─ hooks/
│  │  │  │  │  └─ types.ts
│  │  │  │  ├─ tree/
│  │  │  │  └─ graph/
│  │  │  ├─ components/ui/      # shadcn/ui
│  │  │  ├─ lib/
│  │  │  └─ main.tsx
│  │  ├─ index.html
│  │  ├─ package.json
│  │  └─ vite.config.ts
│  │
│  └─ backend/
│     ├─ app/
│     │  ├─ main.py
│     │  ├─ core/
│     │  │  ├─ config.py
│     │  │  ├─ logging.py
│     │  │  └─ db.py
│     │  ├─ api/
│     │  │  ├─ deps.py
│     │  │  └─ v1/
│     │  │     ├─ notes.py
│     │  │     ├─ tree.py
│     │  │     ├─ search.py
│     │  │     ├─ ingest.py
│     │  │     ├─ graph.py
│     │  │     └─ health.py
│     │  ├─ models/
│     │  │  ├─ note.py
│     │  │  ├─ folder.py
│     │  │  └─ ingest_job.py
│     │  ├─ schemas/
│     │  │  ├─ note.py
│     │  │  ├─ tree.py
│     │  │  ├─ ingest.py
│     │  │  └─ graph.py
│     │  ├─ services/
│     │  │  ├─ notes_service.py
│     │  │  ├─ tree_service.py
│     │  │  ├─ search_service.py
│     │  │  ├─ ingest_service.py
│     │  │  └─ lorien_client.py
│     │  ├─ workers/
│     │  │  └─ ingest_worker.py
│     │  └─ repositories/
│     │     ├─ note_repo.py
│     │     ├─ folder_repo.py
│     │     └─ ingest_repo.py
│     ├─ tests/
│     │  ├─ api/
│     │  ├─ services/
│     │  └─ e2e/
│     ├─ pyproject.toml
│     └─ Dockerfile
│
├─ packages/
│  ├─ shared-types/             # Optional (OpenAPI generated TS types)
│  └─ eslint-config/            # Optional
│
├─ docs/
│  ├─ architecture.md
│  ├─ api-contract.md
│  ├─ runbook.md
│  └─ release-checklist.md
│
├─ .github/workflows/
├─ .env.example
├─ pnpm-workspace.yaml (or npm workspaces)
└─ README.md
```

---

## 3) Frontend ↔ Backend API Contract (v1)

Base URL: `/api/v1`

## Notes

### `POST /notes`
- 목적: note 생성
- Request
```json
{
  "title": "string",
  "content": "string",
  "folder_id": "uuid|null"
}
```
- Response `201`
```json
{
  "id": "uuid",
  "title": "string",
  "content": "string",
  "folder_id": "uuid|null",
  "created_at": "iso",
  "updated_at": "iso",
  "version": 1
}
```
- Side effect: ingest job enqueue (`async`)

### `GET /notes/{note_id}`
- Response `200`: note detail

### `PATCH /notes/{note_id}`
- 목적: 부분 수정 (auto-save)
- Header: `If-Match: <version>` (권장)
- Request
```json
{
  "title": "string?",
  "content": "string?",
  "folder_id": "uuid|null?"
}
```
- Response `200`: updated note
- Conflict: `409` (version mismatch)
- Side effect: ingest job enqueue (`async`)

### `DELETE /notes/{note_id}`
- Response `204`
- Side effect: optional de-index/delete request to lorien queue

### `GET /notes?folder_id=&q=&cursor=&limit=`
- 목적: note 목록/검색
- Response `200`
```json
{
  "items": [ ... ],
  "next_cursor": "string|null"
}
```

## Tree / Folder

### `GET /tree`
- 목적: 좌측 file tree 렌더링
- Response: folder + note hierarchy

### `POST /folders`
### `PATCH /folders/{folder_id}`
### `DELETE /folders/{folder_id}`

## Search

### `GET /search?q=...&limit=...`
- MVP: Turso text search
- v1.1+: hybrid search(옵션)

## Ingest Observability

### `GET /ingest/jobs?status=&limit=`
- 목적: 운영/디버깅용

### `POST /ingest/jobs/{job_id}/retry`
- 목적: 수동 재시도

## Health

### `GET /health/live`
### `GET /health/ready`
- `ready`에 `turso`/`lorien` dependency 상태 포함 (non-blocking detail)

---

## 4) lorien FastAPI Wrapper Endpoints (필수)

> 위치: backend 내부 모듈 또는 별도 서비스(`lorien-wrapper`)로 시작 가능. MVP는 backend 내부 통합 권장.

## Write / Ingest

### `POST /lorien/ingest/note`
- 목적: note -> lorien graph ingest
- Request
```json
{
  "note_id": "uuid",
  "title": "string",
  "content": "string",
  "updated_at": "iso",
  "source": "mnemo"
}
```
- Response `202`
```json
{
  "accepted": true,
  "trace_id": "string"
}
```

### `POST /lorien/ingest/batch`
- 목적: backlog 재처리

## Read / Query

### `GET /lorien/graph`
- 기존 `lorien serve` 호환 + wrapper 표준 응답

### `GET /lorien/notes/{note_id}/entities`
- note와 연결된 entity 목록

### `GET /lorien/notes/{note_id}/facts`
- note 기반 fact 추출 결과

### `GET /lorien/contradictions?note_id=`
- contradiction 탐지 결과

### `GET /lorien/epistemic-debt?note_id=`
- epistemic debt 목록

### `GET /lorien/search?query=&top_k=`
- vector search endpoint 노출

## Ops

### `GET /lorien/health`
- wrapper 자체 health + lorien library 상태

### `GET /lorien/metrics`
- ingest latency / failure count / queue depth

---

## 5) Effort Estimate (Solo Developer)

- Phase 1: **3일**
- Phase 2: **7일**
- Phase 3: **5일**
- Phase 4: **4일**
- Phase 5: **3일**

**총합:** 약 **22일 (약 4.5주)**

### 버퍼 제안
- 배포 이슈/환경 차이 대응 버퍼: +20% (약 4~5일)
- 현실적 출시 시점: **5~6주**

---

## 6) Critical Path

1. **Turso schema + migration 안정화**
   - note/folder/ingest_job 스키마가 흔들리면 전 단계 지연

2. **Auto-save + optimistic concurrency 설계 확정**
   - editor UX/데이터 정합성 핵심

3. **Async ingest queue 구현**
   - “note save와 graph ingest 분리”는 시스템 핵심 요구사항

4. **lorien wrapper API 최소 스펙 동결**
   - endpoint/response 형태가 변하면 frontend/worker 재작업 발생

5. **장애 허용 동작(graceful degradation) 검증**
   - lorien down 시나리오 통과 전에는 릴리즈 불가

6. **배포 환경 parity 확보 (dev/stage/prod)**
   - Fly.io networking/timeout/env 차이로 마지막 주 리스크 집중

---

## 구현 우선순위 요약

1. **Editor-first (Phase 1~2)**: 사용자 가치 즉시 제공
2. **Resilience (Phase 3)**: 비동기 ingest + 장애 내성
3. **Graph exposure (Phase 4)**: v1.1 범위로 점진 확장
4. **Hardening (Phase 5)**: 운영 가능 수준으로 마무리

이 순서를 지키면 “쓸 수 있는 제품”을 먼저 출시하고, knowledge graph를 안전하게 후속 확장할 수 있다.
