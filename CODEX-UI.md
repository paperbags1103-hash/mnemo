# mnemo UI Fix — Save Button + Status Indicator

Edit `apps/frontend/src/features/notes/components/NoteEditor.tsx`.

## Changes needed

1. **Add a visible Save button** in the top-right area of the editor, next to the current save status text.
2. **Improve save status display** — show clearer states: saving / saved / failed.

### Current behavior:
- Auto-save triggers 1 second after typing stops
- Top-right shows "Save failed" text when save fails

### Desired behavior:
- Keep auto-save as-is
- Add a `Save` button (Cmd+S / Ctrl+S shortcut too)
- Save status: 
  - Idle: nothing shown
  - Saving: "Saving..." (gray)
  - Saved: "Saved ✓" (green, fades after 2s)
  - Failed: "Save failed" (red) + retry button

### Implementation

In `NoteEditor.tsx`, find where save status is displayed and the editor toolbar area.

Add a Save button that calls the same `saveNote` function that auto-save uses.

Add keyboard shortcut: when `Cmd+S` or `Ctrl+S` is pressed inside the editor, trigger save immediately.

Example structure to add near the top of the editor (right side header area):

```tsx
<div className="flex items-center gap-2">
  {saveStatus === 'saving' && (
    <span className="text-sm text-gray-400">Saving...</span>
  )}
  {saveStatus === 'saved' && (
    <span className="text-sm text-green-500">Saved ✓</span>
  )}
  {saveStatus === 'failed' && (
    <span className="text-sm text-red-500">Save failed</span>
  )}
  <button
    onClick={handleSave}
    className="px-3 py-1 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 transition-colors"
  >
    Save
  </button>
</div>
```

Use `useCallback` for `handleSave`. Use `useEffect` for the Cmd+S shortcut.

For the "Saved ✓" auto-fade, use a `useEffect` with `setTimeout` to reset status to idle after 2000ms.

## Final steps

1. `cd apps/frontend && npm run build 2>&1 | tail -5` — must pass
2. `cd ~/Documents/mnemo && git add apps/frontend/src && git commit -m "feat: save button + improved status indicator"`

Note: git push will fail (sandbox). That's OK — just commit locally.
