import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Note } from "@/features/notes/types";

type FileTreeProps = {
  notes: Note[];
  selectedNoteId?: string;
  isLoading: boolean;
  onCreateNote: () => void;
  onSelectNote: (noteId: string) => void;
};

export function FileTree({
  notes,
  selectedNoteId,
  isLoading,
  onCreateNote,
  onSelectNote,
}: FileTreeProps) {
  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-card/75 backdrop-blur">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">vault</p>
          <h1 className="text-lg font-semibold">mnemo</h1>
        </div>
        <Button className="gap-2" onClick={onCreateNote}>
          <Plus className="h-4 w-4" />
          New
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">Loading notes…</p>
        ) : notes.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">Create your first note.</p>
        ) : (
          <ul className="space-y-1">
            {notes.map((note) => (
              <li key={note.id}>
                <button
                  className={cn(
                    "w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted",
                    note.id === selectedNoteId && "bg-muted",
                  )}
                  onClick={() => onSelectNote(note.id)}
                  type="button"
                >
                  <p className="truncate text-sm font-medium">{note.title || "Untitled"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {note.content || "Empty note"}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
