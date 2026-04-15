import { formatInAppTimeZone } from "@/lib/date-time";
import type { ManagedKeyListItem } from "@/features/managed-keys/types";

export function inferLaunchCommand(
  key: Pick<ManagedKeyListItem, "group" | "protocol" | "launchCommand">,
) {
  if (key.launchCommand === "claude" || key.launchCommand === "codex") {
    return key.launchCommand;
  }

  return key.group === "codex" || key.protocol === "openai"
    ? "codex"
    : "claude";
}

export function getKeyAvailableModels(key: ManagedKeyListItem) {
  const models = new Set<string>();

  for (const model of key.availableModels) {
    if (model) {
      models.add(model);
    }
  }

  if (key.model) {
    models.add(key.model);
  }

  return [...models];
}

export function mergeAvailableModels(
  currentModels: string[],
  discoveredModels: string[],
  discoveredModel: string | null,
) {
  const merged = new Set<string>();

  for (const model of discoveredModels) {
    if (model) {
      merged.add(model);
    }
  }

  if (discoveredModel) {
    merged.add(discoveredModel);
  }

  for (const model of currentModels) {
    if (model) {
      merged.add(model);
    }
  }

  return [...merged];
}

export function buildKeyEnvCopyText(key: ManagedKeyListItem) {
  const lines = [
    ...(key.protocol === "anthropic"
      ? [
          `export ANTHROPIC_AUTH_TOKEN=${key.secret}`,
          `export ANTHROPIC_BASE_URL=${key.baseUrl}`,
          ...(key.model ? [`export ANTHROPIC_MODEL=${key.model}`] : []),
        ]
      : [
          `export OPENAI_API_KEY=${key.secret}`,
          `export OPENAI_BASE_URL=${key.baseUrl}`,
          ...(key.model ? [`export OPENAI_MODEL=${key.model}`] : []),
        ]),
  ];

  for (const [envKey, envValue] of Object.entries(key.extraEnv)) {
    lines.push(`export ${envKey}=${envValue}`);
  }

  lines.push(inferLaunchCommand(key));

  return lines.join("\n");
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return "未测试";
  }

  return formatInAppTimeZone(value, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isClaudeFamilyModel(model: string) {
  return /(claude|sonnet|opus|haiku|anthropic)/i.test(model);
}

export function normalizeProviderLabels(message: string) {
  const normalized = message
    .replaceAll("Anthropic", "Claude")
    .replaceAll("OpenAI", "Codex")
    .replaceAll("Anthropic 模型测试", "Claude 模型测试")
    .replaceAll("OpenAI 模型测试", "Codex 模型测试")
    .replaceAll("Claude 可用（未识别出可测试模型）", "Claude 未验证（模型列表可访问，但未识别出可测试模型）")
    .replaceAll("Codex 可用（未识别出可测试模型）", "Codex 未验证（模型列表可访问，但未识别出可测试模型）");

  return normalized
    .replace(/Claude\s*可用（测试模型：([^）]+)）/g, (_all, model: string) =>
      isClaudeFamilyModel(model)
        ? `Claude 可用（测试模型：${model}）`
        : `Codex 可用（测试模型：${model}）`,
    )
    .replace(/Codex\s*可用（测试模型：([^）]+)）/g, (_all, model: string) =>
      isClaudeFamilyModel(model)
        ? `Claude 可用（测试模型：${model}）`
        : `Codex 可用（测试模型：${model}）`,
    );
}

function hasSuccessfulAttemptInSummary(summary: string) {
  return summary
    .split(/[，,]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .some((part) => !/（失败(?:\/\d+)?）$/.test(part));
}

export function providerIsAvailable(message: string, label: "Claude" | "Codex") {
  const normalizedMessage = normalizeProviderLabels(message);
  const lines = normalizedMessage
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (
    lines.some((line) =>
      new RegExp(`^${label}\\s*(?:可用|已发现模型|未验证)`).test(line),
    )
  ) {
    return true;
  }

  const testLine = lines.find((line) => line.startsWith(`${label} 模型测试：`));

  if (!testLine) {
    return false;
  }

  const summary = testLine.slice(`${label} 模型测试：`.length).trim();

  if (!summary || summary === "无可用模型") {
    return false;
  }

  if (summary.startsWith("未验证（接口可用")) {
    return true;
  }

  return hasSuccessfulAttemptInSummary(summary);
}

export function getSupportedProviders(message: string | null) {
  if (!message) {
    return [];
  }

  const providers: Array<"anthropic" | "openai"> = [];

  if (providerIsAvailable(message, "Claude")) {
    providers.push("anthropic");
  }

  if (providerIsAvailable(message, "Codex")) {
    providers.push("openai");
  }

  return providers;
}

export function matchesKeyFilter(key: ManagedKeyListItem, filter: "all" | "claude" | "codex") {
  if (filter === "all") {
    return true;
  }

  const supportedProviders = getSupportedProviders(key.lastTestMessage);

  if (filter === "claude") {
    return supportedProviders.includes("anthropic");
  }

  return supportedProviders.includes("openai");
}
