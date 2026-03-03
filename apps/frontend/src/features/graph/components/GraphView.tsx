import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Network } from "lucide-react";
import { useKnowledgeGraph, type GraphNode } from "@/features/graph/hooks/useGraphData";

declare global {
  interface Window {
    vis?: {
      DataSet: new (items: unknown[]) => unknown;
      Network: new (
        container: HTMLElement,
        data: { nodes: unknown; edges: unknown },
        options: Record<string, unknown>,
      ) => {
        on: (event: string, callback: (params: { nodes: string[] }) => void) => void;
        destroy: () => void;
      };
    };
  }
}

type VisNetworkInstance = {
  on: (event: string, callback: (params: { nodes: string[] }) => void) => void;
  destroy: () => void;
};

const ENTITY_COLORS: Record<string, string> = {
  person: "#ef4444",
  project: "#3b82f6",
  tool: "#22c55e",
  concept: "#a855f7",
  org: "#f97316",
  default: "#9b9b9b",
};

let visNetworkPromise: Promise<void> | null = null;

function loadVisNetwork() {
  if (window.vis) {
    return Promise.resolve();
  }

  if (visNetworkPromise) {
    return visNetworkPromise;
  }

  visNetworkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://unpkg.com/vis-network/standalone/umd/vis-network.min.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load vis-network"));
    document.head.appendChild(script);
  });

  return visNetworkPromise;
}

