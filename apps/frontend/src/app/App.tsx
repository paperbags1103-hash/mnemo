import { useCallback, useEffect, useState } from "react";
import { FileText, Network, Plus } from "lucide-react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GraphView } from "@/features/graph/components/GraphView";
import { KnowledgePanel } from "@/features/graph/components/KnowledgePanel";
import { NoteEditor } from "@/features/notes/components/NoteEditor";
import { useCreateNote } from "@/features/notes/hooks/useNotes";
import { useNotesStore } from "@/features/notes/store";
import { FileTree } from "@/features/tree/components/FileTree";
import { cn } from "@/lib/utils";

function useDefaultKnowledgePanelOpen(noteId: string | null) {
  const [isOpen, setIsOpen] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1280 : true,
  );

  useEffect(() => {
    if (!noteId) {
      setIsOpen(false);
      return;
    }

    const syncWithViewport = () => {
      setIsOpen(window.innerWidth >= 1280);
    };

    syncWithViewport();
    window.addEventListener("resize", syncWithViewport);
    return () => window.removeEventListener("resize", syncWithViewport);
  }, [noteId]);

  return [isOpen, setIsOpen] as const;
}

function SidebarNav() {
  const location = useLocation();

  return (
    <aside className="flex h-full w-16 flex-col justify-between border-r border-[#e9e9e7] bg-[#f7f7f5] px-2 py-3">
      <div className="space-y-2">
        <div className="flex h-10 items-center justify-center rounded-xl border border-[#e9e9e7] bg-[#ffffff] text-[11px] font-semibold uppercase tracking-[0.24em] text-[#1a1a1a]">
          m
        </div>
        <NavLink
          className={({ isActive }) =>
            cn(
              "flex h-10 items-center justify-center rounded-xl border border-transparent text-[#9b9b9b] transition-colors hover:bg-[#efefed] hover:text-[#1a1a1a]",
              isActive && "border-[#e9e9e7] bg-[#ffffff] text-[#1a1a1a]",
            )
          }
          end
          title="Notes"
          to="/"
        >
          <FileText className="h-4 w-4" />
        </NavLink>
      </div>
      <NavLink
        className={({ isActive }) =>
          cn(
            "flex h-10 items-center justify-center rounded-xl border border-transparent text-[#9b9b9b] transition-colors hover:bg-[#efefed] hover:text-[#1a1a1a]",
            isActive && "border-[#e9e9e7] bg-[#ffffff] text-[#1a1a1a]",
          )
        }
        title={location.pathname === "/graph" ? "Graph view" : "Graph"}
        to="/graph"
      >
        <Network className="h-4 w-4" />
      </NavLink>
    </aside>
  );
}

function NotesScreen({ onCreateNote }: { onCreateNote: () => Promise<void> }) {
  const { selectedNoteId } = useNotesStore();
  const [isPanelOpen, setIsPanelOpen] = useDefaultKnowledgePanelOpen(selectedNoteId);

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-14 items-center justify-between border-b border-[#e9e9e7] bg-[#ffffff] px-6">
        <h1 className="text-lg font-bold tracking-[0.08em] text-[#1a1a1a]">mnemo</h1>
        <Button
          className="gap-2 border border-[#e9e9e7] bg-[#f0f0ee] text-[#1a1a1a] hover:bg-[#e9e9e7]"
          onClick={() => void onCreateNote()}
          type="button"
        >
          <Plus className="h-4 w-4" />
          New Note
        </Button>
      </header>
      <main className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-w-0 flex-1">
          <NoteEditor />
        </div>
        {selectedNoteId ? (
          <KnowledgePanel
            isCollapsed={!isPanelOpen}
            noteId={selectedNoteId}
            onToggle={() => setIsPanelOpen((current) => !current)}
          />
        ) : null}
      </main>
    </section>
  );
}

function GraphScreen() {
  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <GraphView />
    </section>
  );
}

export function App() {
  const { setSelectedNoteId, setSavingState } = useNotesStore();
  const createNote = useCreateNote();
  const location = useLocation();

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
      <SidebarNav />
      {location.pathname === "/" ? <FileTree /> : null}
      <Routes>
        <Route element={<NotesScreen onCreateNote={handleCreateNote} />} path="/" />
        <Route element={<GraphScreen />} path="/graph" />
      </Routes>
    </div>
  );
}
