export type ChatMessageInput = {
  role: "user" | "assistant";
  content: string;
};

export type ChatKeyOption = {
  id: string;
  name: string;
  group: "claude" | "codex";
  protocol: "anthropic" | "openai";
  models: string[];
  defaultModel: string;
};

export type ChatCompletionResult = {
  content: string;
  model: string;
  keyName: string;
};
