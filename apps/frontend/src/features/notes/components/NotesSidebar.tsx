import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SourceBadge } from "@/features/notes/components/SourceBadge";
import { useDeleteNote, useNotesList, useTags } from "@/features/notes/hooks/useNotes";
import { useNotesStore } from "@/features/notes/store";
import { getNoteCategory } from "@/features/notes/types";
import { cn } from "@/lib/utils";

type NotesSidebarProps = {
  onDeletedNote?: () => void;
};

type SortOption = "latest" | "title" | "category";

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function NotesSidebar({ onDeletedNote }: NotesSidebarProps) {
  const { data: notes = [], isLoading } = useNotesList();
  const { data: tagsData } = useTags();
  const { selectedNoteId, setSelectedNoteId } = useNotesStore();
  const deleteNote = useDeleteNote();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("latest");

  const filteredNotes = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const nextNotes = notes.filter((note) => {
      const matchesTag = !selectedTag || note.tags.includes(selectedTag);
      const matchesQuery =
        !normalizedQuery ||
        note.title.toLowerCase().includes(normalizedQuery) ||
        note.content.toLowerCase().includes(normalizedQuery);

      return matchesTag && matchesQuery;
    });

    return nextNotes.sort((left, right) => {
      if (sortBy === "title") {
        return left.title.localeCompare(right.title, "ko");
      }

      if (sortBy === "category") {
        const leftCategory = getNoteCategory(left.tags);
        const rightCategory = getNoteCategory(right.tags);
        const categoryComparison = leftCategory.localeCompare(rightCategory, "ko");
        if (categoryComparison !== 0) {
          return categoryComparison;
        }

        return left.title.localeCompare(right.title, "ko");
      }

      return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
    });
  }, [notes, searchQuery, selectedTag, sortBy]);

  useEffect(() => {
    if (selectedNoteId === null && filteredNotes[0]?.id) {
      setSelectedNoteId(filteredNotes[0].id);
      return;
    }

    if (selectedNoteId && filteredNotes.every((note) => note.id !== selectedNoteId)) {
      setSelectedNoteId(filteredNotes[0]?.id ?? null);
    }
  }, [filteredNotes, selectedNoteId, setSelectedNoteId]);

  async function handleDelete(noteId: string) {
    await deleteNote.mutateAsync(noteId);
    if (selectedNoteId === noteId) {
      setSelectedNoteId(filteredNotes.find((note) => note.id !== noteId)?.id ?? null);
      onDeletedNote?.();
    }
  }

  return (
    <aside className="flex h-full w-[280px] flex-col border-r border-[#e9e9e7] bg-[#f7f7f5]">
      <div className="space-y-4 border-b border-[#e9e9e7] px-4 py-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#9b9b9b]">notes</p>
        </div>
        <Input
          className="border-[#e3e3e1] bg-[#ffffff] text-sm shadow-none placeholder:text-[#b2b2af] focus-visible:ring-[#d7d7d3]"
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search notes"
          value={searchQuery}
        />
        <select
          className="h-9 rounded-md border border-[#e3e3e1] bg-[#ffffff] px-3 text-sm text-[#1a1a1a] outline-none focus:border-[#d7d7d3]"
          onChange={(event) => setSortBy(event.target.value as SortOption)}
          value={sortBy}
        >
          <option value="latest">최신순</option>
          <option value="title">이름순</option>
          <option value="category">카테고리순</option>
        </select>
        {tagsData?.tags.length ? (
          <div className="max-h-28 overflow-y-auto">
            <div className="flex flex-wrap gap-2">
              {tagsData.tags.filter((tag) => !tag.startsWith("cat:")).map((tag) => {
                const isActive = selectedTag === tag;
                return (
                  <button
                    key={tag}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      isActive
                        ? "border-[#d7d7d3] bg-[#ffffff] text-[#1a1a1a]"
                        : "border-[#e3e3e1] bg-[#f1f1ef] text-[#6f6f6d] hover:bg-[#ffffff]",
                    )}
                    onClick={() => setSelectedTag(isActive ? null : tag)}
                    type="button"
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {isLoading ? (
          <p className="px-2 py-3 text-sm text-[#9b9b9b]">Loading notes...</p>
        ) : filteredNotes.length === 0 ? (
          <p className="px-2 py-3 text-sm text-[#9b9b9b]">
            {notes.length === 0 ? "Create your first note." : "No notes match this filter."}
          </p>
        ) : (
          <ul className="space-y-1">
            {filteredNotes.map((note) => {
              const category = getNoteCategory(note.tags);

              return (
                <li key={note.id}>
                <div
                  className={cn(
                    "group flex items-start gap-2 rounded-md border border-transparent px-3 py-2 transition-colors",
                    note.id === selectedNoteId
                      ? "border-[#e9e9e7] bg-[#efefed]"
                      : "hover:bg-[#f0f0ee]",
                  )}
                >
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setSelectedNoteId(note.id)}
                    type="button"
                  >
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-[#1a1a1a]">
                        {note.title || "Untitled"}
                      </p>
                      <span className="shrink-0 rounded-full bg-[#ececeb] px-2 py-0.5 text-[10px] font-medium text-[#6f6f6d]">
                        {category}
                      </span>
                      <SourceBadge className="shrink-0" source={note.source} />
                    </div>
                    <p className="truncate text-xs text-[#9b9b9b]">
                      {formatUpdatedAt(note.updated_at)}
                    </p>
                  </button>
                  <button
                    aria-label={`Delete ${note.title || "Untitled"}`}
                    className="mt-1 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => void handleDelete(note.id)}
                    type="button"
                  >
                    <Trash2 className="h-4 w-4 text-[#9b9b9b] hover:text-[#e03e3e]" />
                  </button>
                </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
