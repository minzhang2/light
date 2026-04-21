import type { ManagedKeyListItem, ManagedKeyTestResult } from "@/features/managed-keys/types";
import {
  extractAnthropicText,
  extractOpenAiText,
} from "@/lib/provider-response-parser";
import { joinBaseUrl, isClaudeFamilyModel, normalizeModelAlias } from "./utils";
import type { ParsedProviderResponse, TestCandidate, ProviderTag } from "./types";

export async function discoverAnthropicModels(key: ManagedKeyListItem) {
  const response = await fetch(joinBaseUrl(key.baseUrl, "/v1/models"), {
    method: "GET",
    headers: {
      "anthropic-version": "2023-06-01",
      authorization: `Bearer ${key.secret}`,
      "x-api-key": key.secret,
    },
    signal: AbortSignal.timeout(15000),
  });

  const json = (await response.json().catch(() => null)) as
    | { data?: Array<{ id?: string }> }
    | { error?: { message?: string } }
    | null;

  const ids = json && "data" in json && Array.isArray(json.data)
    ? json.data.map((item) => item.id).filter((value): value is string => Boolean(value))
    : [];

  return { response, ids, body: json };
}

export async function discoverOpenAiModels(key: ManagedKeyListItem) {
  const response = await fetch(joinBaseUrl(key.baseUrl, "/models"), {
    method: "GET",
    headers: {
      authorization: `Bearer ${key.secret}`,
    },
    signal: AbortSignal.timeout(15000),
  });

  const json = (await response.json().catch(() => null)) as
    | { data?: Array<{ id?: string }> }
    | { error?: { message?: string } }
    | null;

  const ids = json && "data" in json && Array.isArray(json.data)
    ? json.data.map((item) => item.id).filter((value): value is string => Boolean(value))
    : [];

  return { response, ids, body: json };
}

export function pickDiscoveredModel(models: string[], preferredGroup: ManagedKeyListItem["group"]) {
  const lowered = models.map((model) => ({ raw: model, value: model.toLowerCase() }));
  const priorities =
    preferredGroup === "codex"
      ? ["gpt-5", "codex", "gpt-4.1", "o4"]
      : ["claude", "sonnet", "opus", "haiku"];

  for (const priority of priorities) {
    const match = lowered.find((item) => item.value.includes(priority));

    if (match) {
      return match.raw;
    }
  }

  return models[0] ?? null;
}

export function sortModelsByGroupPriority(
  models: string[],
  preferredGroup: ManagedKeyListItem["group"],
) {
  const priorities =
    preferredGroup === "codex"
      ? ["gpt-5", "codex", "gpt-4.1", "o4"]
      : ["claude", "sonnet", "opus", "haiku"];

  const getPriority = (model: string) => {
    const lowered = model.toLowerCase();
    const index = priorities.findIndex((priority) => lowered.includes(priority));
    return index === -1 ? priorities.length : index;
  };

  return [...models].sort((left, right) => getPriority(left) - getPriority(right));
}

export function matchesModelGroup(model: string, group: ManagedKeyListItem["group"]) {
  return group === "claude" ? isClaudeFamilyModel(model) : !isClaudeFamilyModel(model);
}

