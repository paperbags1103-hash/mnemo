# Architecture

## System Diagram

```txt
Users
  |
  v
Vercel (apps/frontend, Vite React SPA)
  |
  | HTTPS /api requests
  v
Fly.io (apps/backend, FastAPI)
  |
  +--> Turso/libSQL or local SQLite fallback
  |
  +--> lorien ingestion + graph read APIs
```

## Data Flow

1. The frontend SPA loads from Vercel and calls the backend over `VITE_API_URL`.
2. FastAPI handles note CRUD, tree, search, health, and ingest observability endpoints.
3. Notes are persisted in Turso when configured, otherwise the backend falls back to local SQLite.
4. Successful note writes enqueue lorien ingestion work asynchronously so editor writes are not blocked by graph processing.
5. Graph and knowledge panel reads are served through backend wrapper endpoints so lorien failures degrade without taking down note editing.
