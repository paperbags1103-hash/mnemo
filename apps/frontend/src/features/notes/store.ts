import { create } from "zustand";

type NotesStore = {
  selectedNoteId?: string;
  setSelectedNoteId: (noteId?: string) => void;
};

export const useNotesStore = create<NotesStore>((set) => ({
  selectedNoteId: undefined,
  setSelectedNoteId: (selectedNoteId) => set({ selectedNoteId }),
}));
