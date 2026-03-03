import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import {
  useIngestStatus,
  useNoteEntities,
  useNoteFacts,
} from "@/features/graph/hooks/useGraphData";
import { cn } from "@/lib/utils";

type KnowledgePanelProps = {
  noteId: string;
  isCollapsed: boolean;
  onToggle: () => void;
};

const ENTITY_COLORS: Record<string, string> = {
  person: "#ef4444",
  project: "#3b82f6",
  tool: "#22c55e",
  concept: "#a855f7",
  org: "#f97316",
};

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

export function KnowledgePanel({ noteId, isCollapsed, onToggle }: KnowledgePanelProps) {
  const entitiesQuery = useNoteEntities(noteId);
  const factsQuery = useNoteFacts(noteId);
  const ingestQuery = useIngestStatus(noteId);
  const isLoading = entitiesQuery.isLoading || factsQuery.isLoading || ingestQuery.isLoading;
  const entities = entitiesQuery.data ?? [];
  const facts = factsQuery.data ?? [];
  const ingestJob = ingestQuery.data;
  const isEmpty = entities.length === 0 && facts.length === 0;

  return (
    <aside
      className={cn(
        "relative h-full border-l border-[#e9e9e7] bg-[#f7f7f5] transition-[width] duration-200",
        isCollapsed ? "w-0 border-l-0" : "w-[280px]",
      )}
    >
      <button
        aria-label={isCollapsed ? "Expand knowledge panel" : "Collapse knowledge panel"}
        className="absolute left-0 top-1/2 z-10 flex h-10 w-8 -translate-x-full -translate-y-1/2 items-center justify-center rounded-l-lg border border-r-0 border-[#e9e9e7] bg-[#f7f7f5] text-[#9b9b9b] transition-colors hover:text-[#1a1a1a]"
        onClick={onToggle}
        type="button"
      >
        {isCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      {!isCollapsed ? (
        <div className="flex h-full flex-col overflow-hidden">
          <div className="border-b border-[#e9e9e7] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#9b9b9b]">
              Knowledge Context
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-[#9b9b9b]">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Loading knowledge...
              </div>
            ) : isEmpty ? (
              <p className="rounded-xl border border-dashed border-[#e9e9e7] bg-[#ffffff] px-3 py-4 text-sm text-[#9b9b9b]">
                No knowledge extracted yet. Save the note to trigger extraction.
              </p>
            ) : null}

            <section className="mt-4 space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b9b9b]">
                Entities
              </h2>
              {entities.length === 0 ? (
                <p className="text-sm text-[#9b9b9b]">No entities yet.</p>
              ) : (
                <ul className="space-y-2">
                  {entities.map((entity) => (
                    <li className="rounded-xl border border-[#e9e9e7] bg-[#ffffff] p-3" key={entity.id}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-[#1a1a1a]">{entity.name}</p>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]"
                          style={{
                            backgroundColor: `${ENTITY_COLORS[entity.entity_type] ?? "#9b9b9b"}1A`,
                            color: ENTITY_COLORS[entity.entity_type] ?? "#9b9b9b",
                          }}
                        >
                          {entity.entity_type}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-[#9b9b9b]">
                        Confidence {Math.round(entity.confidence * 100)}%
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="mt-6 space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b9b9b]">
                Facts
              </h2>
              {facts.length === 0 ? (
                <p className="text-sm text-[#9b9b9b]">No facts yet.</p>
              ) : (
                <ul className="space-y-2">
                  {facts.map((fact) => (
                    <li className="rounded-xl border border-[#e9e9e7] bg-[#ffffff] p-3" key={fact.id}>
                      <p className="text-sm font-medium text-[#1a1a1a]">{fact.predicate}</p>
                      <p className="mt-1 text-sm text-[#1a1a1a]">{fact.object_}</p>
                      <p className="mt-2 text-xs text-[#9b9b9b]">
                        Confidence {Math.round(fact.confidence * 100)}%
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="mt-6 space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b9b9b]">
                Ingest Status
              </h2>
              <div className="rounded-xl border border-[#e9e9e7] bg-[#ffffff] p-3">
                {ingestJob ? (
                  <>
                    <p className="text-sm font-medium capitalize text-[#1a1a1a]">
                      {formatStatus(ingestJob.status)}
                    </p>
                    <p className="mt-1 text-xs text-[#9b9b9b]">
                      Updated {new Date(ingestJob.updated_at).toLocaleString()}
                    </p>
                    {ingestJob.error ? (
                      <p className="mt-2 text-xs text-[#ef4444]">{ingestJob.error}</p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-[#9b9b9b]">No ingest job recorded yet.</p>
                )}
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
