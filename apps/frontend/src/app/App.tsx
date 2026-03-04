import { Component, type ErrorInfo, type ReactNode, useCallback, useEffect } from "react";
import { FileText, LayoutList, Network } from "lucide-react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { DigestPage } from "@/features/digest/DigestPage";
import { GraphView } from "@/features/graph/components/GraphView";
import { NoteEditor } from "@/features/notes/components/NoteEditor";
import { NotesSidebar } from "@/features/notes/components/NotesSidebar";
import { UnifiedPanel } from "@/features/panel/UnifiedPanel";
import { useCreateNote } from "@/features/notes/hooks/useNotes";
import { useNotesStore } from "@/features/notes/store";
import { cn } from "@/lib/utils";

// ── Icon nav ───────────────────────────────────────────
function SidebarNav() {
  return (
    <aside className="flex h-full w-14 shrink-0 flex-col items-center justify-between border-r border-[#e9e9e7] bg-[#f7f7f5] py-4">
      <div className="flex flex-col items-center gap-1">
        {/* Logo */}
        <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-[#1a1a1a] text-[11px] font-bold text-white tracking-wider">
          m
        </div>
        <NavLink to="/" end title="Notes"
          className={({ isActive }) => cn(
            "flex h-9 w-9 items-center justify-center rounded-lg text-[#9b9b9b] transition-colors hover:bg-[#ebebea] hover:text-[#1a1a1a]",
            isActive && "bg-[#ebebea] text-[#1a1a1a]"
          )}>
          <FileText size={16} />
        </NavLink>
        <NavLink to="/digest" title="Digest"
          className={({ isActive }) => cn(
            "flex h-9 w-9 items-center justify-center rounded-lg text-[#9b9b9b] transition-colors hover:bg-[#ebebea] hover:text-[#1a1a1a]",
            isActive && "bg-[#ebebea] text-[#1a1a1a]"
          )}>
          <LayoutList size={16} />
        </NavLink>
        <NavLink to="/graph" title="Full graph"
          className={({ isActive }) => cn(
            "flex h-9 w-9 items-center justify-center rounded-lg text-[#9b9b9b] transition-colors hover:bg-[#ebebea] hover:text-[#1a1a1a]",
            isActive && "bg-[#ebebea] text-[#1a1a1a]"
          )}>
          <Network size={16} />
        </NavLink>
      </div>
    </aside>
  );
}

// ── Notes screen ───────────────────────────────────────
function NotesScreen({ onCreateNote }: { onCreateNote: () => Promise<void> }) {
  const { selectedNoteId } = useNotesStore();
  return (
    <div className="flex min-w-0 flex-1 overflow-hidden">
      <NotesSidebar onCreateNote={() => void onCreateNote()} />
      <div className="min-w-0 flex-1 overflow-hidden">
        <NoteEditor />
      </div>
      <UnifiedPanel noteId={selectedNoteId} />
    </div>
  );
}

// ── Error boundary ─────────────────────────────────────
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error(error, info); }
  render() {
    if (this.state.hasError) return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="font-medium text-[#1a1a1a]">오류가 발생했습니다</p>
          <button className="mt-2 text-sm underline text-[#9b9b9b]" onClick={() => this.setState({ hasError: false })}>
            다시 시도
          </button>
        </div>
      </div>
    );
    return this.props.children;
  }
}

// ── App ────────────────────────────────────────────────
export function App() {
  const { setSelectedNoteId, setSavingState } = useNotesStore();
  const createNote = useCreateNote();

  const handleCreateNote = useCallback(async () => {
    const created = await createNote.mutateAsync({ title: "제목 없음", content: "<p></p>", category: "기타" });
    setSelectedNoteId(created.id);
    setSavingState("saved");
  }, [createNote, setSelectedNoteId, setSavingState]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        void handleCreateNote();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleCreateNote]);

  return (
    <ErrorBoundary>
      <div className="flex h-screen overflow-hidden bg-[#ffffff] text-[#1a1a1a]">
        <SidebarNav />
        <Routes>
          <Route path="/" element={<NotesScreen onCreateNote={handleCreateNote} />} />
          <Route path="/digest" element={<DigestPage />} />
          <Route path="/graph" element={<div className="flex min-w-0 flex-1 flex-col"><GraphView /></div>} />
        </Routes>
      </div>
    </ErrorBoundary>
  );
}
