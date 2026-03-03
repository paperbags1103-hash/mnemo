import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { marked } from "marked";
import TurndownService from "turndown";
import { Input } from "@/components/ui/input";
import type { Note } from "@/features/notes/types";

const turndownService = new TurndownService();

type NoteEditorProps = {
  note?: Note;
  isLoading: boolean;
  isSaving: boolean;
  onChange: (payload: { title: string; content: string }) => void;
};

export function NoteEditor({ note, isLoading, isSaving, onChange }: NoteEditorProps) {
  const [title, setTitle] = useState(note?.title ?? "");
  const syncRef = useRef(false);

  const htmlContent = useMemo(() => {
    if (!note?.content) {
      return "<p></p>";
    }

    return marked.parse(note.content) as string;
  }, [note?.content]);

  const editor = useEditor({
    extensions: [StarterKit],
    content: htmlContent,
    editorProps: {
      attributes: {
        class: "rounded-xl border border-border bg-card px-6 py-5 text-base shadow-sm",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      if (syncRef.current) {
        return;
      }

      onChange({
        title,
        content: turndownService.turndown(currentEditor.getHTML()),
      });
    },
  });

  useEffect(() => {
    setTitle(note?.title ?? "");
    if (!editor) {
      return;
    }

    syncRef.current = true;
    editor.commands.setContent(htmlContent, false);
    queueMicrotask(() => {
      syncRef.current = false;
    });
  }, [editor, htmlContent, note?.id, note?.title]);

  useEffect(() => {
    if (!note) {
      return;
    }

    onChange({
      title,
      content: turndownService.turndown(editor?.getHTML() ?? htmlContent),
    });
  }, [title]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading note…</div>;
  }

  if (!note) {
    return <div className="rounded-xl border border-dashed border-border bg-card/60 p-6 text-sm text-muted-foreground">Select a note to start editing.</div>;
  }

  return (
    <section className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <Input
          className="h-12 text-lg font-semibold"
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Untitled"
          value={title}
        />
        <div className="min-w-28 text-right text-xs text-muted-foreground">
          {isSaving ? "Saving…" : `v${note.version}`}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </section>
  );
}
