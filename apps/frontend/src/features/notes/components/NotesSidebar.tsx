import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Search, Trash2 } from "lucide-react";
import { useCategories, useDeleteNote, useNotesList, useTags } from "@/features/notes/hooks/useNotes";
import { useNotesStore } from "@/features/notes/store";
import { getNoteCategory, getNoteSubcategory } from "@/features/notes/types";
import { cn } from "@/lib/utils";
import type { Note } from "@/features/notes/types";

type NotesSidebarProps = {
  onCreateNote?: () => void;
  onDeletedNote?: () => void;
};
type SortOption = "latest" | "title" | "category";

const DEFAULT_CAT_COLORS: Record<string, string> = {
  투자: "#2563eb", 기술: "#7c3aed", 문화: "#d97706",
  여행: "#059669", 일기: "#db2777", 기타: "#6b7280",
};
const EXTRA_COLORS = ["#0891b2","#16a34a","#dc2626","#9333ea","#ea580c","#0d9488"];

function getCatColor(cat: string, allCats: string[]): string {
  if (DEFAULT_CAT_COLORS[cat]) return DEFAULT_CAT_COLORS[cat];
  const idx = allCats.indexOf(cat);
  return EXTRA_COLORS[idx % EXTRA_COLORS.length] ?? "#6b7280";
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 60) return `${m}분 전`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.round(h / 24)}일 전`;
}

// ── Single note row ──────────────────────────────────────
function NoteRow({
  note, isSelected, onSelect, onDelete, catColor, indent = false,
}: {
  note: Note; isSelected: boolean; onSelect: () => void;
  onDelete: () => void; catColor: string; indent?: boolean;
}) {
  return (
    <div className={cn(
      "group flex items-center border-l-2 py-2.5 transition-colors",
      indent ? "px-3 pl-8" : "px-3",
      isSelected ? "border-l-[#1a1a1a] bg-[#efefed]" : "border-l-transparent hover:bg-[#f0f0ee]"
    )}>
      <button className="min-w-0 flex-1 text-left" onClick={onSelect}>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: catColor }} />
          <p className="truncate text-[13px] font-medium text-[#1a1a1a]">
            {note.title || "제목 없음"}
          </p>
        </div>
        <p className="mt-0.5 pl-3 text-[10px] text-[#ababaa]">{timeAgo(note.updated_at)}</p>
      </button>
      <button aria-label="삭제" className="ml-1 opacity-0 transition-opacity group-hover:opacity-100" onClick={onDelete}>
        <Trash2 size={13} className="text-[#9b9b9b] hover:text-[#e03e3e]" />
      </button>
    </div>
  );
}

// ── Category section (collapsible) ──────────────────────
function SubcategorySection({
  name, notes, selectedNoteId, onSelect, onDelete, catColor,
}: {
  name: string; notes: Note[]; selectedNoteId: string | null;
  onSelect: (id: string) => void; onDelete: (id: string) => void; catColor: string;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-1.5 pl-6 pr-3 py-1 text-left hover:bg-[#f0f0ee] transition-colors"
      >
        <span className="h-1.5 w-1.5 rounded-full border" style={{ borderColor: catColor }} />
        <span className="flex-1 text-[9.5px] font-medium text-[#8b8b89]">{name}</span>
        <span className="text-[8px] text-[#c5c5c3]">{notes.length}</span>
        {open ? <ChevronDown size={9} className="text-[#c5c5c3]" /> : <ChevronRight size={9} className="text-[#c5c5c3]" />}
      </button>
      {open && notes.map(note => (
        <NoteRow
          key={note.id}
          note={note}
          isSelected={note.id === selectedNoteId}
          onSelect={() => onSelect(note.id)}
          onDelete={() => onDelete(note.id)}
          catColor={catColor}
          indent
        />
      ))}
    </div>
  );
}

function CategorySection({
  name, notes, selectedNoteId, onSelect, onDelete, color,
}: {
  name: string; notes: Note[]; selectedNoteId: string | null;
  onSelect: (id: string) => void; onDelete: (id: string) => void; color: string;
}) {
  const [open, setOpen] = useState(true);

  // group by subcategory
  const subGroups = useMemo(() => {
    const map = new Map<string, Note[]>();
    const noSub: Note[] = [];
    notes.forEach(note => {
      const sub = getNoteSubcategory(note.tags ?? []);
      if (sub) {
        const arr = map.get(sub) ?? [];
        arr.push(note);
        map.set(sub, arr);
      } else {
        noSub.push(note);
      }
    });
    return { subGroups: map, noSub };
  }, [notes]);

  const hasSubs = subGroups.subGroups.size > 0;

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left hover:bg-[#f0f0ee] transition-colors"
      >
        <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
        <span className="flex-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6b6b69]">{name}</span>
        <span className="text-[9px] text-[#ababaa]">{notes.length}</span>
        {open
          ? <ChevronDown size={10} className="text-[#ababaa]" />
          : <ChevronRight size={10} className="text-[#ababaa]" />}
      </button>
      {open && (
        <>
          {/* Notes without subcategory */}
          {subGroups.noSub.map(note => (
            <NoteRow
              key={note.id}
              note={note}
              isSelected={note.id === selectedNoteId}
              onSelect={() => onSelect(note.id)}
              onDelete={() => onDelete(note.id)}
              catColor={color}
              indent={hasSubs}
            />
          ))}
          {/* Subcategory groups */}
          {Array.from(subGroups.subGroups.entries()).map(([subName, subNotes]) => (
            <SubcategorySection
              key={subName}
              name={subName}
              notes={subNotes}
              selectedNoteId={selectedNoteId}
              onSelect={onSelect}
              onDelete={onDelete}
              catColor={color}
            />
          ))}
        </>
      )}
    </div>
  );
}

// ── Main sidebar ─────────────────────────────────────────
export function NotesSidebar({ onCreateNote, onDeletedNote }: NotesSidebarProps) {
  const { data: notes = [], isLoading } = useNotesList();
  const { data: tagsData } = useTags();
  const { data: categoriesData } = useCategories();
  const { selectedNoteId, setSelectedNoteId } = useNotesStore();
  const deleteNote = useDeleteNote();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("category");

  const allCats = categoriesData?.categories ?? ["투자","기술","문화","여행","일기","기타"];

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return notes.filter(n => {
      const matchTag = !selectedTag || n.tags.includes(selectedTag);
      const matchQ = !q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
      return matchTag && matchQ;
    });
  }, [notes, searchQuery, selectedTag]);

  const sortedNotes = useMemo(() => {
    return [...filteredNotes].sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title, "ko");
      if (sortBy === "category") {
        const cmp = getNoteCategory(a.tags).localeCompare(getNoteCategory(b.tags), "ko");
        return cmp !== 0 ? cmp : new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [filteredNotes, sortBy]);

  // Group by category when sortBy === "category"
  const grouped = useMemo<{ cat: string; notes: Note[] }[]>(() => {
    if (sortBy !== "category") return [];
    const map = new Map<string, Note[]>();
    for (const note of sortedNotes) {
      const cat = getNoteCategory(note.tags) || "기타";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(note);
    }
    // Sort groups by category order
    const order = new Map(allCats.map((c, i) => [c, i]));
    return [...map.entries()]
      .sort(([a], [b]) => (order.get(a) ?? 99) - (order.get(b) ?? 99))
      .map(([cat, notes]) => ({ cat, notes }));
  }, [sortBy, sortedNotes, allCats]);

  useEffect(() => {
    if (selectedNoteId === null && sortedNotes[0]?.id) {
      setSelectedNoteId(sortedNotes[0].id);
    }
    if (selectedNoteId && sortedNotes.every(n => n.id !== selectedNoteId)) {
      setSelectedNoteId(sortedNotes[0]?.id ?? null);
    }
  }, [sortedNotes, selectedNoteId, setSelectedNoteId]);

  async function handleDelete(noteId: string) {
    await deleteNote.mutateAsync(noteId);
    if (selectedNoteId === noteId) {
      setSelectedNoteId(sortedNotes.find(n => n.id !== noteId)?.id ?? null);
      onDeletedNote?.();
    }
  }

  const visibleTags = tagsData?.tags.filter(t => !t.startsWith("cat:")) ?? [];

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-[#e9e9e7] bg-[#f7f7f5]">
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#ababaa]">Notes</p>
      </div>

      {/* Search */}
      <div className="relative px-3 pb-3">
        <Search size={12} style={{ position:"absolute", left: 22, top: "50%", transform: "translateY(-80%)" }} className="text-[#ababaa]" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="검색..."
          className="w-full rounded-lg bg-[#efefed] py-2 pl-8 pr-3 text-xs text-[#1a1a1a] outline-none placeholder:text-[#ababaa] focus:bg-[#e8e8e6]"
        />
      </div>

      {/* Sort pills */}
      <div className="flex gap-1 px-3 pb-3">
        {(["category", "latest", "title"] as SortOption[]).map(opt => (
          <button
            key={opt}
            onClick={() => setSortBy(opt)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors",
              sortBy === opt ? "bg-[#1a1a1a] text-white" : "text-[#9b9b9b] hover:text-[#1a1a1a]"
            )}
          >
            {opt === "latest" ? "최신" : opt === "title" ? "이름" : "분류"}
          </button>
        ))}
      </div>

      {/* Tag filter */}
      {visibleTags.length > 0 && (
        <div className="max-h-16 overflow-y-auto px-3 pb-2">
          <div className="flex flex-wrap gap-1">
            {visibleTags.slice(0, 10).map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={cn(
                  "rounded-md px-2 py-0.5 text-[10px] transition-colors",
                  selectedTag === tag ? "bg-[#1a1a1a] text-white" : "bg-[#efefed] text-[#6f6f6d] hover:bg-[#e5e5e3]"
                )}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-[#e9e9e7]" />

      {/* Note list */}
      <div className="flex-1 overflow-y-auto py-1">
        {isLoading ? (
          <p className="px-4 py-3 text-xs text-[#9b9b9b]">불러오는 중...</p>
        ) : sortedNotes.length === 0 ? (
          <p className="px-4 py-3 text-xs text-[#9b9b9b]">
            {notes.length === 0 ? "첫 노트를 만들어보세요." : "검색 결과 없음"}
          </p>
        ) : sortBy === "category" ? (
          // Grouped view
          grouped.map(({ cat, notes: catNotes }) => (
            <CategorySection
              key={cat}
              name={cat}
              notes={catNotes}
              selectedNoteId={selectedNoteId}
              onSelect={setSelectedNoteId}
              onDelete={id => void handleDelete(id)}
              color={getCatColor(cat, allCats)}
            />
          ))
        ) : (
          // Flat list
          <ul>
            {sortedNotes.map(note => {
              const cat = getNoteCategory(note.tags);
              return (
                <li key={note.id}>
                  <NoteRow
                    note={note}
                    isSelected={note.id === selectedNoteId}
                    onSelect={() => setSelectedNoteId(note.id)}
                    onDelete={() => void handleDelete(note.id)}
                    catColor={getCatColor(cat, allCats)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* New Note button */}
      <div className="border-t border-[#e9e9e7] p-3">
        <button
          onClick={onCreateNote}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#d5d5d3] py-2 text-xs text-[#9b9b9b] transition-colors hover:border-[#1a1a1a] hover:text-[#1a1a1a]"
        >
          <Plus size={13} />
          새 노트 (Cmd+N)
        </button>
      </div>
    </aside>
  );
}
