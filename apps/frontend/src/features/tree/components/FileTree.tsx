import { useEffect } from "react";
import { Trash2 } from "lucide-react";
import { useDeleteNote, useNotesList } from "@/features/notes/hooks/useNotes";
import { useNotesStore } from "@/features/notes/store";
import { cn } from "@/lib/utils";

type FileTreeProps = {
  onDeletedNote?: () => void;
};

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function FileTree({ onDeletedNote }: FileTreeProps) {
  const { data: notes = [], isLoading } = useNotesList();
  const { selectedNoteId, setSelectedNoteId } = useNotesStore();
  const deleteNote = useDeleteNote();

  useEffect(() => {
    if (selectedNoteId === null && notes[0]?.id) {
      setSelectedNoteId(notes[0].id);
    }
  }, [notes, selectedNoteId, setSelectedNoteId]);

  async function handleDelete(noteId: string) {
    await deleteNote.mutateAsync(noteId);
    if (selectedNoteId === noteId) {
      setSelectedNoteId(notes.find((note) => note.id !== noteId)?.id ?? null);
      onDeletedNote?.();
    }
  }

  return (
    <aside className="flex h-full w-[240px] flex-col border-r border-[#e9e9e7] bg-[#f7f7f5]">
      <div className="border-b border-[#e9e9e7] px-4 py-3">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#9b9b9b]">notes</p>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {isLoading ? (
          <p className="px-2 py-3 text-sm text-[#9b9b9b]">Loading notes...</p>
        ) : notes.length === 0 ? (
          <p className="px-2 py-3 text-sm text-[#9b9b9b]">Create your first note.</p>
        ) : (
          <ul className="space-y-1">
            {notes.map((note) => (
              <li key={note.id}>
                <div
                  className={cn(
                    "group flex items-center gap-2 rounded-md border border-transparent px-3 py-2 transition-colors",
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
                    <p className="truncate text-sm font-medium text-[#1a1a1a]">
                      {note.title || "Untitled"}
                    </p>
                    <p className="truncate text-xs text-[#9b9b9b]">
                      {formatUpdatedAt(note.updated_at)}
                    </p>
                  </button>
                  <button
                    aria-label={`Delete ${note.title || "Untitled"}`}
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => void handleDelete(note.id)}
                    type="button"
                  >
                    <Trash2 className="h-4 w-4 text-[#9b9b9b] hover:text-[#e03e3e]" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
