# mnemo Phase 2 — MVP Editor Core

Phase 1 skeleton is done. Now build the complete working editor experience.

## Current State
- Backend: FastAPI running, Note CRUD works with SQLite fallback
- Frontend: Vite+React built successfully, TipTap + shadcn/ui installed
- Files: apps/frontend/src/, apps/backend/app/

## Phase 2 Tasks

### 1. Polish the Obsidian-style layout (apps/frontend/src/app/App.tsx)
Create a full dark-themed layout:
- Left sidebar (240px): FileTree component showing note list
- Right main area: NoteEditor (TipTap) filling remaining space
- Top bar: app name "mnemo" + "New Note" button
- Dark theme: background #0d1117, sidebar #161b22, borders #30363d (GitHub dark style)
- No scroll on root, proper flex layout

### 2. FileTree component (apps/frontend/src/features/tree/components/FileTree.tsx)
- Fetch notes from GET /api/v1/notes on load
- Show list of notes (title + truncated date)
- Click note → loads in editor
- "New Note" creates a note via POST /api/v1/notes with title "Untitled"
- Highlight currently selected note
- Delete button (trash icon) on hover per note item
- Use @tanstack/react-query for data fetching + cache invalidation

### 3. NoteEditor component (apps/frontend/src/features/notes/components/NoteEditor.tsx)
TipTap rich text editor:
- Extensions: StarterKit, Placeholder ("Write something...")
- Full-height editor filling the right panel
- Auto-save: debounce 1000ms, PATCH /api/v1/notes/{id} on content change
- Show "Saving..." / "Saved" / "Unsaved changes" status indicator in top-right corner
- When no note selected: show empty state "Select or create a note"
- Title editable at top (separate input, also auto-saves)

### 4. useNotes hook (apps/frontend/src/features/notes/hooks/useNotes.ts)
- `useNotesList()` — TanStack Query, GET /api/v1/notes
- `useNote(id)` — GET /api/v1/notes/{id}
- `useCreateNote()` — mutation, POST /api/v1/notes
- `useUpdateNote()` — mutation, PATCH /api/v1/notes/{id}
- `useDeleteNote()` — mutation, DELETE /api/v1/notes/{id}
- All mutations invalidate the notes list query

### 5. Zustand store (apps/frontend/src/features/notes/store.ts)
- `selectedNoteId: string | null`
- `setSelectedNoteId(id)`
- `savingState: 'idle' | 'saving' | 'saved' | 'error'`
- `setSavingState(state)`

### 6. Backend: enhance Note CRUD (apps/backend/app/api/v1/notes.py)
- GET /api/v1/notes: return list sorted by updated_at DESC
- PATCH /api/v1/notes/{id}: accept partial update (title?, content?), increment version
- Ensure SQLite DB persists to a file (mnemo.db in backend dir), not in-memory
- Add GET /api/v1/notes/{id} if missing

### 7. Backend: fix SQLite persistence (apps/backend/app/core/db.py)
- Use `sqlite:///./mnemo.db` as the default database path
- Create tables on startup if they don't exist
- Make sure notes persist between server restarts

### 8. Wire everything together
- App.tsx: FileTree on left, NoteEditor on right, connected via Zustand store
- When user clicks note in FileTree → selectedNoteId updates → NoteEditor loads that note
- When user types → debounced auto-save → status indicator updates
- When user creates note → appears in FileTree → auto-selected in editor

### 9. Add keyboard shortcut
- Cmd+N: create new note

### 10. Build verification
- Run: cd apps/frontend && npm run build (must succeed with 0 errors)
- Run: cd apps/backend && .venv/bin/python -c "from app.main import app; print('backend ok')"
- Test the full flow manually: create note, edit it, refresh, see it persisted

### 11. Git commit
- `git add -A && git commit -m "feat: Phase 2 — working Obsidian-style editor with auto-save"`

When completely finished, run:
openclaw system event --text "Done: mnemo Phase 2 완료 — Obsidian-style editor with auto-save working" --mode now
