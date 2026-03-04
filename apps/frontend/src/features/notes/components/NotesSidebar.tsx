import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { useDeleteNote, useNotesList, useTags } from "@/features/notes/hooks/useNotes";
import { useNotesStore } from "@/features/notes/store";
import { getNoteCategory } from "@/features/notes/types";
import { cn } from "@/lib/utils";

type NotesSidebarProps = {
  onCreateNote?: () => void;
  onDeletedNote?: () => void;
};
type SortOption = "latest" | "title" | "category";

const CAT_COLORS: Record<string, string> = {
  투자: "#2563eb", 기술: "#7c3aed", 문화: "#d97706",
  여행: "#059669", 일기: "#db2777", 기타: "#6b7280",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 60) return `${m}분 전`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.round(h / 24)}일 전`;
}

export function NotesSidebar({ onCreateNote, onDeletedNote }: NotesSidebarProps) {
  const { data: notes = [], isLoading } = useNotesList();
  const { data: tagsData } = useTags();
  const { selectedNoteId, setSelectedNoteId } = useNotesStore();
  const deleteNote = useDeleteNote();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("latest");

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return notes
      .filter(n => {
        const matchTag = !selectedTag || n.tags.includes(selectedTag);
        const matchQ = !q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
        return matchTag && matchQ;
      })
      .sort((a, b) => {
        if (sortBy === "title") return a.title.localeCompare(b.title, "ko");
        if (sortBy === "category") {
          const cmp = getNoteCategory(a.tags).localeCompare(getNoteCategory(b.tags), "ko");
          return cmp !== 0 ? cmp : a.title.localeCompare(b.title, "ko");
        }
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
  }, [notes, searchQuery, selectedTag, sortBy]);

  useEffect(() => {
    if (selectedNoteId === null && filteredNotes[0]?.id) {
      setSelectedNoteId(filteredNotes[0].id);
      return;
    }
    if (selectedNoteId && filteredNotes.every(n => n.id !== selectedNoteId)) {
      setSelectedNoteId(filteredNotes[0]?.id ?? null);
    }
  }, [filteredNotes, selectedNoteId, setSelectedNoteId]);

  async function handleDelete(noteId: string) {
    await deleteNote.mutateAsync(noteId);
    if (selectedNoteId === noteId) {
      setSelectedNoteId(filteredNotes.find(n => n.id !== noteId)?.id ?? null);
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
        <Search size={12} className="absolute left-5.5 top-1/2 -translate-y-1/2 text-[#ababaa]" style={{ left: 22, top: "50%", transform: "translateY(-50%)" }} />
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
        {(["latest", "title", "category"] as SortOption[]).map(opt => (
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
        <div className="max-h-20 overflow-y-auto px-3 pb-2">
          <div className="flex flex-wrap gap-1">
            {visibleTags.slice(0, 12).map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={cn(
                  "rounded-md px-2 py-0.5 text-[10px] transition-colors",
                  selectedTag === tag
                    ? "bg-[#1a1a1a] text-white"
                    : "bg-[#efefed] text-[#6f6f6d] hover:bg-[#e5e5e3]"
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
        ) : filteredNotes.length === 0 ? (
          <p className="px-4 py-3 text-xs text-[#9b9b9b]">
            {notes.length === 0 ? "첫 노트를 만들어보세요." : "검색 결과 없음"}
          </p>
        ) : (
          <ul>
            {filteredNotes.map(note => {
              const cat = getNoteCategory(note.tags);
              const isSelected = note.id === selectedNoteId;
              return (
                <li key={note.id}>
                  <div className={cn(
                    "group flex items-center border-l-2 px-3 py-2.5 transition-colors",
                    isSelected
                      ? "border-l-[#1a1a1a] bg-[#efefed]"
                      : "border-l-transparent hover:bg-[#f0f0ee]"
                  )}>
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setSelectedNoteId(note.id)}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: CAT_COLORS[cat] ?? "#6b7280" }}
                        />
                        <p className="truncate text-[13px] font-medium text-[#1a1a1a]">
                          {note.title || "제목 없음"}
                        </p>
                      </div>
                      <p className="mt-0.5 pl-3 text-[10px] text-[#ababaa]">{timeAgo(note.updated_at)}</p>
                    </button>
                    <button
                      aria-label="삭제"
                      className="ml-1 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => void handleDelete(note.id)}
                    >
                      <Trash2 size={13} className="text-[#9b9b9b] hover:text-[#e03e3e]" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* New Note button — bottom */}
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
