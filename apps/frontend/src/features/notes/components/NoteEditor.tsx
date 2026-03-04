import { useCallback, useEffect, useMemo, useState } from "react";
import Placeholder from "@tiptap/extension-placeholder";
import { useQuery } from "@tanstack/react-query";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Input } from "@/components/ui/input";
import { useNote, useNoteLinks, useUpdateNote } from "@/features/notes/hooks/useNotes";
import { useNotesStore } from "@/features/notes/store";
import {
  NOTE_CATEGORIES,
  getNoteCategory,
  type Note,
  type NoteCategory,
} from "@/features/notes/types";
import { api } from "@/lib/api";

function normalizeContent(content: string) {
  return content.trim() ? content : "<p></p>";
}

function linkLabel(kind: "backlink" | "outlink", title: string) {
  return kind === "backlink" ? `\u2190 From: ${title}` : `\u2192 To: ${title}`;
}

export function NoteEditor() {
  const { selectedNoteId, savingState, setSavingState, setSelectedNoteId } = useNotesStore();
  const { data: note, isLoading } = useNote(selectedNoteId);
  const { data: links } = useNoteLinks(selectedNoteId);
  const updateNote = useUpdateNote();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<NoteCategory>("기타");

  const linkedNoteIds = useMemo(() => {
    if (!links) {
      return [];
    }

    return Array.from(
      new Set([
        ...links.backlinks.map((entry) => entry.note_id),
        ...links.outlinks.map((entry) => entry.note_id),
      ]),
    );
  }, [links]);

  const { data: linkedNotes = {} } = useQuery<Record<string, Note>>({
    queryKey: ["notes", selectedNoteId, "linked-note-titles", linkedNoteIds],
    enabled: linkedNoteIds.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        linkedNoteIds.map(async (noteId) => {
          const linkedNote = await api.get<Note>(`/api/v1/notes/${noteId}`);
          return [noteId, linkedNote] as const;
        }),
      );

      return Object.fromEntries(entries);
    },
  });

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
    onUpdate: () => {
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
      category,
    };
  }, [category, title, editor, note]);

  const saveNote = useCallback(
    (nextDraft: { title: string; content: string; category: NoteCategory } | null) => {
      if (!note || !nextDraft) {
        return;
      }

      const normalizedServerContent = normalizeContent(note.content);
      const currentCategory = getNoteCategory(note.tags);
      if (
        nextDraft.title === note.title &&
        nextDraft.content === normalizedServerContent &&
        nextDraft.category === currentCategory
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
            setCategory(getNoteCategory(updatedNote.tags));
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
    const nextDraft = buildDraft();
    saveNote(nextDraft);
  }, [buildDraft, saveNote]);

  useEffect(() => {
    if (!editor || !note) {
      if (editor && !note) {
        editor.commands.setContent("<p></p>", false);
      }
      setTitle("");
      setCategory("기타");
      setSavingState("idle");
      return;
    }

    const nextContent = normalizeContent(note.content);
    setTitle(note.title);
    setCategory(getNoteCategory(note.tags));
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
    if (!note) {
      return;
    }

    const nextDraft = buildDraft();
    if (!nextDraft) {
      return;
    }

    const hasChanges =
      nextDraft.title !== note.title ||
      nextDraft.content !== normalizeContent(note.content) ||
      category !== getNoteCategory(note.tags);

    setSavingState(hasChanges ? "idle" : "saved");
  }, [title, category, editor, note, setSavingState, buildDraft]);

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

  const backlinks = links?.backlinks ?? [];
  const outlinks = links?.outlinks ?? [];
  const hasLinks = backlinks.length > 0 || outlinks.length > 0;

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
          <select
            className="h-9 rounded border border-[#e3e3e1] bg-[#ffffff] px-3 text-sm text-[#1a1a1a] outline-none transition-colors focus:border-[#d7d7d3]"
            onChange={(event) => setCategory(event.target.value as NoteCategory)}
            value={category}
          >
            {NOTE_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
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
        {hasLinks ? (
          <section className="mx-8 mb-8 border-t border-[#e9e9e7] pt-5">
            <div className="flex items-center gap-2 text-sm font-medium text-[#1a1a1a]">
              <span>Links</span>
              <span className="text-xs font-normal text-[#9b9b9b]">
                ({backlinks.length} backlinks, {outlinks.length} outlinks)
              </span>
            </div>
            <div className="mt-3 space-y-1">
              {backlinks.map((entry) => (
                <button
                  key={`backlink-${entry.note_id}`}
                  className="block text-sm text-[#5f6f86] transition-colors hover:text-[#1a1a1a]"
                  onClick={() => setSelectedNoteId(entry.note_id)}
                  type="button"
                >
                  {linkLabel("backlink", linkedNotes[entry.note_id]?.title || "Untitled")}
                </button>
              ))}
              {outlinks.map((entry) => (
                <button
                  key={`outlink-${entry.note_id}`}
                  className="block text-sm text-[#5f6f86] transition-colors hover:text-[#1a1a1a]"
                  onClick={() => setSelectedNoteId(entry.note_id)}
                  type="button"
                >
                  {linkLabel("outlink", linkedNotes[entry.note_id]?.title || "Untitled")}
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}
