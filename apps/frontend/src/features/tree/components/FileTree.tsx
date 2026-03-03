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
    <aside className="flex h-full w-[240px] flex-col border-r border-[#30363d] bg-[#161b22]">
      <div className="border-b border-[#30363d] px-4 py-3">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#8b949e]">notes</p>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {isLoading ? (
          <p className="px-2 py-3 text-sm text-[#8b949e]">Loading notes...</p>
        ) : notes.length === 0 ? (
          <p className="px-2 py-3 text-sm text-[#8b949e]">Create your first note.</p>
        ) : (
          <ul className="space-y-1">
            {notes.map((note) => (
              <li key={note.id}>
                <div
                  className={cn(
                    "group flex items-center gap-2 rounded-md border border-transparent px-3 py-2 transition-colors",
                    note.id === selectedNoteId
                      ? "border-[#30363d] bg-[#0d1117]"
                      : "hover:bg-[#0d1117]",
                  )}
                >
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setSelectedNoteId(note.id)}
                    type="button"
                  >
                    <p className="truncate text-sm font-medium text-[#e6edf3]">
                      {note.title || "Untitled"}
                    </p>
                    <p className="truncate text-xs text-[#8b949e]">
                      {formatUpdatedAt(note.updated_at)}
                    </p>
                  </button>
                  <button
                    aria-label={`Delete ${note.title || "Untitled"}`}
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => void handleDelete(note.id)}
                    type="button"
                  >
                    <Trash2 className="h-4 w-4 text-[#8b949e] hover:text-[#f85149]" />
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
