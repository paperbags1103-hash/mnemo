import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type NoteEntity = {
  id: string;
  name: string;
  entity_type: string;
  confidence: number;
};

export type NoteFact = {
  id: string;
  predicate: string;
  object_: string;
  confidence: number;
};

export type IngestJob = {
  id: string;
  note_id: string;
  status: string;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export type GraphNode = {
  id: string;
  title: string;
  category: string;
  tag_count: number;
};

export type GraphEdge = {
  source: string;
  target: string;
  shared_tag: string;
};

export type GraphPayload = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export function useNoteEntities(noteId: string | null) {
  return useQuery({
    queryKey: ["graph", "note-entities", noteId],
    enabled: noteId !== null,
    queryFn: async () => {
      const response = await api.get<{ entities: NoteEntity[] }>(
        `/api/v1/lorien/notes/${noteId}/entities`,
      );
      return response.entities;
    },
  });
}

export function useNoteFacts(noteId: string | null) {
  return useQuery({
    queryKey: ["graph", "note-facts", noteId],
    enabled: noteId !== null,
    queryFn: async () => {
      const response = await api.get<{ facts: NoteFact[] }>(`/api/v1/lorien/notes/${noteId}/facts`);
      return response.facts;
    },
  });
}

export function useIngestStatus(noteId: string | null) {
  return useQuery({
    queryKey: ["graph", "ingest-status", noteId],
    enabled: noteId !== null,
    queryFn: async () => {
      const params = new URLSearchParams({
        note_id: noteId ?? "",
        limit: "1",
      });
      const response = await api.get<{ jobs: IngestJob[] }>(`/api/v1/ingest/jobs?${params.toString()}`);
      return response.jobs[0] ?? null;
    },
  });
}

export function useKnowledgeGraph() {
  return useQuery({
    queryKey: ["graph", "full"],
    queryFn: () => api.get<GraphPayload>("/api/v1/graph/notes"),
  });
}
