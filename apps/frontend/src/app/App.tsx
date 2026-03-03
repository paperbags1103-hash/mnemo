import { useCallback, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileTree } from "@/features/tree/components/FileTree";
import { NoteEditor } from "@/features/notes/components/NoteEditor";
import { useCreateNote } from "@/features/notes/hooks/useNotes";
import { useNotesStore } from "@/features/notes/store";

export function App() {
  const { setSelectedNoteId, setSavingState } = useNotesStore();
  const createNote = useCreateNote();

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

  return (
    <div className="flex h-screen overflow-hidden bg-[#ffffff] text-[#1a1a1a]">
      <FileTree />
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-[#e9e9e7] bg-[#ffffff] px-6">
          <h1 className="text-lg font-bold tracking-[0.08em] text-[#1a1a1a]">mnemo</h1>
          <Button
            className="gap-2 border border-[#e9e9e7] bg-[#f0f0ee] text-[#1a1a1a] hover:bg-[#e9e9e7]"
            onClick={() => void handleCreateNote()}
            type="button"
          >
            <Plus className="h-4 w-4" />
            New Note
          </Button>
        </header>
        <main className="min-h-0 flex-1">
          <NoteEditor />
        </main>
      </section>
    </div>
  );
}