export function GraphView() {
  const { data, isLoading, isError } = useKnowledgeGraph();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedNode = useMemo(
    () => data?.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [data?.nodes, selectedNodeId],
  );

  const relatedEdges = useMemo(() => {
    if (!data || !selectedNodeId) {
      return [];
    }

    return data.edges.filter((edge) => edge.from === selectedNodeId || edge.to === selectedNodeId);
  }, [data, selectedNodeId]);

  useEffect(() => {
    if (!data?.nodes.length || !containerRef.current) {
      return;
    }

    let disposed = false;
    let network: VisNetworkInstance | null = null;

    void loadVisNetwork()
      .then(() => {
        if (disposed || !window.vis || !containerRef.current) {
          return;
        }

        const nodes = new window.vis.DataSet(
          data.nodes.map((node) => ({
            ...node,
            color: {
              background: ENTITY_COLORS[node.entity_type] ?? ENTITY_COLORS.default,
              border: "#e9e9e7",
              highlight: {
                background: ENTITY_COLORS[node.entity_type] ?? ENTITY_COLORS.default,
                border: "#1a1a1a",
              },
            },
            font: {
              color: "#1a1a1a",
              face: "IBM Plex Sans",
            },
            shape: "dot",
            size: 16 + Math.min(node.fact_count * 2, 24),
          })),
        );
        const edges = new window.vis.DataSet(
          data.edges.map((edge) => ({
            ...edge,
            color: "#d6d6d3",
            font: {
              color: "#9b9b9b",
              face: "IBM Plex Sans",
              size: 10,
            },
            smooth: {
              type: "dynamic",
            },
          })),
        );

        network = new window.vis.Network(
          containerRef.current,
          { nodes, edges },
          {
            autoResize: true,
            interaction: {
              hover: true,
            },
            nodes: {
              borderWidth: 1,
            },
            edges: {
              length: 180,
              width: 1.2,
            },
            physics: {
              stabilization: true,
              barnesHut: {
                springLength: 130,
              },
            },
          },
        );
        network.on("click", (params: { nodes: string[] }) => {
          setSelectedNodeId(params.nodes[0] ?? null);
        });
      })
      .catch((error: Error) => {
        setNetworkError(error.message);
      });

    return () => {
      disposed = true;
      network?.destroy();
    };
  }, [data]);

  useEffect(() => {
    if (!selectedNodeId && data?.nodes[0]) {
      setSelectedNodeId(data.nodes[0].id);
    }
  }, [data, selectedNodeId]);

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b border-[#e9e9e7] bg-[#ffffff] px-6">
        <div>
          <h1 className="text-lg font-bold tracking-[0.08em] text-[#1a1a1a]">Knowledge Graph</h1>
          <p className="text-xs uppercase tracking-[0.18em] text-[#9b9b9b]">
            Lorien entities and relationships
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatChip label="Entities" value={data?.stats.entities ?? 0} />
          <StatChip label="Facts" value={data?.stats.facts ?? 0} />
          <StatChip label="Rules" value={data?.stats.rules ?? 0} />
        </div>
      </header>

      <main className="flex min-h-0 flex-1 bg-[#ffffff]">
        <section className="relative min-w-0 flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-[#9b9b9b]">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading graph...
            </div>
          ) : isError ? (
            <div className="flex h-full items-center justify-center text-sm text-[#9b9b9b]">
              Failed to load graph data.
            </div>
          ) : !data || data.nodes.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-[#9b9b9b]">
              <Network className="h-5 w-5" />
              No graph data available yet.
            </div>
          ) : networkError ? (
            <div className="flex h-full items-center justify-center text-sm text-[#9b9b9b]">
              {networkError}
            </div>
          ) : (
            <div className="h-full w-full bg-[radial-gradient(circle_at_top,#f7f7f5,transparent_30%)]" ref={containerRef} />
          )}
        </section>

        <aside className="flex h-full w-[320px] flex-col border-l border-[#e9e9e7] bg-[#f7f7f5]">
          <div className="border-b border-[#e9e9e7] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#9b9b9b]">Entity Details</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {selectedNode ? (
              <>
                <div className="rounded-2xl border border-[#e9e9e7] bg-[#ffffff] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-[#1a1a1a]">{selectedNode.name}</h2>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]"
                      style={{
                        backgroundColor: `${ENTITY_COLORS[selectedNode.entity_type] ?? ENTITY_COLORS.default}1A`,
                        color: ENTITY_COLORS[selectedNode.entity_type] ?? ENTITY_COLORS.default,
                      }}
                    >
                      {selectedNode.entity_type}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <DetailStat label="Facts" value={selectedNode.fact_count} />
                    <DetailStat label="Rules" value={selectedNode.rule_count} />
                  </div>
                </div>

                <section className="mt-6">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b9b9b]">
                    Relationships
                  </h3>
                  <div className="mt-3 space-y-2">
                    {relatedEdges.length === 0 ? (
                      <p className="text-sm text-[#9b9b9b]">No related edges for this node.</p>
                    ) : (
                      relatedEdges.map((edge, index) => {
                        const counterpartId = edge.from === selectedNode.id ? edge.to : edge.from;
                        const counterpart = data?.nodes.find((node) => node.id === counterpartId) as
                          | GraphNode
                          | undefined;

                        return (
                          <button
                            className="w-full rounded-xl border border-[#e9e9e7] bg-[#ffffff] px-3 py-3 text-left transition-colors hover:bg-[#f0f0ee]"
                            key={`${edge.from}-${edge.to}-${index}`}
                            onClick={() => setSelectedNodeId(counterpartId)}
                            type="button"
                          >
                            <p className="text-sm font-medium text-[#1a1a1a]">
                              {counterpart?.name ?? counterpartId}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[#9b9b9b]">
                              {edge.relation || "related_to"}
                            </p>
                          </button>
                        );
                      })
                    )}
                  </div>
                </section>
              </>
            ) : (
              <p className="text-sm text-[#9b9b9b]">Select a node to inspect its details.</p>
            )}
          </div>
        </aside>
      </main>
    </>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-full border border-[#e9e9e7] bg-[#f7f7f5] px-3 py-1 text-xs uppercase tracking-[0.16em] text-[#9b9b9b]">
      {label} {value}
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[#e9e9e7] bg-[#f7f7f5] px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.16em] text-[#9b9b9b]">{label}</p>
      <p className="mt-1 text-base font-semibold text-[#1a1a1a]">{value}</p>
    </div>
  );
}
