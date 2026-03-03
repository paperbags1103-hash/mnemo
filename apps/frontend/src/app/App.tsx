import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { FileTree } from "@/features/tree/components/FileTree";
import { NoteEditor } from "@/features/notes/components/NoteEditor";
import { useCreateNote, useNote, useNotes, useUpdateNote } from "@/features/notes/hooks/useNotes";
import { useNotesStore } from "@/features/notes/store";

function NotesWorkspace() {
  const { noteId } = useParams();
  const navigate = useNavigate();
  const { selectedNoteId, setSelectedNoteId } = useNotesStore();
  const { data: notes = [], isLoading: isNotesLoading } = useNotes();
  const { data: note, isLoading: isNoteLoading } = useNote(noteId);
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const [draft, setDraft] = useState<{ title: string; content: string } | null>(null);
  const debounceRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (noteId) {
      setSelectedNoteId(noteId);
      return;
    }

    if (notes[0]?.id) {
      navigate(`/notes/${notes[0].id}`, { replace: true });
    }
  }, [navigate, noteId, notes, setSelectedNoteId]);

  useEffect(() => {
    if (!note || !draft) {
      return;
    }

    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      if (draft.title === note.title && draft.content === note.content) {
        return;
      }

      updateNote.mutate({
        noteId: note.id,
        payload: draft,
      });
    }, 1000);

    return () => window.clearTimeout(debounceRef.current);
  }, [draft, note, updateNote]);

  const sortedNotes = useMemo(
    () =>
      [...notes].sort(
        (left, right) =>
          new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime(),
      ),
    [notes],
  );

  async function handleCreateNote() {
    const created = await createNote.mutateAsync({
      title: "Untitled",
      content: "",
    });

    navigate(`/notes/${created.id}`);
  }

  return (
    <div className="grid min-h-screen grid-cols-1 bg-background lg:grid-cols-[320px_1fr]">
      <FileTree
        isLoading={isNotesLoading}
        notes={sortedNotes}
        onCreateNote={handleCreateNote}
        onSelectNote={(nextId) => navigate(`/notes/${nextId}`)}
        selectedNoteId={selectedNoteId}
      />
      <main className="flex min-h-[calc(100vh-1px)] flex-col p-4 lg:p-8">
        <div className="mx-auto flex h-full w-full max-w-5xl flex-1 flex-col">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                editor
              </p>
              <h2 className="text-2xl font-semibold">Knowledge workspace</h2>
            </div>
          </div>
          <NoteEditor
            isLoading={isNoteLoading}
            isSaving={updateNote.isPending}
            note={note}
            onChange={(nextDraft) => setDraft(nextDraft)}
          />
        </div>
      </main>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<NotesWorkspace />} path="/" />
      <Route element={<NotesWorkspace />} path="/notes/:noteId" />
      <Route element={<Navigate replace to="/" />} path="*" />
    </Routes>
  );
}
