export type ProviderTag = "claude" | "codex";

export type ProviderResponseFormat = "json" | "event-stream" | "text" | "empty";

export type ParsedProviderResponse = {
  payload: unknown;
  rawText: string;
  contentType: string | null;
  format: ProviderResponseFormat;
};

export type TestCandidate = {
  model: string;
  source: "configured" | "preferred" | "fallback";
};
