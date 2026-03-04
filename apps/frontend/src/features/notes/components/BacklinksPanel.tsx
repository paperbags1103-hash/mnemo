import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useNotesStore } from "@/features/notes/store";
import { useKnowledgeGraph } from "@/features/graph/hooks/useGraphData";

// ── types ──────────────────────────────────────────────
type Backlink = {
  source_id: string;
  title: string;
  confidence: number;
  rationale: string | null;
  status: string;
};

type PendingLink = {
  source_id: string;
  target_id: string;
  source_title: string;
  target_title: string;
  confidence: number;
  rationale: string | null;
};

const CATEGORY_COLORS: Record<string, string> = {
  투자: "#2563eb",
  기술: "#7c3aed",
  문화: "#d97706",
  여행: "#059669",
  일기: "#db2777",
  기타: "#6b7280",
};

// ── vis-network loader ─────────────────────────────────
declare global {
  interface Window {
    vis?: {
      DataSet: new (items: unknown[]) => unknown;
      Network: new (
        container: HTMLElement,
        data: { nodes: unknown; edges: unknown },
        options: Record<string, unknown>,
      ) => { on: (e: string, cb: (p: { nodes: string[] }) => void) => void; destroy: () => void; selectNodes: (ids: string[]) => void; focus: (id: string, opts?: Record<string, unknown>) => void };
    };
  }
}

let visPromise: Promise<void> | null = null;
function loadVis() {
  if (window.vis) return Promise.resolve();
  if (visPromise) return visPromise;
  visPromise = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://unpkg.com/vis-network/standalone/umd/vis-network.min.js";
    s.onload = () => res();
    s.onerror = () => rej(new Error("vis load failed"));
    document.head.appendChild(s);
  });
  return visPromise;
}

// ── EgoGraph (always visible, Obsidian-style) ──────────
function EgoGraph({ noteId }: { noteId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { setSelectedNoteId } = useNotesStore();
  const { data, isLoading } = useKnowledgeGraph();

  useEffect(() => {
    if (!data || !containerRef.current) return;

    const connected = new Set<string>([noteId]);
    const egoEdges = data.edges.filter(
      (e) => e.source === noteId || e.target === noteId,
    );
    egoEdges.forEach((e) => { connected.add(e.source); connected.add(e.target); });
    const egoNodes = data.nodes.filter((n) => connected.has(n.id));

    let disposed = false;
    let network: { on: (e: string, cb: (p: { nodes: string[] }) => void) => void; destroy: () => void } | null = null;

    void loadVis().then(() => {
      if (disposed || !window.vis || !containerRef.current) return;

      const nodes = new window.vis.DataSet(
        egoNodes.map((n) => ({
          id: n.id,
          label: n.id === noteId
            ? (n.title.length > 14 ? n.title.slice(0, 13) + "…" : n.title)
            : (n.title.length > 12 ? n.title.slice(0, 11) + "…" : n.title),
          color: {
            background: n.id === noteId ? (CATEGORY_COLORS[n.category] ?? "#6b7280") : "#e9e9e7",
            border: n.id === noteId ? "#1a1a1a" : "#d0d0ce",
            highlight: { background: CATEGORY_COLORS[n.category] ?? "#6b7280", border: "#1a1a1a" },
          },
          font: { color: n.id === noteId ? "#ffffff" : "#3a3a38", size: 10, face: "system-ui", bold: n.id === noteId ? "true" : "" },
          shape: "dot",
          size: n.id === noteId ? 16 : 9,
          borderWidth: n.id === noteId ? 2 : 1,
        })),
      );
      const edges = new window.vis.DataSet(
        egoEdges.map((e) => ({
          from: e.source,
          to: e.target,
          title: e.shared_tag,
          color: { color: "#d0d0ce", highlight: "#9b9b9b" },
          smooth: { type: "dynamic" },
          width: 1,
        })),
      );

      network = new window.vis.Network(
        containerRef.current,
        { nodes, edges },
        {
          autoResize: true,
          interaction: { hover: true, zoomView: true, dragView: true },
          nodes: { borderWidth: 1 },
          edges: { width: 1 },
          physics: {
            stabilization: { iterations: 100 },
            barnesHut: { springLength: 70, springConstant: 0.05, damping: 0.3 },
          },
        },
      );
      network.on("click", (params) => {
        const clicked = params.nodes[0];
        if (clicked && clicked !== noteId) setSelectedNoteId(clicked);
      });
    });

    return () => { disposed = true; network?.destroy(); };
  }, [data, noteId, setSelectedNoteId]);

  if (isLoading) return (
    <div className="flex h-40 items-center justify-center bg-[#f5f5f3] rounded-lg">
      <Loader2 size={14} className="animate-spin text-[#9b9b9b]" />
    </div>
  );

  const hopCount = data?.edges.filter((e) => e.source === noteId || e.target === noteId).length ?? 0;

  return (
    <div className="mb-1">
      <div
        ref={containerRef}
        style={{ height: 200, borderRadius: 8, background: "#f7f7f5", border: "1px solid #e9e9e7" }}
      />
      <p className="mt-1 text-[9px] text-[#b0b0ad]">
        {hopCount}개 연결 · 클릭해서 이동
      </p>
    </div>
  );
}

// ── Section ────────────────────────────────────────────
function Section({
  title, count, children, defaultOpen = true,
}: { title: string; count: number; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-3">
      <button className="flex w-full items-center gap-1 py-1 text-left" onClick={() => setOpen((o) => !o)}>
        {open ? <ChevronDown size={11} className="text-[#b0b0ad]" /> : <ChevronRight size={11} className="text-[#b0b0ad]" />}
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#9b9b9b]">{title}</span>
        {count > 0 && (
          <span className="ml-1 rounded-full bg-[#eeeeed] px-1.5 py-0.5 text-[9px] text-[#7a7a78]">{count}</span>
        )}
      </button>
      {open && <div className="mt-0.5">{children}</div>}
    </div>
  );
}

// ── Related by tags (from graph data) ─────────────────
function RelatedByTags({ noteId }: { noteId: string }) {
  const { setSelectedNoteId } = useNotesStore();
  const { data } = useKnowledgeGraph();
  if (!data) return null;

  const connectedIds = new Set(
    data.edges
      .filter((e) => e.source === noteId || e.target === noteId)
      .flatMap((e) => [e.source, e.target])
      .filter((id) => id !== noteId),
  );
  const related = data.nodes.filter((n) => connectedIds.has(n.id)).slice(0, 6);

  return (
    <Section title="관련 노트" count={related.length} defaultOpen>
      {related.length === 0 ? (
        <p className="px-1 text-[10px] italic text-[#c0c0be]">공유 태그 없음</p>
      ) : (
        related.map((n) => (
          <button
            key={n.id}
            className="mb-0.5 flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs text-[#1a1a1a] hover:bg-[#f0f0ed]"
            onClick={() => setSelectedNoteId(n.id)}
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: CATEGORY_COLORS[n.category] ?? "#6b7280" }}
            />
            <span className="truncate">{n.title}</span>
          </button>
        ))
      )}
    </Section>
  );
}

