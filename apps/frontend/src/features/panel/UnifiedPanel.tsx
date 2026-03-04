import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Loader2, PanelRightClose } from "lucide-react";
import { api } from "@/lib/api";
import { useNotesStore } from "@/features/notes/store";
import { useNotesList } from "@/features/notes/hooks/useNotes";
import {
  useKnowledgeGraph,
  useNoteEntities,
  useIngestStatus,
} from "@/features/graph/hooks/useGraphData";

// ── types ──────────────────────────────────────────────
type Backlink = { source_id: string; title: string; confidence: number; rationale: string | null; status: string };
type PendingLink = { source_id: string; target_id: string; source_title: string; target_title: string; confidence: number; rationale: string | null };

const CAT_COLORS: Record<string, string> = {
  투자: "#2563eb", 기술: "#7c3aed", 문화: "#d97706",
  여행: "#059669", 일기: "#db2777", 기타: "#6b7280",
};
const ENTITY_COLORS: Record<string, string> = {
  person: "#ef4444", project: "#3b82f6", tool: "#22c55e",
  concept: "#a855f7", org: "#f97316",
};

// ── vis-network loader ─────────────────────────────────
let visP: Promise<void> | null = null;
function loadVis() {
  if (window.vis) return Promise.resolve();
  if (visP) return visP;
  visP = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://unpkg.com/vis-network/standalone/umd/vis-network.min.js";
    s.onload = () => res(); s.onerror = () => rej(new Error("vis load failed"));
    document.head.appendChild(s);
  });
  return visP;
}

