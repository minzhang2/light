export type KeyFilter = "all" | "claude" | "codex";

export type EditDraft = {
  name: string;
  secret: string;
  baseUrl: string;
  model: string;
  launchCommand: "claude" | "codex";
};

export const GROUP_LABELS = {
  claude: "Claude",
  codex: "Codex",
} as const;

export const BATCH_TEST_CONCURRENCY = 5;