// ── hooks ──────────────────────────────────────────────
function useBacklinks(noteId: string | null) {
  return useQuery({
    queryKey: ["backlinks", noteId],
    queryFn: () => api.get<Backlink[]>(`/api/v1/links/${noteId}/backlinks`),
    enabled: !!noteId,
  });
}

function usePendingLinks(noteId: string | null) {
  return useQuery({
    queryKey: ["pending-links", noteId],
    queryFn: () => api.get<PendingLink[]>(`/api/v1/links/pending`),
    enabled: !!noteId,
    select: (data) => data.filter((l) => l.target_id === noteId),
  });
}

// ── Main ───────────────────────────────────────────────
export function BacklinksPanel({ noteId }: { noteId: string | null }) {
  const { setSelectedNoteId } = useNotesStore();
  const queryClient = useQueryClient();

  const { data: backlinks = [], isLoading: blLoading } = useBacklinks(noteId);
  const { data: pending = [] } = usePendingLinks(noteId);

  const updateStatus = useMutation({
    mutationFn: ({ sourceId, targetId, status }: { sourceId: string; targetId: string; status: string }) =>
      api.patch(`/api/v1/links/${sourceId}/${targetId}`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pending-links", noteId] });
      void queryClient.invalidateQueries({ queryKey: ["backlinks", noteId] });
    },
  });

  if (!noteId) {
    return (
      <aside className="w-60 shrink-0 border-l border-[#e9e9e7] bg-[#fafafa] px-4 py-5">
        <p className="text-[10px] italic text-[#c0c0be]">노트를 선택하세요</p>
      </aside>
    );
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col overflow-y-auto border-l border-[#e9e9e7] bg-[#fafafa] px-4 py-4">
      {/* Graph — always visible, Obsidian style */}
      <EgoGraph noteId={noteId} />

      <div className="my-3 border-t border-[#e9e9e7]" />

      {/* Pending agent links */}
      {pending.length > 0 && (
        <Section title="승인 대기" count={pending.length}>
          {pending.map((link) => (
            <div key={`${link.source_id}-${link.target_id}`} className="mb-2 rounded-lg border border-[#e9e9e7] bg-white p-2.5">
              <button
                className="text-left text-xs font-medium text-[#1a1a1a] hover:text-[#4c6a91]"
                onClick={() => setSelectedNoteId(link.source_id)}
              >
                {link.source_title}
              </button>
              {link.rationale && (
                <p className="mt-1 text-[10px] leading-relaxed italic text-[#7a7a78]">"{link.rationale}"</p>
              )}
              <div className="mt-1 text-[9px] text-[#9b9b9b]">신뢰도 {Math.round((link.confidence ?? 1) * 100)}%</div>
              <div className="mt-2 flex gap-1.5">
                <button
                  className="flex-1 rounded bg-[#2563eb] py-1 text-[10px] font-semibold text-white hover:bg-[#1d4ed8]"
                  onClick={() => updateStatus.mutate({ sourceId: link.source_id, targetId: link.target_id, status: "confirmed" })}
                >✓</button>
                <button
                  className="flex-1 rounded bg-[#f0f0ed] py-1 text-[10px] font-semibold text-[#7a7a78] hover:bg-[#e5e5e2]"
                  onClick={() => updateStatus.mutate({ sourceId: link.source_id, targetId: link.target_id, status: "rejected" })}
                >✗</button>
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Backlinks */}
      <Section title="링크된 노트" count={backlinks.length}>
        {blLoading ? (
          <Loader2 size={11} className="animate-spin text-[#9b9b9b]" />
        ) : backlinks.length === 0 ? (
          <p className="px-1 text-[10px] italic text-[#c0c0be]">링크 없음</p>
        ) : (
          backlinks.map((bl) => (
            <button
              key={bl.source_id}
              className="mb-0.5 block w-full truncate rounded px-2 py-1 text-left text-xs text-[#1a1a1a] hover:bg-[#f0f0ed]"
              onClick={() => setSelectedNoteId(bl.source_id)}
            >
              {bl.title}
            </button>
          ))
        )}
      </Section>

      {/* Related via shared tags */}
      <RelatedByTags noteId={noteId} />
    </aside>
  );
}