export function getScopedPreferredModels(
  key: ManagedKeyListItem,
  globalPreferredModels: string[],
): string[] {
  const seen = new Set<string>();
  const scoped = globalPreferredModels.filter((model) =>
    matchesModelGroup(model, key.group),
  );

  return scoped.filter((model) => {
    const normalized = normalizeModelAlias(model);
    if (seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
}

export function buildModelsToTest(
  key: ManagedKeyListItem,
  discoveredModels: string[],
  globalPreferredModels: string[],
  exhaustiveModelTesting: boolean,
): TestCandidate[] {
  const scopedDiscoveredModels = discoveredModels.filter((model) =>
    matchesModelGroup(model, key.group),
  );
  const scopedPreferredModels = getScopedPreferredModels(key, globalPreferredModels);
  const discoveredAliases = new Set(
    scopedDiscoveredModels.map((model) => normalizeModelAlias(model)),
  );
  const candidates: TestCandidate[] = [];
  const seen = new Set<string>();

  const addCandidate = (
    model: string | null | undefined,
    source: TestCandidate["source"],
  ) => {
    const trimmed = model?.trim();

    if (!trimmed) {
      return;
    }

    const normalized = normalizeModelAlias(trimmed);

    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    candidates.push({
      model: trimmed,
      source,
    });
  };

  const configuredModel =
    key.model && matchesModelGroup(key.model, key.group) ? key.model : null;
  addCandidate(configuredModel, "configured");

  const preferredCandidates =
    scopedDiscoveredModels.length > 0
      ? scopedPreferredModels.filter((model) =>
          discoveredAliases.has(normalizeModelAlias(model)),
        )
      : scopedPreferredModels;

  for (const model of preferredCandidates) {
    addCandidate(model, "preferred");
  }

  const fallbackModels = sortModelsByGroupPriority(
    scopedDiscoveredModels.filter(
      (model) => !seen.has(normalizeModelAlias(model)),
    ),
    key.group,
  );

  if (exhaustiveModelTesting) {
    return [
      ...candidates,
      ...fallbackModels.map((model) => ({ model, source: "fallback" as const })),
    ];
  }

  if (candidates.length === 0 && fallbackModels.length > 0) {
    addCandidate(fallbackModels[0], "fallback");
  }

  return candidates;
}

export function extractErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if ("error" in payload && payload.error && typeof payload.error === "object") {
    const error = payload.error as { message?: string };
    return error.message ?? null;
  }

  if ("message" in payload && typeof payload.message === "string") {
    return payload.message;
  }

  return null;
}

export function formatProviderRawText(rawText: string, limit = 600) {
  const normalized = rawText.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "";
  }

  return normalized.length > limit
    ? `${normalized.slice(0, limit)}...`
    : normalized;
}

export function appendProviderRawText(message: string, response: ParsedProviderResponse) {
  const snippet = formatProviderRawText(response.rawText);

  if (!snippet) {
    return message;
  }

  return `${message} 上游返回：${snippet}`;
}

export async function parseProviderResponse(response: Response): Promise<ParsedProviderResponse> {
  const contentType = response.headers.get("content-type");
  const rawText = (await response.text().catch(() => "")).trim();

  if (!rawText) {
    return {
      payload: null,
      rawText: "",
      contentType,
      format: "empty",
    };
  }

  try {
    return {
      payload: JSON.parse(rawText) as unknown,
      rawText,
      contentType,
      format: "json",
    };
  } catch {
    if (contentType?.includes("text/event-stream") || /^data:/m.test(rawText)) {
      return {
        payload: null,
        rawText,
        contentType,
        format: "event-stream",
      };
    }

    return {
      payload: null,
      rawText,
      contentType,
      format: "text",
    };
  }
}

export function extractTextFromEventStreamChunk(chunk: string, protocol: "anthropic" | "openai") {
  const trimmed = chunk.trim();

  if (!trimmed || trimmed === "[DONE]") {
    return "";
  }

  try {
    const payload = JSON.parse(trimmed) as unknown;
    return protocol === "anthropic"
      ? extractAnthropicText(payload)
      : extractOpenAiText(payload);
  } catch {
    return "";
  }
}

export function extractTextFromEventStream(rawText: string, protocol: "anthropic" | "openai") {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => extractTextFromEventStreamChunk(line.slice("data:".length), protocol))
    .filter(Boolean)
    .join("")
    .trim();
}

export function extractProviderContent(
  response: ParsedProviderResponse,
  protocol: "anthropic" | "openai",
) {
  if (response.format === "json") {
    return protocol === "anthropic"
      ? extractAnthropicText(response.payload)
      : extractOpenAiText(response.payload);
  }

  if (response.format === "event-stream") {
    return extractTextFromEventStream(response.rawText, protocol);
  }

  if (response.format === "text" && response.contentType?.startsWith("text/plain")) {
    return response.rawText;
  }

  return "";
}

export function buildEmptyProviderResponseMessage(
  response: ParsedProviderResponse,
  protocol: "anthropic" | "openai",
) {
  const providerLabel = protocol === "anthropic" ? "Claude" : "Codex";

  if (response.format === "empty") {
    return appendProviderRawText(`${providerLabel} 接口返回了空响应体。`, response);
  }

  if (response.format === "event-stream") {
    return appendProviderRawText(`${providerLabel} 接口返回了流式响应，但未解析出文本内容。`, response);
  }

  if (response.format === "text") {
    const message = response.contentType?.startsWith("text/plain")
      ? `${providerLabel} 接口返回了纯文本响应，但内容为空。`
      : `${providerLabel} 接口返回格式无法识别（${response.contentType ?? "unknown"}）。`;

    return appendProviderRawText(message, response);
  }

  return appendProviderRawText(
    `${providerLabel} 接口返回成功，但未解析出文本内容。`,
    response,
  );
}

export function buildProviderRequestErrorMessage(
  response: ParsedProviderResponse,
  fallback: string,
) {
  const baseMessage = extractErrorMessage(response.payload) ?? fallback;
  return appendProviderRawText(baseMessage, response);
}

