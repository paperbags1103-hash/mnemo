# mnemo Phase 1 Code Fixes (Opus Review)

Apply the following fixes based on senior code review. These are ordered by severity.

## 🔴 Critical Fixes

### Fix 1: Remove `table=True` from Note model
**File:** `apps/backend/app/models/note.py`

The DB layer uses raw aiosqlite (not SQLModel engine), but `Note` is declared with `table=True`, causing SQLAlchemy metadata conflicts.

- Remove `table=True` from `Note` class
- Add a separate `NoteRead` schema with all fields for API responses:
  ```python
  class NoteRead(NoteBase):
      id: UUID
      created_at: datetime
      updated_at: datetime
      version: int
  ```

### Fix 2: Change response_model to NoteRead
**File:** `apps/backend/app/api/v1/notes.py`

Change all route `response_model=Note` to `response_model=NoteRead`.
Import `NoteRead` from models.

### Fix 3: Fix Note creation in db.py
**File:** `apps/backend/app/core/db.py`

Change `create_note`:
```python
# BEFORE (wrong):
note = Note.model_validate(payload.model_dump())

# AFTER (correct):
note = Note(
    id=uuid4(),
    title=payload.title,
    content=payload.content,
    folder_id=payload.folder_id,
    created_at=utcnow(),
    updated_at=utcnow(),
    version=1,
)
```

Also add proper return type hint: `-> NoteRead` and convert Note to NoteRead when returning.

### Fix 4: Verify updated_at is set on update
**File:** `apps/backend/app/core/db.py`

Confirm `update_note()` explicitly sets `updated_at = utcnow()` before the UPDATE query. If not already done, add it.

### Fix 5: Implement optimistic locking (version check)
**File:** `apps/backend/app/core/db.py` + `apps/backend/app/api/v1/notes.py` + `apps/backend/app/models/note.py`

Add `version` field to `NoteUpdate`:
```python
class NoteUpdate(SQLModel):
    title: Optional[str] = None
    content: Optional[str] = None
    folder_id: Optional[str] = None
    version: Optional[int] = None  # if provided, must match current version
```

In `db.py update_note()`: if `payload.version` is provided and doesn't match current version, raise a `ValueError("version_conflict")`.

In `notes.py`: catch `ValueError("version_conflict")` and raise `HTTPException(409, "Version conflict")`.

## 🟡 Warning Fixes

### Fix 6: Fix CORS configuration
**File:** `apps/backend/app/main.py`

`allow_origins=["*"]` with `allow_credentials=True` is invalid per browser spec.

Change to:
```python
allow_origins=settings.cors_origins,
allow_credentials=True,
```

Add to `config.py`:
```python
cors_origins: list[str] = ["http://localhost:5173", "http://localhost:4173"]
```

### Fix 7: Replace custom Placeholder with official TipTap package
**File:** `apps/frontend/src/features/notes/components/NoteEditor.tsx`

1. Install: add `@tiptap/extension-placeholder` to `apps/frontend/package.json` dependencies and run `npm install --legacy-peer-deps` in apps/frontend
2. Replace the entire custom `Placeholder` Extension with the official one:
   ```tsx
   import Placeholder from '@tiptap/extension-placeholder'
   // In extensions array:
   Placeholder.configure({ placeholder: 'Write something...' })
   ```
3. Remove the manual `Plugin`, `Decoration`, `DecorationSet` imports and the custom Extension code.
4. Add CSS for placeholder in `apps/frontend/src/index.css`:
   ```css
   .tiptap p.is-editor-empty:first-child::before {
     content: attr(data-placeholder);
     float: left;
     color: #8b949e;
     pointer-events: none;
     height: 0;
   }
   ```

### Fix 8: Fix stale closure in keyboard shortcut
**File:** `apps/frontend/src/app/App.tsx`

Wrap `handleCreateNote` in `useCallback` and add it to the `useEffect` dependency array:
```tsx
const handleCreateNote = useCallback(async () => {
  const created = await createNote.mutateAsync({
    title: "Untitled",
    content: "<p></p>",
  });
  setSelectedNoteId(created.id);
  setSavingState("saved");
}, [createNote, setSelectedNoteId, setSavingState]);

useEffect(() => {
  function handleKeydown(event: KeyboardEvent) {
    if (event.metaKey && event.key.toLowerCase() === "n") {
      event.preventDefault();
      void handleCreateNote();
    }
  }
  window.addEventListener("keydown", handleKeydown);
  return () => window.removeEventListener("keydown", handleKeydown);
}, [handleCreateNote]);
```

### Fix 9: Fix syncRef race condition in NoteEditor
**File:** `apps/frontend/src/features/notes/components/NoteEditor.tsx`

Replace `syncRef` + `queueMicrotask` pattern with TipTap's built-in `emitUpdate: false`:
```tsx
// BEFORE:
syncRef.current = true;
editor.commands.setContent(nextContent, false);
queueMicrotask(() => { syncRef.current = false; });

// AFTER:
editor.commands.setContent(nextContent, false);
// The second argument `false` already means emitUpdate=false in TipTap
// Remove syncRef entirely and remove the guard in onUpdate
```

Check TipTap docs: `editor.commands.setContent(content, emitUpdate)` — if second arg is `false`, `onUpdate` is not triggered. Remove `syncRef` ref and its usage completely.

### Fix 10: Add content length limit
**File:** `apps/backend/app/models/note.py`

Add max_length to content field:
```python
content: str = Field(default="", max_length=1_000_000)  # 1MB limit
```

Also add to `apps/backend/app/main.py`:
```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

# After app creation:
@app.middleware("http")  
async def limit_body_size(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > 2_000_000:  # 2MB max
        return JSONResponse(status_code=413, content={"detail": "Request too large"})
    return await call_next(request)
```

## Final Steps

1. Run `cd apps/frontend && npm install --legacy-peer-deps` to install @tiptap/extension-placeholder
2. Run `cd apps/frontend && npm run build` — must succeed with 0 TypeScript errors
3. Run `cd apps/backend && .venv/bin/python -c "from app.main import app; print('backend ok')"` 
4. Git commit: `git add -A && git commit -m "fix: Phase 1 code review — NoteRead schema, CORS, placeholder, optimistic lock, sync fix"`

When completely finished, run:
openclaw system event --text "Done: mnemo Phase 1 코드 수정 완료 — 모든 Opus 검수 이슈 수정됨" --mode now
