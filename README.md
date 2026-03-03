# mnemo

Monorepo skeleton for an Obsidian-style AI note workspace.

## Structure

- `apps/frontend`: Vite + React + TypeScript + TipTap + shadcn-style UI
- `apps/backend`: FastAPI + SQLModel with SQLite fallback and Turso readiness checks

## Local development

### Frontend

```bash
cd apps/frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies `/api` to `http://localhost:8000`.

### Backend

```bash
cd apps/backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The backend runs on `http://localhost:8000`.

## Environment

Copy the root `.env.example` to `.env` for shared defaults, then override per app if needed.

- Frontend: `apps/frontend/.env.example`
- Backend: `apps/backend/.env.example`

## Current scope

- Health endpoints: `/health/live`, `/health/ready`
- Note CRUD at `/api/v1/notes`
- Tree endpoint backed by notes list at `/api/v1/tree`
- Obsidian-style split view with file list and auto-saving editor
