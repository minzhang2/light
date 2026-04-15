import type { ChatMessageInput } from "@/features/chat/types";

export type ChatMessage = ChatMessageInput & {
  id: string;
  keyName?: string;
  model?: string;
  failed?: boolean;
};

export const STORAGE_KEY_ID = "chat:selected-key-id";
export const STORAGE_MODEL = "chat:selected-model";
