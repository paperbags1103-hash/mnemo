export const NOTE_CATEGORIES = ["투자", "기술", "문화", "여행", "일기", "기타"] as const;

export type NoteCategory = (typeof NOTE_CATEGORIES)[number];

const CATEGORY_TAG_PREFIX = "cat:";

export type Note = {
  id: string;
  title: string;
  content: string;
  folder_id: string | null;
  tags: string[];
  source: string;
  created_at: string;
  updated_at: string;
  version: number;
};

export type CreateNoteInput = {
  title: string;
  content?: string;
  folder_id?: string | null;
  tags?: string[];
  category?: NoteCategory;
  source?: string;
};

export type UpdateNoteInput = {
  title?: string;
  content?: string;
  folder_id?: string | null;
  tags?: string[];
  category?: NoteCategory;
  source?: string;
  version?: number;
};

export type NoteLinksResponse = {
  backlinks: Array<{
    note_id: string;
    link_type: string;
    created_at: string;
  }>;
  outlinks: Array<{
    note_id: string;
    link_type: string;
    created_at: string;
  }>;
};

export type DigestNote = {
  id: string;
  title: string;
  content: string;
  created_at: string;
};

export type DigestResponse = {
  since: string;
  groups: Array<{
    source: string;
    notes: DigestNote[];
  }>;
  total: number;
};

export function getNoteCategory(tags: string[]): NoteCategory {
  const categoryTag = tags.find((tag) => tag.startsWith(CATEGORY_TAG_PREFIX));
  const category = categoryTag?.slice(CATEGORY_TAG_PREFIX.length) ?? "기타";
  return NOTE_CATEGORIES.includes(category as NoteCategory) ? (category as NoteCategory) : "기타";
}
