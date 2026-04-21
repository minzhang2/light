import { formatInAppTimeZone } from "@/lib/date-time";
import { getSupportedProviders } from "@/features/managed-keys/provider-support";
import type { ManagedKeyListItem } from "@/features/managed-keys/types";

export { getSupportedProviders, normalizeProviderLabels } from "@/features/managed-keys/provider-support";

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
