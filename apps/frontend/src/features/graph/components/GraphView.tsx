/**
 * GraphView — Obsidian-quality knowledge graph
 * Opus spec: radial-gradient canvas, compact dots, hover labels,
 * barnesHut clustering, right filter panel, bidirectional sync with note editor.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Filter, LoaderCircle, Network, Search, X } from "lucide-react";
import { useKnowledgeGraph, type GraphNode } from "@/features/graph/hooks/useGraphData";
import { useCategories } from "@/features/notes/hooks/useNotes";
import { useNotesStore } from "@/features/notes/store";
import { cn } from "@/lib/utils";

// ── Types ───────────────────────────────────────────────
declare global {
  interface Window {
    vis?: {
      DataSet: new (items: unknown[]) => unknown;
      Network: new (
        container: HTMLElement,
        data: { nodes: unknown; edges: unknown },
        options: Record<string, unknown>,
      ) => VisNetworkInstance;
    };
  }
}
type VisNetworkInstance = {
  on: (event: string, callback: (params: { nodes: string[] }) => void) => void;
  off: (event: string, callback: (params: { nodes: string[] }) => void) => void;
  destroy: () => void;
  selectNodes: (ids: string[]) => void;
  focus: (nodeId: string, options?: Record<string, unknown>) => void;
  fit: (options?: Record<string, unknown>) => void;
};

// ── Category colours (same as editor) ──────────────────
const CAT_COLORS: Record<string, string> = {
  투자: "#2563eb", 기술: "#7c3aed", 문화: "#d97706",
  여행: "#059669", 일기: "#db2777", 기타: "#6b7280",
};
const EXTRA_COLORS = ["#0891b2","#16a34a","#dc2626","#9333ea","#ea580c","#0d9488"];
function catColor(cat: string, all: string[]) {
  if (CAT_COLORS[cat]) return CAT_COLORS[cat];
  return EXTRA_COLORS[all.indexOf(cat) % EXTRA_COLORS.length] ?? "#6b7280";
}
function hex2rgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

// ── vis-network loader ──────────────────────────────────
let visPromise: Promise<void> | null = null;
function loadVis() {
  if (window.vis) return Promise.resolve();
  if (visPromise) return visPromise;
  visPromise = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://unpkg.com/vis-network/standalone/umd/vis-network.min.js";
    s.async = true;
    s.onload = () => res();
    s.onerror = () => rej(new Error("Failed to load vis-network"));
    document.head.appendChild(s);
  });
  return visPromise;
}

// ── Node size formula ───────────────────────────────────
function nodeSize(connections: number) {
  return Math.min(8 + connections * 4, 32);
}

// ── Main component ──────────────────────────────────────
export function GraphView({ compact = false }: { compact?: boolean }) {
  const { data, isLoading, isError } = useKnowledgeGraph();
  const { data: categoriesData } = useCategories();
  const { selectedNoteId, setSelectedNoteId: setStoreNoteId } = useNotesStore();
  const allCats = categoriesData?.categories ?? Object.keys(CAT_COLORS);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [showFilter, setShowFilter] = useState(!compact);
  const [searchQuery, setSearchQuery] = useState("");
  const [hiddenCats, setHiddenCats] = useState<Set<string>>(new Set());
  const [orphansOnly, setOrphansOnly] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const networkRef = useRef<VisNetworkInstance | null>(null);

  // Connection count per node (for sizing)
  const connectionCount = useMemo(() => {
    const map: Record<string, number> = {};
    data?.edges.forEach(e => {
      map[e.source] = (map[e.source] ?? 0) + 1;
      map[e.target] = (map[e.target] ?? 0) + 1;
    });
    return map;
  }, [data]);

  // Filtered node ids
  const visibleNodeIds = useMemo(() => {
    if (!data) return new Set<string>();
    return new Set(
      data.nodes
        .filter(n => !hiddenCats.has(n.category))
        .filter(n => !orphansOnly || (connectionCount[n.id] ?? 0) === 0)
        .filter(n => !searchQuery || n.title.toLowerCase().includes(searchQuery.toLowerCase()))
        .map(n => n.id)
    );
  }, [data, hiddenCats, orphansOnly, searchQuery, connectionCount]);

  const selectedNode = useMemo(
    () => data?.nodes.find(n => n.id === selectedNodeId) ?? null,
    [data, selectedNodeId]
  );
  const relatedEdges = useMemo(
    () => data?.edges.filter(e => e.source === selectedNodeId || e.target === selectedNodeId) ?? [],
    [data, selectedNodeId]
  );

  // Build vis-network
  useEffect(() => {
    if (!data?.nodes.length || !containerRef.current) return;
    let disposed = false;
    let network: VisNetworkInstance | null = null;

    void loadVis().then(() => {
      if (disposed || !window.vis || !containerRef.current) return;

      const nodes = new window.vis.DataSet(
        data.nodes
          .filter(n => visibleNodeIds.has(n.id))
          .map(n => {
            const color = catColor(n.category, allCats);
            const conns = connectionCount[n.id] ?? 0;
            const isSelected = n.id === selectedNoteId;
            return {
              id: n.id,
              label: "",          // label hidden by default
              title: n.title,     // hover tooltip
              shape: "dot",
              size: nodeSize(conns),
              color: {
                background: isSelected ? "#ffffff" : color,
                border: isSelected ? color : hex2rgba(color, 0.6),
                highlight: { background: "#ffffff", border: color },
                hover: { background: hex2rgba(color, 0.15), border: color },
              },
              borderWidth: isSelected ? 2.5 : 1,
              borderWidthSelected: 3,
              font: { color: "#1a1a1a", face: "IBM Plex Sans", size: 11 },
              // shadow for selected node ring effect
              shadow: isSelected
                ? { enabled: true, color: hex2rgba(color, 0.3), size: 12, x: 0, y: 0 }
                : { enabled: false },
            };
          })
      );

      const edges = new window.vis.DataSet(
        data.edges
          .filter(e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target))
          .map(e => ({
            from: e.source,
            to: e.target,
            title: e.shared_tag,
            color: { color: "rgba(0,0,0,0.07)", highlight: "rgba(0,0,0,0.25)", hover: "rgba(0,0,0,0.2)" },
            width: 1,
            smooth: { type: "continuous", roundness: 0.3 },
            selectionWidth: 2,
          }))
      );

      network = new window.vis.Network(
        containerRef.current,
        { nodes, edges },
        {
          autoResize: true,
          interaction: { hover: true, tooltipDelay: 150 },
          nodes: { borderWidth: 1, chosen: true },
          edges: { width: 1 },
          physics: {
            enabled: true,
            stabilization: { iterations: 200, fit: true },
            barnesHut: {
              gravitationalConstant: -3000,
              centralGravity: 0.1,
              springLength: 160,
              springConstant: 0.04,
              damping: 0.09,
              avoidOverlap: 0.3,
            },
          },
        }
      );

      // Disable physics after stabilization for clean static layout
      network.on("stabilizationIterationsDone" as never, () => {
        // noop — vis handles this internally
      });

      network.on("click", (params: { nodes: string[] }) => {
        const nodeId = params.nodes[0] ?? null;
        setSelectedNodeId(nodeId);
        if (nodeId) setStoreNoteId(nodeId);
      });

      networkRef.current = network;
    }).catch((e: Error) => setNetworkError(e.message));

    return () => {
      disposed = true;
      network?.destroy();
      networkRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, visibleNodeIds]);

  // Auto-select first node
  useEffect(() => {
    if (!selectedNodeId && data?.nodes[0]) setSelectedNodeId(data.nodes[0].id);
  }, [data, selectedNodeId]);

  // Sync: note editor → graph focus
  useEffect(() => {
    if (!selectedNoteId || !networkRef.current) return;
    if (selectedNoteId === selectedNodeId) return;
    if (!data?.nodes.some(n => n.id === selectedNoteId)) return;
    setSelectedNodeId(selectedNoteId);
    networkRef.current.selectNodes([selectedNoteId]);
    networkRef.current.focus(selectedNoteId, {
      animation: { duration: 400, easingFunction: "easeInOutQuad" },
      scale: 1.4,
    });
  }, [selectedNoteId, selectedNodeId, data]);

  // ── Render ────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {!compact && (
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#e9e9e7] bg-[#fafafa] px-5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-[#1a1a1a]">Knowledge Graph</span>
            <span className="text-[10px] text-[#ababaa]">
              {data?.nodes.length ?? 0} nodes · {data?.edges.length ?? 0} edges
            </span>
          </div>
          <button
            onClick={() => setShowFilter(v => !v)}
            className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors",
              showFilter ? "bg-[#1a1a1a] text-white" : "text-[#9b9b9b] hover:text-[#1a1a1a]"
            )}
          >
            <Filter size={11} /> Filters
          </button>
        </header>
      )}

      <main className="flex min-h-0 flex-1 overflow-hidden">
        {/* Canvas */}
        <section className="relative min-w-0 flex-1 overflow-hidden">
          {isLoading && (
            <div className="flex h-full items-center justify-center gap-2 text-xs text-[#9b9b9b]">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> 그래프 로딩 중...
            </div>
          )}
          {isError && (
            <div className="flex h-full items-center justify-center text-xs text-[#9b9b9b]">
              그래프 데이터 로드 실패
            </div>
          )}
          {!isLoading && !isError && (!data || data.nodes.length === 0) && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-[#9b9b9b]">
              <Network className="h-5 w-5 opacity-40" />
              노트가 10개 이상 쌓이면 그래프가 나타납니다
            </div>
          )}
          {networkError && (
            <div className="flex h-full items-center justify-center text-xs text-red-400">{networkError}</div>
          )}
          {/* The vis-network canvas */}
          <div
            ref={containerRef}
            className="h-full w-full"
            style={{ background: "radial-gradient(ellipse at 50% 40%, #f9f9f7 0%, #f3f3f1 100%)" }}
          />
          {/* Selected node label overlay */}
          {selectedNode && (
            <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2">
              <div className="flex items-center gap-2 rounded-full border border-[#e9e9e7] bg-white/90 px-3 py-1.5 shadow-sm backdrop-blur-sm">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: catColor(selectedNode.category, allCats) }}
                />
                <span className="text-xs font-medium text-[#1a1a1a]">{selectedNode.title}</span>
                <span className="text-[10px] text-[#ababaa]">{selectedNode.category}</span>
              </div>
            </div>
          )}
        </section>

        {/* Right filter panel */}
        {showFilter && !compact && (
          <aside className="flex h-full w-[240px] shrink-0 flex-col border-l border-[#e9e9e7] bg-[#fafafa]">
            {/* Search */}
            <div className="p-3 border-b border-[#e9e9e7]">
              <div className="relative">
                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#ababaa]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="노드 검색..."
                  className="w-full rounded-lg bg-[#efefed] py-1.5 pl-7 pr-3 text-xs outline-none placeholder:text-[#ababaa]"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                    <X size={10} className="text-[#ababaa]" />
                  </button>
                )}
              </div>
            </div>

            {/* Category toggles */}
            <div className="flex-1 overflow-y-auto p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#ababaa]">Categories</p>
              <div className="space-y-1">
                {allCats.map(cat => {
                  const color = catColor(cat, allCats);
                  const hidden = hiddenCats.has(cat);
                  const count = data?.nodes.filter(n => n.category === cat).length ?? 0;
                  return (
                    <button
                      key={cat}
                      onClick={() => setHiddenCats(prev => {
                        const next = new Set(prev);
                        hidden ? next.delete(cat) : next.add(cat);
                        return next;
                      })}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                        hidden ? "opacity-35" : "hover:bg-[#efefed]"
                      )}
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                      <span className="flex-1 text-left text-[#1a1a1a]">{cat}</span>
                      <span className="text-[10px] text-[#ababaa]">{count}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 border-t border-[#e9e9e7] pt-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#ababaa]">Display</p>
                <button
                  onClick={() => setOrphansOnly(v => !v)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                    orphansOnly ? "bg-[#1a1a1a] text-white" : "hover:bg-[#efefed] text-[#1a1a1a]"
                  )}
                >
                  <span>고립 노드만</span>
                  <span className="text-[10px] opacity-60">
                    {data?.nodes.filter(n => (connectionCount[n.id] ?? 0) === 0).length ?? 0}개
                  </span>
                </button>
              </div>

              {/* Selected node info */}
              {selectedNode && (
                <div className="mt-4 border-t border-[#e9e9e7] pt-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#ababaa]">Selected</p>
                  <div className="rounded-xl border border-[#e9e9e7] bg-white p-3">
                    <p className="text-xs font-semibold text-[#1a1a1a] leading-snug">{selectedNode.title}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px]" style={{ color: catColor(selectedNode.category, allCats) }}>
                        {selectedNode.category}
                      </span>
                      <span className="text-[10px] text-[#ababaa]">
                        {relatedEdges.length}개 연결
                      </span>
                    </div>
                    {relatedEdges.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {relatedEdges.slice(0, 5).map((edge, i) => {
                          const otherId = edge.source === selectedNodeId ? edge.target : edge.source;
                          const other = data?.nodes.find(n => n.id === otherId);
                          return (
                            <button
                              key={i}
                              onClick={() => { setSelectedNodeId(otherId); setStoreNoteId(otherId); }}
                              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left hover:bg-[#f5f5f3]"
                            >
                              <span className="h-1 w-1 rounded-full" style={{ background: catColor(other?.category ?? "기타", allCats) }} />
                              <span className="truncate text-[10px] text-[#6b6b69]">{other?.title}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </main>
    </div>
  );
}
