import { create } from "zustand";

type NotesStore = {
  selectedNoteId: string | null;
  setSelectedNoteId: (noteId: string | null) => void;
  savingState: "idle" | "saving" | "saved" | "error";
  setSavingState: (savingState: "idle" | "saving" | "saved" | "error") => void;
};

export const useNotesStore = create<NotesStore>((set) => ({
  selectedNoteId: null,
  setSelectedNoteId: (selectedNoteId) => set({ selectedNoteId }),
  savingState: "idle",
  setSavingState: (savingState) => set({ savingState }),
}));
