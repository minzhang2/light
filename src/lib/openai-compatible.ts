export type OpenAiReasoningEffort = "low" | "medium" | "high";

export type OpenAiRequestMode = "chat_completions" | "responses";

export type OpenAiRequestTarget = {
  mode: OpenAiRequestMode;
  path: string;
  url: URL;
};

export type OpenAiChatMessageRole =
  | "user"
  | "assistant"
  | "system"
  | "developer";

export type OpenAiChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

export type OpenAiChatMessage = {
  role: OpenAiChatMessageRole;
  content: string | OpenAiChatContentPart[];
};

export type OpenAiResponsesContentPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string }
  | { type: "input_file"; filename: string; file_data: string };

export type OpenAiResponsesInputMessage = {
  role: OpenAiChatMessageRole;
  content: OpenAiResponsesContentPart[];
};

const REASONING_EFFORT_ALIASES: Record<string, OpenAiReasoningEffort> = {
  mini: "low",
  minimal: "low",
  low: "low",
  medium: "medium",
  high: "high",
};

const REASONING_MODEL_PATTERNS = [
  /codex/i,
  /\bgpt-5/i,
  /\bo[1-9](?:-|$)/i,
  /\bdeepseek-r1/i,
  /\bqwq/i,
];

const RESPONSES_FIRST_MODEL_PATTERNS = [
  ...REASONING_MODEL_PATTERNS,
  /\b(?:gpt|o)\S*-pro\b/i,
];

const VERSION_SEGMENT_REGEX = /^v\d+(?:[a-z]+)?$/i;

function joinBaseUrl(baseUrl: string, path: string) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(path.replace(/^\//, ""), normalizedBase);
}

function endsWithVersionSegment(baseUrl: string) {
  try {
    const { pathname } = new URL(baseUrl);
    const segments = pathname.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1] ?? "";
    return VERSION_SEGMENT_REGEX.test(lastSegment);
  } catch {
    return VERSION_SEGMENT_REGEX.test(baseUrl.trim());
  }
}

function buildRelativePaths(baseUrl: string, route: string) {
  const paths = endsWithVersionSegment(baseUrl)
    ? [route]
    : [`v1/${route}`, route];

  return [...new Set(paths)];
}

function toResponsesContentPart(
  part: OpenAiChatContentPart,
): OpenAiResponsesContentPart | null {
  if (part.type === "text") {
    const text = part.text.trim();
    return text ? { type: "input_text", text } : null;
  }

  if (part.type === "image_url") {
    const imageUrl = part.image_url?.url?.trim();
    return imageUrl
      ? {
          type: "input_image",
          image_url: imageUrl,
        }
      : null;
  }

  const filename = part.file?.filename?.trim();
  const fileData = part.file?.file_data?.trim();
  return filename && fileData
    ? {
        type: "input_file",
        filename,
        file_data: fileData,
      }
    : null;
}

export function parseOpenAiModelDirective(model: string): {
  modelId: string;
  reasoningEffort?: OpenAiReasoningEffort;
} {
  const trimmed = model.trim();

  if (!trimmed) {
    return { modelId: model };
  }

  const directiveMatch = trimmed.match(
    /^(.*?)[@#](mini|minimal|low|medium|high)$/i,
  );

  if (directiveMatch) {
    const [, baseModel, effortKey] = directiveMatch;
    return {
      modelId: baseModel.trim() || trimmed,
      reasoningEffort: REASONING_EFFORT_ALIASES[effortKey.toLowerCase()],
    };
  }

  if (REASONING_MODEL_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return {
      modelId: trimmed,
      reasoningEffort: "medium",
    };
  }

  return { modelId: trimmed };
}

export function prefersOpenAiResponsesApi(model: string) {
  return RESPONSES_FIRST_MODEL_PATTERNS.some((pattern) => pattern.test(model));
}

export function resolveOpenAiRequestTargets(
  baseUrl: string,
  model: string,
): OpenAiRequestTarget[] {
  const modes: OpenAiRequestMode[] = prefersOpenAiResponsesApi(model)
    ? ["responses", "chat_completions"]
    : ["chat_completions", "responses"];
  const candidates: OpenAiRequestTarget[] = [];
  const seen = new Set<string>();

  for (const mode of modes) {
    const route = mode === "responses" ? "responses" : "chat/completions";

    for (const path of buildRelativePaths(baseUrl, route)) {
      const url = joinBaseUrl(baseUrl, path);
      const key = `${mode}:${url.toString()}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      candidates.push({ mode, path, url });
    }
  }

  return candidates;
}

export function convertChatMessagesToResponsesInput(
  messages: OpenAiChatMessage[],
): OpenAiResponsesInputMessage[] {
  return messages
    .map((message) => {
      const content =
        typeof message.content === "string"
          ? message.content.trim()
            ? [{ type: "input_text", text: message.content.trim() }]
            : []
          : message.content
              .map((part) => toResponsesContentPart(part))
              .filter(
                (
                  part,
                ): part is OpenAiResponsesContentPart => Boolean(part),
              );

      if (content.length === 0) {
        return null;
      }

      return {
        role: message.role,
        content,
      };
    })
    .filter(
      (message): message is OpenAiResponsesInputMessage => Boolean(message),
    );
}

export function buildOpenAiRequestBody(input: {
  target: OpenAiRequestTarget;
  model: string;
  prompt?: string;
  messages?: OpenAiChatMessage[];
  maxTokens?: number;
}) {
  const { modelId, reasoningEffort } = parseOpenAiModelDirective(input.model);

  if (input.target.mode === "chat_completions") {
    return {
      model: modelId,
      ...(typeof input.maxTokens === "number"
        ? { max_tokens: input.maxTokens }
        : {}),
      ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
      messages:
        input.messages ??
        [{ role: "user" as const, content: input.prompt?.trim() ?? "" }],
    };
  }

  return {
    model: modelId,
    ...(typeof input.maxTokens === "number"
      ? { max_output_tokens: input.maxTokens }
      : {}),
    ...(reasoningEffort
      ? { reasoning: { effort: reasoningEffort } }
      : {}),
    input: input.messages
      ? convertChatMessagesToResponsesInput(input.messages)
      : input.prompt?.trim() ?? "",
  };
}
