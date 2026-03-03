# mnemo UI — Light Theme Conversion

Convert the entire mnemo frontend from dark theme (#0d1117 GitHub dark) to a clean white/light theme suitable for a text editor app (like Notion or Linear).

## Design Direction
- Clean white editor feel — professional, distraction-free
- Not "iOS Settings" white — more like Notion/Linear: warm whites, subtle grays
- The editor area itself must feel like a document (pure white or very near-white)
- Sidebar: subtle light gray background to distinguish from editor

## Color System (replace all dark colors with these)

| Element | Old (dark) | New (light) |
|---|---|---|
| App background | #0d1117 | #ffffff |
| Sidebar background | #161b22 | #f7f7f5 |
| Borders | #30363d | #e9e9e7 |
| Primary text | #e6edf3 | #1a1a1a |
| Secondary text (muted) | #8b949e | #9b9b9b |
| Selected note in sidebar | #0d1117 | #efefed |
| Hover state | #0d1117 | #f0f0ee |
| Editor area | (dark) | #ffffff |
| Header bar | (dark) | #ffffff |
| Input fields | transparent | transparent |
| Button (New Note) | #21262d border #30363d | #f0f0ee border #e9e9e7 |
| Button text | #e6edf3 | #1a1a1a |
| Save status text | #8b949e | #9b9b9b |
| Trash icon hover | #f85149 | #e03e3e |
| TipTap editor text | #e6edf3 | #1a1a1a |
| TipTap placeholder | (dark muted) | #b0b0b0 |

## Files to Update

### apps/frontend/src/app/App.tsx
- Change root div: `bg-[#ffffff] text-[#1a1a1a]`
- Header: `border-[#e9e9e7]` 
- Button: `bg-[#f0f0ee] border-[#e9e9e7] text-[#1a1a1a] hover:bg-[#e9e9e7]`

### apps/frontend/src/features/tree/components/FileTree.tsx
- Aside: `bg-[#f7f7f5] border-[#e9e9e7]`
- Section header: `border-[#e9e9e7] text-[#9b9b9b]`
- Note item selected: `bg-[#efefed] border-[#e9e9e7]`
- Note item hover: `hover:bg-[#f0f0ee]`
- Note title: `text-[#1a1a1a]`
- Note date: `text-[#9b9b9b]`
- Trash icon hover: `hover:text-[#e03e3e]`

### apps/frontend/src/features/notes/components/NoteEditor.tsx
- Section: `bg-[#ffffff]`
- Title input: `text-[#1a1a1a]`
- Border: `border-[#e9e9e7]`
- Editor attributes class: `text-[#1a1a1a]`
- Status text: `text-[#9b9b9b]`

### apps/frontend/src/index.css
- Update TipTap placeholder color: `color: #b0b0b0`
- Add base styles: `body { background: #ffffff; color: #1a1a1a; }`

## Additional Polish
- Add subtle box-shadow to the header: `border-b border-[#e9e9e7]` (already done, keep it)
- Make the title font slightly heavier: the "mnemo" brand in header should feel premium
- Sidebar note section header: uppercase tracking style is good, keep it
- Keep lucide icons — they work great in light mode

## Verification
- `npm run build` must succeed
- Check: no remaining dark hex codes (#0d1117, #161b22, #21262d, #30363d) in src/ files
- Git commit: `git add -A && git commit -m "feat: light theme — clean white editor UI"`

When done:
openclaw system event --text "Done: mnemo 라이트 테마 변환 완료" --mode now
