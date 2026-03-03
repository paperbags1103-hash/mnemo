import { useEffect, useRef, useState } from "react";
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

function statusLabel(state: "idle" | "saving" | "saved" | "error") {
  if (state === "saving") {
    return "Saving...";
  }

  if (state === "saved") {
    return "Saved";
  }

  if (state === "error") {
    return "Save failed";
  }

  return "Unsaved changes";
}

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
    if (!note || !draft) {
      return;
    }

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      const normalizedServerContent = normalizeContent(note.content);
      if (draft.title === note.title && draft.content === normalizedServerContent) {
        setSavingState("saved");
        return;
      }

      setSavingState("saving");
      updateNote.mutate(
        {
          noteId: note.id,
          payload: {
            ...draft,
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
    }, 1000);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [draft, note, updateNote, setSavingState]);

  useEffect(() => {
    if (!note) {
      return;
    }

    const nextDraft = {
      title,
      content: editor?.getHTML() ?? normalizeContent(note.content),
    };

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
  }, [title, editor, note, setSavingState]);

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
        <div className="min-w-28 pt-2 text-right text-xs text-[#9b9b9b]">
          {statusLabel(savingState)}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </section>
  );
}