export function buildAttemptSummary(attempts: ManagedKeyTestResult["attemptedModels"]) {
  if (attempts.length === 0) {
    return "";
  }

  const orderedAttempts = [
    ...attempts.filter((attempt: ManagedKeyTestResult["attemptedModels"][number]) => attempt.ok),
    ...attempts.filter((attempt: ManagedKeyTestResult["attemptedModels"][number]) => !attempt.ok),
  ];

  return orderedAttempts
    .map((attempt: ManagedKeyTestResult["attemptedModels"][number]) => {
      if (attempt.ok) {
        const statusLabel = attempt.healthStatus === "degraded" ? "延迟" : "可用";
        const latencyInfo = attempt.latency ? `/${attempt.latency}ms` : "";
        return `${attempt.model}（${statusLabel}${latencyInfo}）`;
      }

      if (attempt.healthStatus === "validation_failed") {
        return `${attempt.model}（验证失败）`;
      }

      if (attempt.healthStatus === "error") {
        return `${attempt.model}（错误）`;
      }

      return `${attempt.model}（失败${attempt.statusCode ? `/${attempt.statusCode}` : ""}）`;
    })
    .join("，");
}

export function calculateAverageLatency(attempts: ManagedKeyTestResult["attemptedModels"]): number | undefined {
  const latencies = attempts
    .filter((attempt: ManagedKeyTestResult["attemptedModels"][number]) => attempt.ok && typeof attempt.latency === "number")
    .map((attempt: ManagedKeyTestResult["attemptedModels"][number]) => attempt.latency as number);

  if (latencies.length === 0) {
    return undefined;
  }

  return Math.round(latencies.reduce((sum: number, lat: number) => sum + lat, 0) / latencies.length);
}

export function summarizeTagAvailability(input: {
  tag: ProviderTag;
  results: ManagedKeyTestResult[];
}) {
  const label = input.tag === "claude" ? "Claude" : "Codex";
  const tagGroup = input.tag === "claude" ? "claude" : "codex";
  const matchedModel = input.results
    .flatMap((result) => result.validatedModels)
    .find((model) =>
      input.tag === "claude" ? isClaudeFamilyModel(model) : !isClaudeFamilyModel(model),
    );

  if (matchedModel) {
    return {
      ok: true,
      discoveredModel: matchedModel,
      message: `${label} 可用（测试模型：${matchedModel}）`,
    };
  }

  const hasAccessibleModelList = input.results.some((result) => result.discoveryOk);
  const discoveredModels = sortModelsByGroupPriority(
    [
      ...new Set(
        input.results.flatMap((result) =>
          result.discoveredModels.filter((model: string) =>
            input.tag === "claude" ? isClaudeFamilyModel(model) : !isClaudeFamilyModel(model),
          ),
        ),
      ),
    ],
    tagGroup,
  );

  if (hasAccessibleModelList) {
    if (discoveredModels.length > 0) {
      const preview = discoveredModels.slice(0, 6).join("、");
      const suffix = discoveredModels.length > 6 ? ` 等 ${discoveredModels.length} 个模型` : "";

      return {
        ok: false,
        discoveredModel: null,
        message: `${label} 已发现模型：${preview}${suffix}（未逐个验证）`,
      };
    }

    return {
      ok: false,
      discoveredModel: null,
      message: `${label} 未验证（模型列表可访问，但未识别出可测试模型）`,
    };
  }

  const firstErrorMessage = input.results.find((result) => !result.ok)?.message;
  return {
    ok: false,
    discoveredModel: null,
    message: `${label} 不可用：${firstErrorMessage ?? "请求失败，请稍后再试。"}`,
  };
}

export function buildCombinedTestMessage(input: {
  claudeSummary: ReturnType<typeof summarizeTagAvailability>;
  codexSummary: ReturnType<typeof summarizeTagAvailability>;
  anthropicResult: ManagedKeyTestResult;
  openAiResult: ManagedKeyTestResult;
}) {
  const summaryParts = [input.claudeSummary.message, input.codexSummary.message].filter(
    (message) =>
      !/^\s*(Claude|Codex)\s*可用（测试模型：/.test(message),
  );

  if (/^\s*(Claude|Codex)\s*已发现模型：/.test(summaryParts[0] ?? "")) {
    summaryParts[0] = summaryParts[0]!.replace(/^\s*(Claude|Codex)\s*/, "");
  }

  const parts = [...summaryParts];

  parts.push(
    input.anthropicResult.attemptedModels.length > 0
      ? `Claude 模型测试：${buildAttemptSummary(input.anthropicResult.attemptedModels)}`
      : input.anthropicResult.discoveryOk
        ? "Claude 模型测试：未验证（接口可用）"
        : "Claude 模型测试：无可用模型",
  );

  parts.push(
    input.openAiResult.attemptedModels.length > 0
      ? `Codex 模型测试：${buildAttemptSummary(input.openAiResult.attemptedModels)}`
      : input.openAiResult.discoveryOk
        ? "Codex 模型测试：未验证（接口可用）"
        : "Codex 模型测试：无可用模型",
  );

  return parts.join("\n");
}
