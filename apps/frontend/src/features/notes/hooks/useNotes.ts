import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import type {
  CreateNoteInput,
  DigestResponse,
  Note,
  NoteLinksResponse,
  UpdateNoteInput,
} from "@/features/notes/types";

export const NOTES_QUERY_KEY = ["notes"];

export function useNotesList() {
  return useQuery({
    queryKey: NOTES_QUERY_KEY,
    queryFn: () => api.get<Note[]>("/api/v1/notes"),
  });
}

export function useNote(noteId: string | null) {
  return useQuery({
    queryKey: ["notes", noteId],
    enabled: noteId !== null,
    queryFn: () => api.get<Note>(`/api/v1/notes/${noteId}`),
  });
}

export function useCreateNote() {
  return useMutation({
    mutationFn: (payload: CreateNoteInput) => api.post<Note>("/api/v1/notes", payload),
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: NOTES_QUERY_KEY });
      queryClient.setQueryData<Note[]>(NOTES_QUERY_KEY, (current) =>
        current ? [note, ...current] : [note],
      );
      queryClient.setQueryData(["notes", note.id], note);
    },
  });
}

export function useUpdateNote() {
  return useMutation({
    mutationFn: ({ noteId, payload }: { noteId: string; payload: UpdateNoteInput }) =>
      api.patch<Note>(`/api/v1/notes/${noteId}`, payload),
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: NOTES_QUERY_KEY });
      queryClient.setQueryData(["notes", note.id], note);
      queryClient.setQueryData<Note[]>(NOTES_QUERY_KEY, (current) =>
        current?.map((entry) => (entry.id === note.id ? note : entry)) ?? [note],
      );
    },
  });
}

export function useDeleteNote() {
  return useMutation({
    mutationFn: (noteId: string) => api.delete<void>(`/api/v1/notes/${noteId}`),
    onSuccess: (_, noteId) => {
      queryClient.invalidateQueries({ queryKey: NOTES_QUERY_KEY });
      queryClient.removeQueries({ queryKey: ["notes", noteId] });
      queryClient.setQueryData<Note[]>(NOTES_QUERY_KEY, (current) =>
        current?.filter((entry) => entry.id !== noteId) ?? [],
      );
    },
  });
}

export function useNoteLinks(noteId: string | null) {
  return useQuery({
    queryKey: ["notes", noteId, "links"],
    enabled: noteId !== null,
    queryFn: () => api.get<NoteLinksResponse>(`/api/v1/notes/${noteId}/links`),
  });
}

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: () => api.get<{ tags: string[] }>("/api/v1/tags"),
  });
}

export function useDigest() {
  return useQuery({
    queryKey: ["digest"],
    queryFn: () => api.get<DigestResponse>("/api/v1/digest"),
  });
}
