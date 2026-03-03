# mnemo Phase 1 — Foundation & Skeleton

Build the complete monorepo skeleton for the **mnemo** project (AI agent's Obsidian web app).

## Architecture
- Frontend: Vite + React + TypeScript + TipTap + shadcn/ui → deploys to Vercel
- Backend: FastAPI (Python) → deploys to Fly.io
- Notes DB: Turso (libSQL cloud, SQLite-compatible)
- Knowledge graph: lorien (Python library at ~/Documents/lorien/)

## Task: Build the full monorepo skeleton

### 1. Root structure
Create `pnpm-workspace.yaml` (or npm workspaces in root `package.json`), `.gitignore`, `.env.example`, `README.md`.

### 2. Frontend: `apps/frontend/`
- Vite + React + TypeScript
- Install: `tiptap` (`@tiptap/react @tiptap/pm @tiptap/starter-kit`), `shadcn/ui` setup, `react-router-dom`, `zustand`, `@tanstack/react-query`
- Layout: Obsidian-style — left sidebar (file tree) + right editor panel
- Create placeholder components:
  - `src/app/App.tsx` — router setup
  - `src/features/notes/components/NoteEditor.tsx` — TipTap editor (basic markdown)
  - `src/features/tree/components/FileTree.tsx` — left sidebar note list
  - `src/lib/api.ts` — axios/fetch client with base URL from env
- `src/lib/queryClient.ts` — TanStack Query setup
- vite.config.ts with proxy to backend (`/api` → `http://localhost:8000`)
- `.env.example`: `VITE_API_URL=http://localhost:8000`

### 3. Backend: `apps/backend/`
- FastAPI + Python 3.11+
- `pyproject.toml` with dependencies: `fastapi uvicorn[standard] pydantic pydantic-settings sqlmodel libsql-client python-dotenv`
- Structure:
  ```
  app/
    main.py          — FastAPI app, CORS, routers
    core/
      config.py      — Settings (pydantic-settings, reads .env)
      db.py          — Turso/libSQL connection
    api/v1/
      health.py      — GET /health/live, GET /health/ready
      notes.py       — CRUD stubs (POST/GET/PATCH/DELETE /notes)
      tree.py        — GET /tree stub
      search.py      — GET /search stub
      ingest.py      — GET /ingest/jobs stub
      lorien.py      — POST /lorien/ingest/note stub
    models/
      note.py        — Note SQLModel
      folder.py      — Folder SQLModel
      ingest_job.py  — IngestJob SQLModel
  ```
- CORS middleware: allow all origins for dev
- `.env.example`: `TURSO_URL=libsql://... TURSO_AUTH_TOKEN=... LORIEN_DB_PATH=~/.openclaw/workspace/.lorien/db`
- `requirements.txt` as well

### 4. Health endpoints (IMPLEMENT, not stubs)
Implement `GET /health/live` → `{"status": "ok"}` and `GET /health/ready` → `{"status": "ok", "turso": "connected|error", "lorien": "available|unavailable"}`

### 5. Notes CRUD (IMPLEMENT basic version)
Implement actual Note CRUD with in-memory or SQLite fallback (since Turso needs credentials):
- Note model: `id (uuid), title, content (markdown text), folder_id (nullable), created_at, updated_at, version (int)`
- Use SQLite locally via `aiosqlite` or `databases` as fallback when TURSO_URL not set
- POST /api/v1/notes → create note
- GET /api/v1/notes → list notes
- GET /api/v1/notes/{id} → get note
- PATCH /api/v1/notes/{id} → update note (increment version)
- DELETE /api/v1/notes/{id} → delete note

### 6. Frontend ↔ Backend integration
- Connect FileTree to GET /api/v1/notes
- Connect NoteEditor to GET/PATCH /api/v1/notes/{id}
- Auto-save with 1s debounce on content change
- Show note list in left sidebar, click to open in editor

### 7. Deployment configs
- `apps/frontend/vercel.json` — SPA routing config
- `apps/backend/Dockerfile` — Python 3.11 slim, uvicorn
- `apps/backend/fly.toml` — basic Fly.io config

### 8. Git commit
Commit everything with message: `feat: Phase 1 — mnemo monorepo skeleton with working editor`

## Done criteria
- `cd apps/frontend && npm install && npm run dev` starts Vite dev server
- `cd apps/backend && uvicorn app.main:app --reload` starts FastAPI
- Note CRUD works end-to-end (create, list, edit, auto-save)
- Health endpoints respond correctly

When completely finished, run:
openclaw system event --text "Done: mnemo Phase 1 완료 — monorepo skeleton + working editor" --mode now
