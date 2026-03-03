export type Note = {
  id: string;
  title: string;
  content: string;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
  version: number;
};

export type CreateNoteInput = {
  title: string;
  content?: string;
  folder_id?: string | null;
};

export type UpdateNoteInput = {
  title?: string;
  content?: string;
  folder_id?: string | null;
  version?: number;
};
