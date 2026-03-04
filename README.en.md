# mnemo

> AI Agent's Obsidian — knowledge management built for agents, not humans.

**[한국어 문서 →](./README.ko.md)**

---

## What is mnemo?

mnemo is a local-first knowledge base where AI agents act as tireless librarians — collecting, summarizing, categorizing, and linking notes automatically. Humans only read well-organized knowledge.

- **No LLM in the backend** — connected AI agents handle all AI processing
- **Note-to-note graph** — tag-based connections, Obsidian-style clustering
- **Agent-first API** — webhook, digest, enrichment queue, backlinks

---

## Screenshots

> Split view: Notion-style editor + knowledge graph side-by-side.

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 20+
- pnpm (`npm i -g pnpm`)

### Backend

```bash
cd apps/backend
python -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env          # edit if needed
.venv/bin/uvicorn app.main:app --port 8000 --reload
```

### Frontend

```bash
# Install from repo root (npm workspace)
npm install --legacy-peer-deps

cd apps/frontend
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

---

## Usage

### A. Write directly in the app

1. Open http://localhost:5173
2. `Cmd+N` → new note
3. Write → **Save** button or `Cmd+S`
4. Click **✨ AI** → queues enrichment (agent processes on next heartbeat, ~5 min)

### B. Agent saves via Discord/Signal

```
[content or URL] mnemo에 저장
```

The connected AI agent automatically:
1. Fetches content (if URL)
2. Extracts title / summary / category / tags via Claude
3. Saves to mnemo with structured format

### C. API

```bash
# Save note
curl -X POST http://localhost:8000/api/v1/webhooks/save \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Bitcoin halving cycle",
    "content": "<p>Content here...</p>",
    "source": "https://example.com",
    "tags": ["cat:기술", "bitcoin", "crypto"]
  }'

# Search
curl "http://localhost:8000/api/v1/search?q=bitcoin&limit=10"

# 24h digest
curl "http://localhost:8000/api/v1/digest?hours=24"
```

### D. MCP (Claude Desktop)

```bash
cd apps/mcp
pip install -e .
mnemo-mcp
```

---

## Note Format (agent saves)

```markdown
# Title

> Summary in 2 sentences

Body content...

---
출처: https://... · 2026-03-04
```

Tags: `["cat:기술", "bitcoin", "blockchain"]`
- `cat:` prefix = category (one per note)
- rest = regular tags

---

## AI Enrichment Flow (✨ AI button)

```
User clicks ✨ AI
   ↓
mnemo: enrichment_status = "pending"
   ↓  (~5 min later)
Agent: GET /api/v1/notes/enrichment/pending
Agent: Claude extracts → title / summary / category / tags
Agent: POST /api/v1/notes/{id}/enrichment
   ↓
Note auto-updated
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/notes` | List notes |
| `GET` | `/api/v1/notes/{id}` | Get note |
| `POST` | `/api/v1/webhooks/save` | Save note (agent) |
| `PATCH` | `/api/v1/notes/{id}` | Update note |
| `DELETE` | `/api/v1/notes/{id}` | Delete note |
| `GET` | `/api/v1/search?q=` | Full-text search |
| `GET` | `/api/v1/graph/notes` | Note graph |
| `GET` | `/api/v1/digest?hours=24` | Agent activity feed |
| `GET` | `/api/v1/categories` | List categories |
| `POST` | `/api/v1/categories` | Add category |
| `DELETE` | `/api/v1/categories/{name}` | Remove category |
| `POST` | `/api/v1/notes/{id}/request-enrich` | Request AI enrichment |
| `GET` | `/api/v1/notes/enrichment/pending` | Pending enrichment queue |
| `POST` | `/api/v1/notes/{id}/enrichment` | Submit enrichment result |
| `GET` | `/api/v1/notes/{id}/links` | Backlinks |
| `POST` | `/api/v1/links` | Create link |

---

## Environment Variables

| Variable | Target | Description |
|----------|--------|-------------|
| `VITE_API_URL` | frontend | Backend URL (default: `http://localhost:8000`) |
| `TURSO_URL` | backend | Turso cloud DB URL (optional) |
| `TURSO_AUTH_TOKEN` | backend | Turso auth token (optional) |
| `SQLITE_PATH` | backend | SQLite path (default: `./mnemo.db`) |
| `LORIEN_DB_PATH` | backend | lorien knowledge graph DB path |

---

## Architecture

```
Browser (Vite + React + TipTap)
  ├── NotesSidebar      category-grouped, collapsible, resizable
  ├── NoteEditor        Notion-style, Cmd+S, ✨ AI button
  ├── GraphView         Obsidian-style vis-network, barnesHut clustering
  └── UnifiedPanel      ego-graph + links + calendar + heatmap, hideable

FastAPI Backend (localhost:8000)
  ├── /api/v1/notes         CRUD + FTS5 search
  ├── /api/v1/graph         note-to-note graph (shared tags)
  ├── /api/v1/digest        24h agent activity feed
  ├── /api/v1/links         bidirectional backlinks
  ├── /api/v1/categories    dynamic category management
  └── /api/v1/enrichment    AI job queue (no LLM in backend)

Storage
  ├── SQLite  local dev (default)
  └── Turso   cloud production (optional)

Knowledge Graph
  └── lorien  local-first graph DB (entities, facts, relations)
```

---

## UI Features

- **3-panel layout**: sidebar / editor / knowledge panel — all resizable
- **Split view**: editor + full graph side-by-side (draggable divider)
- **Graph modes**: node-only, graph-only, split
- **Bidirectional sync**: graph node click → opens note; note change → graph focuses node
- **Dynamic categories**: add/remove from editor; auto-discovered from `cat:` tags
- **Mini calendar**: note activity by date in right panel
- **Activity heatmap**: 7-week GitHub-style contribution view

---

## Related

- [lorien](https://github.com/paperbags1103-hash/lorien) — AI agent knowledge graph backend
