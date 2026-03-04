import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { SourceBadge } from "@/features/notes/components/SourceBadge";
import { useDigest } from "@/features/notes/hooks/useNotes";
import { useNotesStore } from "@/features/notes/store";

function formatTimeAgo(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  return `${Math.round(diffHours / 24)}d ago`;
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function DigestPage() {
  const navigate = useNavigate();
  const { setSelectedNoteId } = useNotesStore();
  const { data, isLoading } = useDigest();

  const groups = useMemo(() => data?.groups ?? [], [data]);

  function openNote(noteId: string) {
    setSelectedNoteId(noteId);
    navigate("/");
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-[#fcfcfb]">
      <header className="border-b border-[#e9e9e7] bg-[#ffffff] px-8 py-6">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#9b9b9b]">Last 24 hours</p>
        <div className="mt-2 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#1a1a1a]">Daily Digest</h1>
            <p className="mt-1 text-sm text-[#7a7a78]">
              {data ? `${data.total} notes since ${new Date(data.since).toLocaleString()}` : "Loading digest"}
            </p>
          </div>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto px-8 py-8">
        {isLoading ? (
          <p className="text-sm text-[#9b9b9b]">Loading digest...</p>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#dededb] bg-[#ffffff] px-6 py-10 text-center text-sm text-[#8a8a87]">
            No notes in the last 24 hours
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map((group) => (
              <section key={group.source} className="space-y-4">
                <div className="flex items-center gap-3">
                  <SourceBadge source={group.source} />
                  <p className="text-sm text-[#7a7a78]">
                    {group.notes.length} {group.notes.length === 1 ? "note" : "notes"}
                  </p>
                </div>
                <div className="space-y-3">
                  {group.notes.map((note) => (
                    <article
                      key={note.id}
                      className="rounded-2xl border border-[#e9e9e7] bg-[#ffffff] px-5 py-4 shadow-[0_1px_0_rgba(15,23,42,0.02)]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <button
                          className="text-left text-lg font-medium text-[#1a1a1a] transition-colors hover:text-[#4c6a91]"
                          onClick={() => openNote(note.id)}
                          type="button"
                        >
                          {note.title || "Untitled"}
                        </button>
                        <span className="shrink-0 pt-1 text-xs text-[#9b9b9b]">
                          {formatTimeAgo(note.created_at)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[#626260]">
                        {stripHtml(note.content || "") || "No preview available."}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
