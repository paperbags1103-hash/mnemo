import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import type { CreateNoteInput, Note, UpdateNoteInput } from "@/features/notes/types";

const NOTES_QUERY_KEY = ["notes"];

export function useNotes() {
  return useQuery({
    queryKey: NOTES_QUERY_KEY,
    queryFn: () => api.get<Note[]>("/api/v1/notes"),
  });
}

export function useNote(noteId?: string) {
  return useQuery({
    queryKey: ["notes", noteId],
    enabled: Boolean(noteId),
    queryFn: () => api.get<Note>(`/api/v1/notes/${noteId}`),
  });
}

export function useCreateNote() {
  return useMutation({
    mutationFn: (payload: CreateNoteInput) => api.post<Note>("/api/v1/notes", payload),
    onSuccess: (note) => {
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
      queryClient.setQueryData(["notes", note.id], note);
      queryClient.setQueryData<Note[]>(NOTES_QUERY_KEY, (current) =>
        current?.map((entry) => (entry.id === note.id ? note : entry)) ?? [note],
      );
    },
  });
}
