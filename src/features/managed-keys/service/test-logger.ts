import type {
  ManagedKeyListItem,
  ManagedKeyTestResult,
} from "@/features/managed-keys/types";
import type { OpenAiEndpointAttemptLog } from "./openai-attempt";

function parseBooleanEnv(value: string | undefined, fallback = false) {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

const TEST_LOG_PREFIX = "[managed-key-test]";
const MANAGED_KEY_TEST_DEBUG_ENABLED =
  process.env.NODE_ENV !== "production" &&
  parseBooleanEnv(process.env.MANAGED_KEY_TEST_DEBUG, false);

function logTestInfo(message: string, meta?: Record<string, unknown>) {
  if (!MANAGED_KEY_TEST_DEBUG_ENABLED) {
    return;
  }

  if (meta) {
    console.log(`${TEST_LOG_PREFIX} ${message}`, meta);
    return;
  }

  console.log(`${TEST_LOG_PREFIX} ${message}`);
}

function logTestWarn(message: string, meta?: Record<string, unknown>) {
  if (!MANAGED_KEY_TEST_DEBUG_ENABLED) {
    return;
  }

  if (meta) {
    console.warn(`${TEST_LOG_PREFIX} ${message}`, meta);
    return;
  }

  console.warn(`${TEST_LOG_PREFIX} ${message}`);
}

export function buildKeyLogContext(key: ManagedKeyListItem) {
  return {
    keyId: key.id,
    name: key.name,
    group: key.group,
    protocol: key.protocol,
    baseUrl: key.baseUrl,
    model: key.model,
  };
}

function previewModels(models: string[], limit = 6) {
  return models.slice(0, limit);
}

export function logDiscoveryStage(input: {
  key: ManagedKeyListItem;
  providerLabel: "Claude" | "Codex";
  discoveredModels: string[];
  modelsToTest: Array<{
    model: string;
    source: "configured" | "preferred" | "fallback";
  }>;
  discoveryStatusCode: number;
}) {
  logTestInfo(`${input.providerLabel} 模型发现完成`, {
    ...buildKeyLogContext(input.key),
    discoveryStatusCode: input.discoveryStatusCode,
    discoveredModelCount: input.discoveredModels.length,
    discoveredModelPreview: previewModels(input.discoveredModels),
    candidateCount: input.modelsToTest.length,
    candidateModels: input.modelsToTest.map((item) => ({
      model: item.model,
      source: item.source,
    })),
  });
}

export function logAttemptResult(input: {
  key: ManagedKeyListItem;
  providerLabel: "Claude" | "Codex";
  attempt: ManagedKeyTestResult["attemptedModels"][number];
}) {
  const logger = input.attempt.ok ? logTestInfo : logTestWarn;

  logger(`${input.providerLabel} 模型测试结果`, {
    ...buildKeyLogContext(input.key),
    model: input.attempt.model,
    source: input.attempt.source,
    ok: input.attempt.ok,
    healthStatus: input.attempt.healthStatus,
    statusCode: input.attempt.statusCode,
    latency: input.attempt.latency ?? null,
    message: input.attempt.message,
  });
}

export function logOpenAiEndpointAttempt(input: {
  key: ManagedKeyListItem;
  model: string;
  source: "configured" | "preferred" | "fallback";
  endpointLog: OpenAiEndpointAttemptLog;
}) {
  const logger = input.endpointLog.ok ? logTestInfo : logTestWarn;

  logger("Codex 端点探测结果", {
    ...buildKeyLogContext(input.key),
    model: input.model,
    source: input.source,
    requestMode: input.endpointLog.endpoint.mode,
    requestPath: input.endpointLog.endpoint.path,
    requestUrl: input.endpointLog.endpoint.url.toString(),
    ok: input.endpointLog.ok,
    healthStatus: input.endpointLog.healthStatus,
    statusCode: input.endpointLog.statusCode,
    latency: input.endpointLog.latency,
    message: input.endpointLog.message,
  });
}

export function logProtocolSummary(input: {
  key: ManagedKeyListItem;
  providerLabel: "Claude" | "Codex";
  result: ManagedKeyTestResult;
}) {
  const logger = input.result.ok ? logTestInfo : logTestWarn;

  logger(`${input.providerLabel} 协议测试汇总`, {
    ...buildKeyLogContext(input.key),
    ok: input.result.ok,
    discoveryOk: input.result.discoveryOk,
    statusCode: input.result.statusCode,
    discoveredModel: input.result.discoveredModel,
    discoveredModelCount: input.result.discoveredModels.length,
    validatedModelCount: input.result.validatedModels.length,
    validatedModels: input.result.validatedModels,
    attemptedModelCount: input.result.attemptedModels.length,
    averageLatency: input.result.averageLatency ?? null,
    message: input.result.message,
  });
}

export function logKeyTestInfo(message: string, meta?: Record<string, unknown>) {
  logTestInfo(message, meta);
}

export function logKeyTestWarn(message: string, meta?: Record<string, unknown>) {
  logTestWarn(message, meta);
}
