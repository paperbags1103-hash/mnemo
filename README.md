# mnemo

mnemo — AI Agent's Obsidian. Knowledge management web app powered by lorien.

## Architecture

```txt
Browser
  |
  v
Vercel -> apps/frontend (Vite + React SPA)
  |
  v
Fly.io -> apps/backend (FastAPI)
  |
  +--> Turso / libSQL
  +--> SQLite fallback for local development
  +--> lorien ingest + graph read integration
```

## Quick Start

### Frontend

```bash
cd apps/frontend && npm install --legacy-peer-deps && npm run dev
```

### Backend

```bash
cd apps/backend && python -m venv .venv && .venv/bin/pip install -r requirements.txt && .venv/bin/uvicorn app.main:app --reload
```

The frontend runs on `http://localhost:5173`. The backend runs on `http://localhost:8000`.

## Environment Variables

| Variable | App | Required | Description |
| --- | --- | --- | --- |
| `VITE_API_URL` | frontend | Yes | Backend base URL used by the SPA. |
| `TURSO_URL` | backend | No | Turso or libSQL database URL for production persistence. |
| `TURSO_AUTH_TOKEN` | backend | No | Auth token for the Turso database. |
| `SQLITE_PATH` | backend | No | Local SQLite path used when Turso is not configured. |
| `LORIEN_DB_PATH` | backend | No | Filesystem path to the local lorien database. |

See [apps/frontend/.env.example](/Users/superdog/Documents/mnemo/apps/frontend/.env.example) and [apps/backend/.env.example](/Users/superdog/Documents/mnemo/apps/backend/.env.example) for defaults.

## Deploy

### Vercel

1. Set the project root to `apps/frontend`.
2. Configure `VITE_API_URL` to the public Fly.io backend URL.
3. Deploy with the bundled [vercel.json](/Users/superdog/Documents/mnemo/apps/frontend/vercel.json) settings.

### Fly.io

1. Deploy from `apps/backend` using the included [fly.toml](/Users/superdog/Documents/mnemo/apps/backend/fly.toml) and [Dockerfile](/Users/superdog/Documents/mnemo/apps/backend/Dockerfile).
2. Set `PORT=8000` and any Turso credentials as Fly secrets or environment variables.
3. Verify `/health/live` and `/health/ready` after deployment.

## Docs

- [docs/architecture.md](/Users/superdog/Documents/mnemo/docs/architecture.md)
- [docs/api-contract.md](/Users/superdog/Documents/mnemo/docs/api-contract.md)
- [docs/runbook.md](/Users/superdog/Documents/mnemo/docs/runbook.md)
