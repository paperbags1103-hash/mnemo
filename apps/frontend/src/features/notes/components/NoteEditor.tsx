import { useCallback, useEffect, useRef, useState } from "react";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import { Plus, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import StarterKit from "@tiptap/starter-kit";
import { useAddCategory, useCategories, useNote, useRemoveCategory, useUpdateNote } from "@/features/notes/hooks/useNotes";
import { useNotesStore } from "@/features/notes/store";
import {
  DEFAULT_CATEGORIES,
  buildCategoryTag,
  getNoteCategory,
  getNoteSubcategory,
  type NoteCategory,
} from "@/features/notes/types";

const CAT_COLORS: Record<string, string> = {
  투자: "#2563eb", 기술: "#7c3aed", 문화: "#d97706",
  여행: "#059669", 일기: "#db2777", 기타: "#6b7280",
};

function normalizeContent(content: string) {
  return content.trim() ? content : "<p></p>";
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("ko", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function NoteEditor() {
  const { selectedNoteId, savingState, setSavingState } = useNotesStore();
  const { data: note, isLoading } = useNote(selectedNoteId);
  const updateNote = useUpdateNote();
  const queryClient = useQueryClient();
  const { data: categoriesData } = useCategories();
  const addCategory = useAddCategory();
  const removeCategory = useRemoveCategory();
  const categories = categoriesData?.categories ?? [...DEFAULT_CATEGORIES];
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<NoteCategory>("기타");
  const [subcategory, setSubcategory] = useState("");
  const [enriching, setEnriching] = useState(false);
  const [showCatManager, setShowCatManager] = useState(false);
  const [newCatInput, setNewCatInput] = useState("");
  const catManagerRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "내용을 입력하세요..." }),
    ],
    content: "<p></p>",
    editorProps: {
      attributes: {
        class: "min-h-[400px] outline-none text-[15px] leading-[1.8] text-[#1a1a1a] [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1.5 [&_p]:mb-3 [&_ul]:pl-5 [&_ul]:mb-3 [&_li]:mb-1 [&_strong]:font-semibold [&_blockquote]:border-l-3 [&_blockquote]:border-[#e0e0de] [&_blockquote]:pl-4 [&_blockquote]:text-[#5a5a58] [&_blockquote]:italic [&_blockquote]:my-3 [&_hr]:border-[#e9e9e7] [&_hr]:my-6",
      },
    },
    onUpdate: () => {
      setSavingState("idle");
    },
  });

  const buildDraft = useCallback(() => {
    if (!note) return null;
    // Rebuild tags: replace cat: tag with current category/subcategory, keep rest
    const prevTags = (note.tags ?? []).filter((t: string) => !t.startsWith("cat:"));
    const tags = [buildCategoryTag(category, subcategory), ...prevTags];
    return { title, content: editor?.getHTML() ?? normalizeContent(note.content), category, tags };
  }, [category, title, editor, note]);

  const saveNote = useCallback(
    (draft: { title: string; content: string; category: NoteCategory; tags?: string[] } | null) => {
      if (!note || !draft) return;
      const normalizedContent = normalizeContent(note.content);
      const currentCategory = getNoteCategory(note.tags);
      const currentSubcategory = getNoteSubcategory(note.tags) ?? "";
      if (draft.title === note.title && draft.content === normalizedContent && draft.category === currentCategory && subcategory === currentSubcategory) {
        setSavingState("saved");
        return;
      }
      setSavingState("saving");
      updateNote.mutate(
        { noteId: note.id, payload: { ...draft, version: note.version } },
        {
          onSuccess: (updated) => {
            setTitle(updated.title);
            setCategory(getNoteCategory(updated.tags));
            setSubcategory(getNoteSubcategory(updated.tags) ?? "");
            setSavingState("saved");
          },
          onError: () => setSavingState("error"),
        },
      );
    },
    [note, updateNote, setSavingState, subcategory],
  );

  const handleSave = useCallback(() => saveNote(buildDraft()), [buildDraft, saveNote]);

  const handleEnrich = useCallback(async () => {
    if (!note) return;
    saveNote(buildDraft()); // save first
    setEnriching(true);
    try {
      await api.post(`/api/v1/notes/${note.id}/request-enrich`);
      // Status is now "pending" — 치레 will process on next heartbeat
    } catch (e) {
      console.error("Enrich request failed", e);
    } finally {
      setEnriching(false);
    }
  }, [note, buildDraft, saveNote, queryClient]);

  // sync note → editor
  useEffect(() => {
    if (!editor || !note) {
      if (editor && !note) editor.commands.setContent("<p></p>", false);
      setTitle(""); setCategory("기타"); setSavingState("idle");
      return;
    }
    setTitle(note.title);
    setCategory(getNoteCategory(note.tags));
    setSubcategory(getNoteSubcategory(note.tags) ?? "");
    editor.commands.setContent(normalizeContent(note.content), false);
    setSavingState("saved");
  }, [editor, note, setSavingState]);

  // saved → idle after 2s
  useEffect(() => {
    if (savingState !== "saved") return;
    const t = window.setTimeout(() => setSavingState("idle"), 2000);
    return () => window.clearTimeout(t);
  }, [savingState, setSavingState]);

  // dirty tracking
  useEffect(() => {
    if (!note) return;
    const draft = buildDraft();
    if (!draft) return;
    const dirty = draft.title !== note.title || draft.content !== normalizeContent(note.content) || category !== getNoteCategory(note.tags);
    setSavingState(dirty ? "idle" : "saved");
  }, [title, category, editor, note, setSavingState, buildDraft]);

  // Cmd+S
  useEffect(() => {
    if (!editor) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    editor.view.dom.addEventListener("keydown", handler);
    return () => editor.view.dom.removeEventListener("keydown", handler);
  }, [editor, handleSave]);

  if (isLoading) {
    return <div className="flex h-full items-center justify-center bg-[#ffffff] text-sm text-[#9b9b9b]">Loading...</div>;
  }

  if (!note) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#ffffff]">
        <div className="text-4xl">📝</div>
        <p className="text-sm text-[#9b9b9b]">노트를 선택하거나 새로 만드세요</p>
        <p className="text-xs text-[#b0b0ae]">Cmd+N</p>
      </div>
    );
  }

  const saveStatusText =
    savingState === "saving" ? "저장 중..." :
    savingState === "saved" ? "저장됨" :
    savingState === "error" ? "저장 실패" :
    "";

  return (
    <section className="flex h-full flex-col overflow-hidden bg-[#ffffff]">
      {/* Document area */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[720px] px-16 pt-14 pb-20">
          {/* Category dot + selector + manage */}
          <div className="relative mb-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: CAT_COLORS[category] ?? "#6b7280" }} />
            <select
              value={category}
              onChange={e => { setCategory(e.target.value as NoteCategory); setSavingState("idle"); }}
              className="bg-transparent text-xs text-[#9b9b9b] outline-none cursor-pointer hover:text-[#1a1a1a] transition-colors"
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {/* Subcategory input */}
            <span className="text-[10px] text-[#d0d0ce]">/</span>
            <input
              type="text"
              value={subcategory}
              onChange={e => { setSubcategory(e.target.value); setSavingState("idle"); }}
              placeholder="세부분류 (선택)"
              className="bg-transparent text-xs text-[#9b9b9b] placeholder-[#d0d0ce] outline-none w-[80px] hover:text-[#1a1a1a] transition-colors"
            />
            <button
              onClick={() => setShowCatManager(v => !v)}
              className="ml-1 text-[#d0d0ce] hover:text-[#9b9b9b] transition-colors"
              title="카테고리 관리"
            >
              <Plus size={13} />
            </button>
            {/* Category manager popover */}
            {showCatManager && (
              <div ref={catManagerRef} className="absolute top-7 left-0 z-50 w-56 rounded-xl border border-[#e9e9e7] bg-white shadow-lg p-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#ababaa]">카테고리 관리</p>
                <ul className="mb-3 space-y-1">
                  {categories.map(c => (
                    <li key={c} className="flex items-center justify-between">
                      <span className="text-xs text-[#1a1a1a]">{c}</span>
                      {!DEFAULT_CATEGORIES.includes(c as never) && (
                        <button
                          onClick={() => { void removeCategory.mutateAsync(c); }}
                          className="text-[#ababaa] hover:text-red-400 transition-colors"
                        >
                          <X size={11} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={newCatInput}
                    onChange={e => setNewCatInput(e.target.value)}
                    placeholder="새 카테고리"
                    className="flex-1 rounded-md border border-[#e9e9e7] px-2 py-1 text-xs outline-none focus:border-[#1a1a1a]"
                    onKeyDown={e => {
                      if (e.key === "Enter" && newCatInput.trim()) {
                        void addCategory.mutateAsync(newCatInput.trim()).then(() => setNewCatInput(""));
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (newCatInput.trim()) void addCategory.mutateAsync(newCatInput.trim()).then(() => setNewCatInput(""));
                    }}
                    className="rounded-md bg-[#1a1a1a] px-2 py-1 text-[10px] text-white hover:bg-[#333]"
                  >
                    추가
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Title — document style */}
          <input
            type="text"
            value={title}
            onChange={e => { setTitle(e.target.value); setSavingState("idle"); }}
            placeholder="제목 없음"
            className="mb-3 w-full bg-transparent text-[36px] font-bold leading-tight tracking-[-0.02em] text-[#1a1a1a] outline-none placeholder:text-[#d0d0ce]"
          />

          {/* Meta row */}
          <div className="mb-8 flex items-center gap-2 text-[11px] text-[#ababaa]">
            {note.source && <span>{note.source}</span>}
            {note.source && <span>·</span>}
            <span>{formatDate(note.updated_at)}</span>
            {saveStatusText && (
              <>
                <span>·</span>
                <span className={savingState === "error" ? "text-red-400" : "text-[#ababaa]"}>{saveStatusText}</span>
              </>
            )}
            <div className="ml-auto flex items-center gap-2">
              {savingState === "error" && (
                <button onClick={handleSave} className="text-red-400 underline text-[10px]">재시도</button>
              )}
              <button
                onClick={() => void handleEnrich()}
                disabled={enriching}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors border",
                  enriching
                    ? "border-[#e0e0de] bg-[#f7f7f5] text-[#ababaa]"
                    : "border-[#e0e0de] bg-[#f7f7f5] text-[#6b6b69] hover:border-[#1a1a1a] hover:text-[#1a1a1a]"
                )}
                title="치레가 요약+분류+태그를 자동으로 채워줍니다 (5~10분)"
              >
                <Sparkles size={11} />
                {enriching ? "요청 중..." : "AI"}
              </button>
              <button
                onClick={handleSave}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  savingState === "saving"
                    ? "bg-[#f0f0ed] text-[#ababaa]"
                    : "bg-[#1a1a1a] text-white hover:bg-[#333]"
                )}
                disabled={savingState === "saving"}
              >
                {savingState === "saving" ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>

          <div className="border-t border-[#f0f0ed] mb-8" />

          {/* TipTap editor */}
          <EditorContent editor={editor} />
        </div>
      </div>
    </section>
  );
}
