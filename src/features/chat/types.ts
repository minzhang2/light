export type ChatMessageInput = {
  role: "user" | "assistant";
  content: string;
};

export type ChatKeyOption = {
  id: string;
  name: string;
  group: "claude" | "codex";
  supportsClaude: boolean;
  supportsCodex: boolean;
  models: string[];
  defaultModel: string;
};

export type ChatCompletionResult = {
  content: string;
  model: string;
  keyName: string;
};

export type ChatSessionListItem = {
  id: string;
  title: string;
  keyId: string | null;
  model: string | null;
  updatedAt: string;
};

export type ChatSessionDetail = {
  id: string;
  title: string;
  keyId: string | null;
  model: string | null;
  updatedAt: string;
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
  }>;
};
