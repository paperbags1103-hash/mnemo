import { useCallback, useEffect, useRef, useState } from "react";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Input } from "@/components/ui/input";
import { useNote, useUpdateNote } from "@/features/notes/hooks/useNotes";
import { useNotesStore } from "@/features/notes/store";

type NoteDraft = {
  title: string;
  content: string;
};

function normalizeContent(content: string) {
  return content.trim() ? content : "<p></p>";
}

export function NoteEditor() {
  const { selectedNoteId, savingState, setSavingState } = useNotesStore();
  const { data: note, isLoading } = useNote(selectedNoteId);
  const updateNote = useUpdateNote();
  const [title, setTitle] = useState("");
  const [draft, setDraft] = useState<NoteDraft | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Write something...",
      }),
    ],
    content: "<p></p>",
    editorProps: {
      attributes: {
        class:
          "h-full min-h-full px-8 py-6 text-[15px] leading-7 text-[#1a1a1a] outline-none",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      setDraft({
        title,
        content: currentEditor.getHTML(),
      });
      setSavingState("idle");
    },
  });

  const buildDraft = useCallback(() => {
    if (!note) {
      return null;
    }

    return {
      title,
      content: editor?.getHTML() ?? normalizeContent(note.content),
    };
  }, [title, editor, note]);

  const saveNote = useCallback(
    (nextDraft: NoteDraft | null) => {
      if (!note || !nextDraft) {
        return;
      }

      const normalizedServerContent = normalizeContent(note.content);
      if (
        nextDraft.title === note.title &&
        nextDraft.content === normalizedServerContent
      ) {
        setSavingState("saved");
        return;
      }

      setSavingState("saving");
      updateNote.mutate(
        {
          noteId: note.id,
          payload: {
            ...nextDraft,
            version: note.version,
          },
        },
        {
          onSuccess: (updatedNote) => {
            setTitle(updatedNote.title);
            setDraft({
              title: updatedNote.title,
              content: normalizeContent(updatedNote.content),
            });
            setSavingState("saved");
          },
          onError: () => {
            setSavingState("error");
          },
        },
      );
    },
    [note, updateNote, setSavingState],
  );

  const handleSave = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    const nextDraft = buildDraft();
    if (nextDraft) {
      setDraft(nextDraft);
    }
    saveNote(nextDraft);
  }, [buildDraft, saveNote]);

  useEffect(() => {
    if (!editor || !note) {
      if (editor && !note) {
        editor.commands.setContent("<p></p>", false);
      }
      setTitle("");
      setDraft(null);
      setSavingState("idle");
      return;
    }

    const nextContent = normalizeContent(note.content);
    setTitle(note.title);
    setDraft({
      title: note.title,
      content: nextContent,
    });
    editor.commands.setContent(nextContent, false);
    setSavingState("saved");
  }, [editor, note, setSavingState]);

  useEffect(() => {
    if (savingState !== "saved") {
      return;
    }

    const timer = window.setTimeout(() => {
      setSavingState("idle");
    }, 2000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [savingState, setSavingState]);

  useEffect(() => {
    if (!note || !draft) {
      return;
    }

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      saveNote(draft);
    }, 1000);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [draft, note, saveNote]);

  useEffect(() => {
    if (!note) {
      return;
    }

    const nextDraft = buildDraft();
    if (!nextDraft) {
      return;
    }

    setDraft((currentDraft) => {
      if (
        currentDraft?.title === nextDraft.title &&
        currentDraft.content === nextDraft.content
      ) {
        return currentDraft;
      }

      return nextDraft;
    });

    if (title !== note.title) {
      setSavingState("idle");
    }
  }, [title, editor, note, setSavingState, buildDraft]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        handleSave();
      }
    };

    const editorElement = editor.view.dom;
    editorElement.addEventListener("keydown", handleKeyDown);

    return () => {
      editorElement.removeEventListener("keydown", handleKeyDown);
    };
  }, [editor, handleSave]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#ffffff] text-sm text-[#9b9b9b]">
        Loading note...
      </div>
    );
  }

  if (!note) {
    return (
      <div className="flex h-full items-center justify-center bg-[#ffffff] text-sm text-[#9b9b9b]">
        Select or create a note
      </div>
    );
  }

  return (
    <section className="relative flex h-full flex-col overflow-hidden bg-[#ffffff]">
      <div className="flex items-start justify-between gap-4 border-b border-[#e9e9e7] px-8 py-5">
        <Input
          className="h-auto border-0 bg-transparent px-0 text-3xl font-semibold text-[#1a1a1a] shadow-none focus-visible:ring-0"
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Untitled"
          value={title}
        />
        <div className="flex min-w-28 items-center justify-end gap-2 pt-2 text-right text-xs text-[#9b9b9b]">
          {savingState === "saving" && (
            <span className="text-sm text-gray-400">Saving...</span>
          )}
          {savingState === "saved" && (
            <span className="text-sm text-green-500">Saved ✓</span>
          )}
          {savingState === "error" && (
            <>
              <span className="text-sm text-red-500">Save failed</span>
              <button
                className="rounded border border-red-200 px-2 py-1 text-xs text-red-500 transition-colors hover:border-red-300 hover:text-red-600"
                onClick={handleSave}
                type="button"
              >
                Retry
              </button>
            </>
          )}
          <button
            onClick={handleSave}
            className="rounded bg-gray-900 px-3 py-1 text-sm text-white transition-colors hover:bg-gray-700"
            type="button"
          >
            Save
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </section>
  );
}
