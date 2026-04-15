export interface NoteDocument {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  isShared: boolean;
  shareToken: string | null;
  sharedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
export type ViewMode = "edit" | "preview";

export const AUTO_SAVE_DEBOUNCE_MS = 1800;