// ── EgoGraph ───────────────────────────────────────────
function EgoGraph({ noteId }: { noteId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { setSelectedNoteId } = useNotesStore();
  const { data } = useKnowledgeGraph();

  useEffect(() => {
    if (!data || !ref.current) return;
    const connected = new Set([noteId]);
    const egoEdges = data.edges.filter(e => e.source === noteId || e.target === noteId);
    egoEdges.forEach(e => { connected.add(e.source); connected.add(e.target); });
    const egoNodes = data.nodes.filter(n => connected.has(n.id));

    let disposed = false;
    let net: { on: (e: string, cb: (p: { nodes: string[] }) => void) => void; destroy: () => void } | null = null;

    void loadVis().then(() => {
      if (disposed || !window.vis || !ref.current) return;
      const nodes = new window.vis.DataSet(egoNodes.map(n => ({
        id: n.id,
        label: n.id === noteId
          ? (n.title.length > 14 ? n.title.slice(0, 13) + "…" : n.title)
          : (n.title.length > 12 ? n.title.slice(0, 11) + "…" : n.title),
        color: {
          background: n.id === noteId ? (CAT_COLORS[n.category] ?? "#6b7280") : "#efefed",
          border: n.id === noteId ? "transparent" : "#dededb",
          highlight: { background: CAT_COLORS[n.category] ?? "#6b7280", border: "transparent" },
        },
        font: { color: n.id === noteId ? "#fff" : "#3a3a38", size: 10, face: "IBM Plex Sans" },
        shape: "dot",
        size: n.id === noteId ? 16 : 8,
        borderWidth: 0,
      })));
      const edges = new window.vis.DataSet(egoEdges.map(e => ({
        from: e.source, to: e.target, title: e.shared_tag,
        color: { color: "#dededb", highlight: "#ababaa" }, smooth: { type: "dynamic" }, width: 1,
      })));
      net = new window.vis.Network(ref.current, { nodes, edges }, {
        autoResize: true,
        interaction: { hover: true, zoomView: true, dragView: true },
        physics: { stabilization: { iterations: 80 }, barnesHut: { springLength: 65, springConstant: 0.04, damping: 0.4 } },
      });
      net.on("click", p => { const id = p.nodes[0]; if (id && id !== noteId) setSelectedNoteId(id); });
    });
    return () => { disposed = true; net?.destroy(); };
  }, [data, noteId, setSelectedNoteId]);

  const hops = data?.edges.filter(e => e.source === noteId || e.target === noteId).length ?? 0;
  return (
    <div className="px-3 pt-3 pb-2">
      <div ref={ref} style={{ height: 190, borderRadius: 10, background: "#f7f7f5", border: "1px solid #ebebea" }} />
      <p className="mt-1.5 text-[9px] text-[#ababaa]">{hops}개 연결 · 노드 클릭 시 이동</p>
    </div>
  );
}

// ── Section ────────────────────────────────────────────
function Section({ title, count, children, open: defaultOpen = true }: {
  title: string; count: number; children: React.ReactNode; open?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-1.5 px-4 py-2 text-left hover:bg-[#f0f0ed]"
      >
        {open ? <ChevronDown size={10} className="text-[#ababaa]" /> : <ChevronRight size={10} className="text-[#ababaa]" />}
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#ababaa]">{title}</span>
        {count > 0 && <span className="ml-auto rounded-full bg-[#ebebea] px-1.5 py-0.5 text-[9px] text-[#7a7a78]">{count}</span>}
      </button>
      {open && <div className="pb-1">{children}</div>}
    </div>
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
    select: d => d.filter(l => l.target_id === noteId),
  });
}

// ── Main ───────────────────────────────────────────────
// ── Activity heatmap (last 7 weeks) ────────────────────
function ActivityHeatmap() {
  const { data: notes = [] } = useNotesList();
  const cells = useMemo(() => {
    const today = new Date();
    const days: { date: string; count: number }[] = [];
    for (let i = 48; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key, count: 0 });
    }
    notes.forEach(n => {
      const key = n.created_at?.slice(0, 10);
      const cell = days.find(d => d.date === key);
      if (cell) cell.count++;
    });
    return days;
  }, [notes]);

  const maxCount = Math.max(1, ...cells.map(c => c.count));
  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div className="px-4 py-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#ababaa]">활동</p>
      <div className="flex gap-[3px]">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((cell, di) => {
              const opacity = cell.count === 0 ? 0.08 : 0.2 + (cell.count / maxCount) * 0.8;
              return (
                <div
                  key={di}
                  title={`${cell.date}: ${cell.count}개`}
                  className="h-[9px] w-[9px] rounded-[2px]"
                  style={{ background: `rgba(37,99,235,${opacity})` }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[9px] text-[#ababaa]">최근 7주 노트 생성</p>
    </div>
  );
}

export function UnifiedPanel({ noteId, onHide }: { noteId: string | null; onHide?: () => void }) {
  const { setSelectedNoteId } = useNotesStore();
  const queryClient = useQueryClient();

  const { data: backlinks = [] } = useBacklinks(noteId);
  const { data: pending = [] } = usePendingLinks(noteId);
  const { data: graphData } = useKnowledgeGraph();
  const { data: entities = [] } = useNoteEntities(noteId);
  const { data: ingestJob } = useIngestStatus(noteId);

  const updateStatus = useMutation({
    mutationFn: ({ sourceId, targetId, status }: { sourceId: string; targetId: string; status: string }) =>
      api.patch(`/api/v1/links/${sourceId}/${targetId}`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pending-links", noteId] });
      void queryClient.invalidateQueries({ queryKey: ["backlinks", noteId] });
    },
  });

  // related by tags from graph
  const related = (() => {
    if (!graphData || !noteId) return [];
    const ids = new Set(
      graphData.edges
        .filter(e => e.source === noteId || e.target === noteId)
        .flatMap(e => [e.source, e.target])
        .filter(id => id !== noteId)
    );
    return graphData.nodes.filter(n => ids.has(n.id)).slice(0, 6);
  })();

  return (
    <aside className="flex w-full h-full shrink-0 flex-col overflow-y-auto border-l border-[#ebebea] bg-[#f9f9f7]">
      {/* Header with hide button */}
      <div className="flex items-center justify-between border-b border-[#ebebea] px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#ababaa]">Panel</span>
        {onHide && (
          <button onClick={onHide} title="패널 숨기기" className="text-[#ababaa] hover:text-[#1a1a1a] transition-colors">
            <PanelRightClose size={13} />
          </button>
        )}
      </div>
      {/* Ego graph */}
      {noteId ? (
        <EgoGraph noteId={noteId} />
      ) : (
        <div className="flex h-[200px] items-center justify-center px-4">
          <p className="text-center text-xs text-[#c0c0be] italic">노트를 선택하면<br />그래프가 나타납니다</p>
        </div>
      )}

      <div className="border-t border-[#ebebea]" />

      {/* Pending agent links */}
      {pending.length > 0 && (
        <Section title="승인 대기" count={pending.length} open>
          {pending.map(link => (
            <div key={`${link.source_id}-${link.target_id}`} className="mx-3 mb-2 rounded-lg border border-[#e3e3e0] bg-white p-2.5">
              <button className="text-left text-xs font-medium text-[#1a1a1a] hover:text-[#4c6a91]" onClick={() => setSelectedNoteId(link.source_id)}>
                {link.source_title}
              </button>
              {link.rationale && <p className="mt-1 text-[10px] italic leading-relaxed text-[#7a7a78]">"{link.rationale}"</p>}
              <p className="mt-0.5 text-[9px] text-[#ababaa]">신뢰도 {Math.round((link.confidence ?? 1) * 100)}%</p>
              <div className="mt-1.5 flex gap-1.5">
                <button className="flex-1 rounded-md bg-[#1a1a1a] py-1 text-[10px] font-medium text-white hover:bg-[#333]"
                  onClick={() => updateStatus.mutate({ sourceId: link.source_id, targetId: link.target_id, status: "confirmed" })}>✓ 확인</button>
                <button className="flex-1 rounded-md bg-[#ebebea] py-1 text-[10px] font-medium text-[#7a7a78] hover:bg-[#e3e3e0]"
                  onClick={() => updateStatus.mutate({ sourceId: link.source_id, targetId: link.target_id, status: "rejected" })}>✗ 거부</button>
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Backlinks */}
      <Section title="링크된 노트" count={backlinks.length} open>
        {backlinks.length === 0 ? (
          <p className="px-4 pb-2 text-[10px] italic text-[#c0c0be]">링크 없음</p>
        ) : (
          backlinks.map(bl => (
            <button key={bl.source_id} onClick={() => setSelectedNoteId(bl.source_id)}
              className="flex w-full items-center gap-2 px-4 py-1.5 text-left text-xs text-[#2a2a28] hover:bg-[#f0f0ed]">
              <span className="truncate">{bl.title}</span>
            </button>
          ))
        )}
      </Section>

      {/* Related by tags */}
      <Section title="관련 노트" count={related.length} open={related.length > 0}>
        {related.length === 0 ? (
          <p className="px-4 pb-2 text-[10px] italic text-[#c0c0be]">공유 태그 없음</p>
        ) : (
          related.map(n => (
            <button key={n.id} onClick={() => setSelectedNoteId(n.id)}
              className="flex w-full items-center gap-2 px-4 py-1.5 text-left hover:bg-[#f0f0ed]">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: CAT_COLORS[n.category] ?? "#6b7280" }} />
              <span className="truncate text-xs text-[#2a2a28]">{n.title}</span>
            </button>
          ))
        )}
      </Section>

      {/* Entities from lorien */}
      {entities.length > 0 && (
        <Section title="Entities" count={entities.length} open={false}>
          {entities.map(e => (
            <div key={e.id} className="flex items-center gap-2 px-4 py-1.5">
              <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white"
                style={{ background: ENTITY_COLORS[e.entity_type] ?? "#6b7280" }}>{e.entity_type}</span>
              <span className="truncate text-xs text-[#2a2a28]">{e.name}</span>
            </div>
          ))}
        </Section>
      )}

      {/* Activity heatmap */}
      <div className="border-t border-[#ebebea]">
        <ActivityHeatmap />
      </div>

      {/* Ingest footer */}
      {ingestJob && (
        <div className="border-t border-[#ebebea] px-4 py-2.5">
          <p className="text-[9px] text-[#ababaa]">
            ⚙ ingest: {ingestJob.status}
            {ingestJob.updated_at && ` · ${new Date(ingestJob.updated_at).toLocaleTimeString("ko", { hour: "2-digit", minute: "2-digit" })}`}
          </p>
        </div>
      )}
    </aside>
  );
}
