import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Link2, Network, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useNotesStore } from "@/features/notes/store";
import { useKnowledgeGraph } from "@/features/graph/hooks/useGraphData";

// ── types ──────────────────────────────────────────────
type Backlink = {
  source_id: string;
  title: string;
  link_type: string;
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

// ── EgoGraph ───────────────────────────────────────────
declare global {
  interface Window {
    vis?: {
      DataSet: new (items: unknown[]) => unknown;
      Network: new (
        container: HTMLElement,
        data: { nodes: unknown; edges: unknown },
        options: Record<string, unknown>,
      ) => { on: (e: string, cb: (p: { nodes: string[] }) => void) => void; destroy: () => void };
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

function EgoGraph({ noteId }: { noteId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { setSelectedNoteId } = useNotesStore();
  const { data, isLoading } = useKnowledgeGraph();

  useEffect(() => {
    if (!data || !containerRef.current) return;

    // build ego-network: current note + 1-hop neighbours
    const connected = new Set<string>();
    connected.add(noteId);
    const egoEdges = data.edges.filter(
      (e) => e.source === noteId || e.target === noteId,
    );
    egoEdges.forEach((e) => {
      connected.add(e.source);
      connected.add(e.target);
    });
    const egoNodes = data.nodes.filter((n) => connected.has(n.id));

    let disposed = false;
    let network: { on: (e: string, cb: (p: { nodes: string[] }) => void) => void; destroy: () => void } | null = null;

    void loadVis().then(() => {
      if (disposed || !window.vis || !containerRef.current) return;

      const nodes = new window.vis.DataSet(
        egoNodes.map((n) => ({
          id: n.id,
          label: n.id === noteId ? n.title : n.title.length > 16 ? n.title.slice(0, 15) + "…" : n.title,
          color: {
            background: n.id === noteId
              ? (CATEGORY_COLORS[n.category] ?? "#6b7280")
              : "#f0f0ed",
            border: n.id === noteId ? "#1a1a1a" : "#d6d6d3",
            highlight: { background: CATEGORY_COLORS[n.category] ?? "#6b7280", border: "#1a1a1a" },
          },
          font: { color: "#1a1a1a", size: n.id === noteId ? 13 : 11, face: "system-ui" },
          shape: "dot",
          size: n.id === noteId ? 18 : 10,
          borderWidth: n.id === noteId ? 2 : 1,
        })),
      );
      const edges = new window.vis.DataSet(
        egoEdges.map((e) => ({
          from: e.source,
          to: e.target,
          title: e.shared_tag,
          color: "#d6d6d3",
          smooth: { type: "dynamic" },
        })),
      );

      network = new window.vis.Network(
        containerRef.current,
        { nodes, edges },
        {
          autoResize: true,
          interaction: { hover: true, zoomView: false },
          nodes: { borderWidth: 1 },
          edges: { width: 1 },
          physics: { stabilization: true, barnesHut: { springLength: 80 } },
        },
      );
      network.on("click", (params) => {
        const clicked = params.nodes[0];
        if (clicked && clicked !== noteId) setSelectedNoteId(clicked);
      });
    });

    return () => {
      disposed = true;
      network?.destroy();
    };
  }, [data, noteId, setSelectedNoteId]);

  if (isLoading) return (
    <div className="flex h-40 items-center justify-center">
      <Loader2 size={16} className="animate-spin text-[#9b9b9b]" />
    </div>
  );
  if (!data) return null;

  const hopCount = data.edges.filter((e) => e.source === noteId || e.target === noteId).length;
  return (
    <div>
      <p className="mb-1 text-[10px] text-[#9b9b9b]">{hopCount}개 직접 연결</p>
      <div ref={containerRef} style={{ height: 220, borderRadius: 8, background: "#fafafa", border: "1px solid #e9e9e7" }} />
      <p className="mt-1.5 text-[9px] text-[#b0b0ad]">클릭하면 해당 노트로 이동</p>
    </div>
  );
}

// ── Section ────────────────────────────────────────────
function Section({
  title, count, children, defaultOpen = true,
}: { title: string; count: number; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-4">
      <button className="flex w-full items-center gap-1.5 py-1 text-left" onClick={() => setOpen((o) => !o)}>
        {open ? <ChevronDown size={12} className="text-[#9b9b9b]" /> : <ChevronRight size={12} className="text-[#9b9b9b]" />}
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9b9b9b]">{title}</span>
        <span className="ml-1 rounded-full bg-[#f0f0ed] px-1.5 py-0.5 text-[9px] text-[#7a7a78]">{count}</span>
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  );
}

// ── Main component ─────────────────────────────────────
export function BacklinksPanel({ noteId }: { noteId: string | null }) {
  const { setSelectedNoteId } = useNotesStore();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"links" | "graph">("links");

  const { data: backlinks = [], isLoading: blLoading } = useBacklinks(noteId);
  const { data: pending = [], isLoading: pendingLoading } = usePendingLinks(noteId);

  const updateStatus = useMutation({
    mutationFn: ({ sourceId, targetId, status }: { sourceId: string; targetId: string; status: string }) =>
      api.patch(`/api/v1/links/${sourceId}/${targetId}`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pending-links", noteId] });
      void queryClient.invalidateQueries({ queryKey: ["backlinks", noteId] });
    },
  });

  return (
    <aside className="flex w-64 shrink-0 flex-col border-l border-[#e9e9e7] bg-[#fafafa]">
      {/* Tab bar */}
      <div className="flex border-b border-[#e9e9e7]">
        <button
          className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-[11px] font-semibold transition-colors ${
            tab === "links" ? "border-b-2 border-[#1a1a1a] text-[#1a1a1a]" : "text-[#9b9b9b] hover:text-[#5a5a58]"
          }`}
          onClick={() => setTab("links")}
        >
          <Link2 size={11} />
          Links
        </button>
        <button
          className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-[11px] font-semibold transition-colors ${
            tab === "graph" ? "border-b-2 border-[#1a1a1a] text-[#1a1a1a]" : "text-[#9b9b9b] hover:text-[#5a5a58]"
          }`}
          onClick={() => setTab("graph")}
        >
          <Network size={11} />
          Graph
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {tab === "graph" ? (
          noteId ? (
            <EgoGraph noteId={noteId} />
          ) : (
            <p className="text-[10px] text-[#b0b0ad] italic">노트를 선택하면 그래프가 표시됩니다</p>
          )
        ) : (
          <>
            {/* Pending (agent proposed) */}
            {pending.length > 0 && (
              <Section title="승인 대기" count={pending.length}>
                {pendingLoading ? (
                  <Loader2 size={12} className="animate-spin text-[#9b9b9b]" />
                ) : (
                  pending.map((link) => (
                    <div key={`${link.source_id}-${link.target_id}`} className="mb-3 rounded-lg border border-[#e9e9e7] bg-white p-3">
                      <button
                        className="text-left text-xs font-medium text-[#1a1a1a] hover:text-[#4c6a91]"
                        onClick={() => setSelectedNoteId(link.source_id)}
                      >
                        {link.source_title}
                      </button>
                      {link.rationale && (
                        <p className="mt-1 text-[10px] leading-relaxed text-[#7a7a78] italic">"{link.rationale}"</p>
                      )}
                      <div className="mt-1 text-[9px] text-[#9b9b9b]">신뢰도 {Math.round((link.confidence ?? 1) * 100)}%</div>
                      <div className="mt-2 flex gap-2">
                        <button
                          className="flex-1 rounded bg-[#2563eb] py-1 text-[10px] font-semibold text-white hover:bg-[#1d4ed8]"
                          onClick={() => updateStatus.mutate({ sourceId: link.source_id, targetId: link.target_id, status: "confirmed" })}
                        >✓ 확인</button>
                        <button
                          className="flex-1 rounded bg-[#f0f0ed] py-1 text-[10px] font-semibold text-[#7a7a78] hover:bg-[#e5e5e2]"
                          onClick={() => updateStatus.mutate({ sourceId: link.source_id, targetId: link.target_id, status: "rejected" })}
                        >✗ 거부</button>
                      </div>
                    </div>
                  ))
                )}
              </Section>
            )}

            {/* Backlinks */}
            <Section title="이 노트를 참조한" count={backlinks.length}>
              {blLoading ? (
                <Loader2 size={12} className="animate-spin text-[#9b9b9b]" />
              ) : backlinks.length === 0 ? (
                <p className="text-[10px] text-[#b0b0ad] italic px-1">아직 링크 없음</p>
              ) : (
                backlinks.map((bl) => (
                  <button
                    key={bl.source_id}
                    className="mb-1 block w-full rounded-md px-2 py-1.5 text-left text-xs text-[#1a1a1a] hover:bg-[#f0f0ed]"
                    onClick={() => setSelectedNoteId(bl.source_id)}
                  >
                    {bl.title}
                  </button>
                ))
              )}
            </Section>

            {/* Related via tags — computed from graph data */}
            <RelatedByTags noteId={noteId} />
          </>
        )}
      </div>
    </aside>
  );
}

function RelatedByTags({ noteId }: { noteId: string | null }) {
  const { setSelectedNoteId } = useNotesStore();
  const { data } = useKnowledgeGraph();

  if (!data || !noteId) return null;

  const connectedIds = new Set(
    data.edges
      .filter((e) => e.source === noteId || e.target === noteId)
      .flatMap((e) => [e.source, e.target])
      .filter((id) => id !== noteId),
  );
  const related = data.nodes.filter((n) => connectedIds.has(n.id)).slice(0, 8);

  return (
    <Section title="관련 노트 (태그)" count={related.length} defaultOpen={false}>
      {related.length === 0 ? (
        <p className="text-[10px] text-[#b0b0ad] italic px-1">공유 태그 없음</p>
      ) : (
        related.map((n) => (
          <button
            key={n.id}
            className="mb-1 block w-full rounded-md px-2 py-1.5 text-left text-xs text-[#1a1a1a] hover:bg-[#f0f0ed]"
            onClick={() => setSelectedNoteId(n.id)}
          >
            <span className="font-medium">{n.title}</span>
            <span
              className="ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase"
              style={{ background: `${CATEGORY_COLORS[n.category] ?? "#6b7280"}20`, color: CATEGORY_COLORS[n.category] ?? "#6b7280" }}
            >
              {n.category}
            </span>
          </button>
        ))
      )}
    </Section>
  );
}
