import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Link2, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useNotesStore } from "@/features/notes/store";
import { useNoteLinks } from "@/features/notes/hooks/useNotes";

const CATEGORY_COLORS: Record<string, string> = {
  투자: "#2563eb",
  기술: "#7c3aed",
  문화: "#d97706",
  여행: "#059669",
  일기: "#db2777",
  기타: "#6b7280",
};

type Backlink = {
  source_id: string;
  title: string;
  link_type: string;
  confidence: number;
  rationale: string | null;
  status: string;
  tags: string;
};

type PendingLink = {
  source_id: string;
  target_id: string;
  source_title: string;
  target_title: string;
  confidence: number;
  rationale: string | null;
};

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

function Section({
  title,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-4">
      <button
        className="flex w-full items-center gap-1.5 py-1 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? (
          <ChevronDown size={12} className="text-[#9b9b9b]" />
        ) : (
          <ChevronRight size={12} className="text-[#9b9b9b]" />
        )}
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9b9b9b]">
          {title}
        </span>
        <span className="ml-1 rounded-full bg-[#f0f0ed] px-1.5 py-0.5 text-[9px] text-[#7a7a78]">
          {count}
        </span>
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  );
}

export function BacklinksPanel({ noteId }: { noteId: string | null }) {
  const { setSelectedNoteId } = useNotesStore();
  const queryClient = useQueryClient();

  const { data: backlinks = [], isLoading: blLoading } = useBacklinks(noteId);
  const { data: related, isLoading: relLoading } = useNoteLinks(noteId);
  const { data: pending = [], isLoading: pendingLoading } = usePendingLinks(noteId);

  const updateStatus = useMutation({
    mutationFn: ({ sourceId, targetId, status }: { sourceId: string; targetId: string; status: string }) =>
      api.patch(`/api/v1/links/${sourceId}/${targetId}`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pending-links", noteId] });
      void queryClient.invalidateQueries({ queryKey: ["backlinks", noteId] });
    },
  });

  const relatedNotes: Array<{ id: string; title: string }> = [];

  return (
    <aside className="w-64 shrink-0 border-l border-[#e9e9e7] bg-[#fafafa] px-4 py-5 overflow-y-auto">
      <div className="mb-4 flex items-center gap-2">
        <Link2 size={13} className="text-[#9b9b9b]" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9b9b9b]">
          Links
        </span>
      </div>

      {/* Pending (agent proposed) */}
      {(pending.length > 0 || pendingLoading) && (
        <Section title="승인 대기" count={pending.length} defaultOpen>
          {pendingLoading ? (
            <Loader2 size={12} className="animate-spin text-[#9b9b9b]" />
          ) : (
            pending.map((link) => (
              <div
                key={`${link.source_id}-${link.target_id}`}
                className="mb-3 rounded-lg border border-[#e9e9e7] bg-white p-3"
              >
                <button
                  className="text-left text-xs font-medium text-[#1a1a1a] hover:text-[#4c6a91]"
                  onClick={() => setSelectedNoteId(link.source_id)}
                >
                  {link.source_title}
                </button>
                {link.rationale && (
                  <p className="mt-1 text-[10px] leading-relaxed text-[#7a7a78] italic">
                    "{link.rationale}"
                  </p>
                )}
                <div className="mt-1.5 flex items-center gap-1 text-[9px] text-[#9b9b9b]">
                  신뢰도 {Math.round((link.confidence ?? 1) * 100)}%
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    className="flex-1 rounded bg-[#2563eb] py-1 text-[10px] font-semibold text-white hover:bg-[#1d4ed8]"
                    onClick={() =>
                      updateStatus.mutate({ sourceId: link.source_id, targetId: link.target_id, status: "confirmed" })
                    }
                  >
                    ✓ 확인
                  </button>
                  <button
                    className="flex-1 rounded bg-[#f0f0ed] py-1 text-[10px] font-semibold text-[#7a7a78] hover:bg-[#e5e5e2]"
                    onClick={() =>
                      updateStatus.mutate({ sourceId: link.source_id, targetId: link.target_id, status: "rejected" })
                    }
                  >
                    ✗ 거부
                  </button>
                </div>
              </div>
            ))
          )}
        </Section>
      )}

      {/* Backlinks (confirmed links pointing here) */}
      <Section title="이 노트를 참조한 노트" count={backlinks.length} defaultOpen>
        {blLoading ? (
          <Loader2 size={12} className="animate-spin text-[#9b9b9b]" />
        ) : backlinks.length === 0 ? (
          <p className="text-[10px] text-[#b0b0ad] italic px-1">아직 링크가 없습니다</p>
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

      {/* Related (shared tags) */}
      <Section title="관련 노트 (태그)" count={relatedNotes.length} defaultOpen={false}>
        {relLoading ? (
          <Loader2 size={12} className="animate-spin text-[#9b9b9b]" />
        ) : relatedNotes.length === 0 ? (
          <p className="text-[10px] text-[#b0b0ad] italic px-1">공유 태그 없음</p>
        ) : (
          relatedNotes.slice(0, 8).map((note: { id: string; title: string }) => (
            <button
              key={note.id}
              className="mb-1 block w-full rounded-md px-2 py-1.5 text-left text-xs text-[#1a1a1a] hover:bg-[#f0f0ed]"
              onClick={() => setSelectedNoteId(note.id)}
            >
              <span className="font-medium">{note.title}</span>
            </button>
          ))
        )}
      </Section>
    </aside>
  );
}
