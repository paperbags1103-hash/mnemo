# mnemo Phase 4 — Graph View v1.1

Add a knowledge graph panel to the UI. When a note is selected, show related lorien entities/facts in a right-side panel. Also add a full graph view route.

## Reference UI: GitNexus
The UI should be inspired by GitNexus:
- Right panel: AI analysis / knowledge relationships
- Node type color coding
- Clean filter chips

## Light theme colors (current system):
- Background: #ffffff
- Sidebar: #f7f7f5
- Borders: #e9e9e7
- Text: #1a1a1a
- Muted: #9b9b9b

## Task 1: Graph Panel — Note Knowledge Context (Right Side)

### Frontend: apps/frontend/src/features/graph/

Create `apps/frontend/src/features/graph/components/KnowledgePanel.tsx`:
- Shown on right side of NoteEditor when a note is selected
- Width: 280px, collapsible (toggle button)
- Light gray background: #f7f7f5, border-left: #e9e9e7
- Sections:
  1. **Entities** — list of entities extracted from this note (from lorien)
  2. **Facts** — key facts extracted from this note
  3. **Ingest Status** — shows current ingest job status for this note
- Loading state while fetching
- Empty state: "No knowledge extracted yet. Save the note to trigger extraction."
- Fetch from `GET /api/v1/lorien/notes/{noteId}/entities` and `GET /api/v1/lorien/notes/{noteId}/facts`

Create `apps/frontend/src/features/graph/hooks/useGraphData.ts`:
- `useNoteEntities(noteId)` — TanStack Query, GET /api/v1/lorien/notes/{noteId}/entities
- `useNoteFacts(noteId)` — TanStack Query, GET /api/v1/lorien/notes/{noteId}/facts
- `useIngestStatus(noteId)` — GET /api/v1/ingest/jobs?note_id={noteId}&limit=1

### Backend: apps/backend/app/api/v1/lorien.py
Implement these endpoints (with lorien graceful fallback if unavailable):

```python
GET /api/v1/lorien/notes/{note_id}/entities
→ {"entities": [{"id": str, "name": str, "entity_type": str, "confidence": float}]}

GET /api/v1/lorien/notes/{note_id}/facts  
→ {"facts": [{"id": str, "predicate": str, "object_": str, "confidence": float}]}
```

If lorien is unavailable: return empty lists `{"entities": [], "facts": []}` (don't error)

Implement in `lorien_client.py`:
```python
async def get_note_entities(self, note_id: str) -> list[dict]:
    """Get entities related to a note via source_ref."""
    # Use lorien memory to query entities where source_ref contains note_id
    ...

async def get_note_facts(self, note_id: str) -> list[dict]:
    """Get facts related to a note via source_ref."""
    ...
```

Also add `GET /api/v1/ingest/jobs?note_id=&status=&limit=` filter to ingest.py.

## Task 2: Full Graph View Route

### Frontend: apps/frontend/src/features/graph/components/GraphView.tsx
Create a full-page graph visualization:
- Route: `/graph` (add to react-router)
- Use `vis-network` for graph rendering (install: `npm install vis-network`)
  - Or use the vis.js that's already referenced in lorien serve
- Fetch from `GET /api/v1/lorien/graph`
- Node color by entity_type:
  - person: #ef4444
  - project: #3b82f6  
  - tool: #22c55e
  - concept: #a855f7
  - org: #f97316
  - default: #9b9b9b
- Node size based on fact_count
- Click node → show entity details in side panel
- Loading/empty states

Backend: `GET /api/v1/lorien/graph` — proxy to lorien memory, return nodes+edges for vis-network format.

## Task 3: Navigation

### apps/frontend/src/app/App.tsx
Add navigation:
- Sidebar bottom: "Graph" icon link (network icon from lucide-react)
- Routes: `/` → note editor, `/graph` → graph view
- Active route highlighted in sidebar nav

## Task 4: Wire KnowledgePanel into main layout
In `App.tsx` or main layout:
- When note selected: show KnowledgePanel on the right
- KnowledgePanel toggle: small button on the right edge (chevron icon)
- Default: collapsed on mobile width, expanded on wide screens

## Verification
1. `cd apps/frontend && npm run build` — 0 TypeScript errors
2. `cd apps/backend && .venv/bin/python -c "from app.main import app; print('ok')"`
3. Start backend, GET /api/v1/lorien/notes/fake-id/entities returns `{"entities": []}` (not 500)
4. Git commit: `git add -A && git commit -m "feat: Phase 4 — graph view v1.1, knowledge panel, full graph route"`

When done:
openclaw system event --text "Done: mnemo Phase 4 완료 — 그래프 뷰 + 지식 패널" --mode now
