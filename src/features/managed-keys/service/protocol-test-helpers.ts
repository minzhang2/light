import type {
  ManagedKeyAttemptHealthStatus,
  ManagedKeyTestResult,
} from "@/features/managed-keys/types";
import { getDegradedLatencyThresholdMs } from "./challenge";
import {
  buildAttemptSummary,
  calculateAverageLatency,
  extractErrorMessage,
} from "./discovery";

export const REQUEST_TIMEOUT_MS = 20_000;

type AttemptSource = ManagedKeyTestResult["attemptedModels"][number]["source"];

export function createBaseResult(
  overrides: Partial<ManagedKeyTestResult>,
): ManagedKeyTestResult {
  return {
    ok: false,
    message: "测试失败，请稍后再试。",
    statusCode: null,
    testedAt: new Date().toISOString(),
    discoveryOk: false,
    discoveredModel: null,
    discoveredModels: [],
    validatedModels: [],
    attemptedModels: [],
    ...overrides,
  };
}

export function buildDiscoveryFailureResult(input: {
  discoveredModels: string[];
  body: unknown;
  statusCode: number;
}) {
  return createBaseResult({
    message:
      extractErrorMessage(input.body) ??
      `模型列表请求失败（HTTP ${input.statusCode}）`,
    statusCode: input.statusCode,
    discoveredModels: input.discoveredModels,
  });
}

export function buildDiscoveryOnlyResult(input: {
  discoveredModels: string[];
  statusCode: number;
  globalPreferredModels: string[];
}) {
  return createBaseResult({
    message:
      input.discoveredModels.length > 0
        ? input.globalPreferredModels.length > 0
          ? "模型列表访问成功，但未命中全局优先模型；尚未完成真实可用性校验。"
          : "模型列表访问成功，但尚未配置全局优先模型；尚未完成真实可用性校验。"
        : "模型列表访问成功，但没有识别出可测试模型。",
    statusCode: input.statusCode,
    discoveryOk: true,
    discoveredModels: input.discoveredModels,
  });
}

function resolveAttemptHealthStatus(latency: number): ManagedKeyAttemptHealthStatus {
  return latency <= getDegradedLatencyThresholdMs()
    ? "operational"
    : "degraded";
}

export function createFailedAttempt(input: {
  model: string;
  source: AttemptSource;
  statusCode: number | null;
  message: string;
  latency?: number;
  healthStatus: Exclude<ManagedKeyAttemptHealthStatus, "operational" | "degraded">;
}): ManagedKeyTestResult["attemptedModels"][number] {
  return {
    model: input.model,
    ok: false,
    statusCode: input.statusCode,
    message: input.message,
    source: input.source,
    healthStatus: input.healthStatus,
    ...(typeof input.latency === "number" ? { latency: input.latency } : {}),
  };
}

export function createSuccessfulAttempt(input: {
  model: string;
  source: AttemptSource;
  latency: number;
}): ManagedKeyTestResult["attemptedModels"][number] {
  const healthStatus = resolveAttemptHealthStatus(input.latency);
  const label = healthStatus === "degraded" ? "响应成功但延迟偏高" : "验证通过";

  return {
    model: input.model,
    ok: true,
    statusCode: 200,
    message: `${label}（${input.latency}ms）`,
    source: input.source,
    latency: input.latency,
    healthStatus,
  };
}

export function buildProtocolSuccessResult(input: {
  label: "Claude" | "Codex";
  statusCode: number;
  discoveredModels: string[];
  validatedModels: string[];
  attempts: ManagedKeyTestResult["attemptedModels"];
  successfulConfiguredModels: string[];
  successfulPreferredModels: string[];
}) {
  const primaryModel =
    input.successfulConfiguredModels[0] ??
    input.successfulPreferredModels[0] ??
    input.validatedModels[0] ??
    null;
  const successLabel =
    input.successfulConfiguredModels.length > 0
      ? `${input.label} 可用（配置模型通过：${input.successfulConfiguredModels.join("、")}）`
      : input.successfulPreferredModels.length > 0
        ? `${input.label} 可用（全局优先模型通过：${input.successfulPreferredModels.join("、")}）`
        : `${input.label} 可用（测试模型：${primaryModel}）`;
  const attemptSummary = buildAttemptSummary(input.attempts);
  const avgLatency = calculateAverageLatency(input.attempts);
  const latencyInfo = avgLatency ? ` 平均延迟：${avgLatency}ms` : "";

  return createBaseResult({
    ok: true,
    message: attemptSummary
      ? `${successLabel}${latencyInfo}\n覆盖测试：${attemptSummary}`
      : `${successLabel}${latencyInfo}`,
    statusCode: input.statusCode,
    discoveryOk: true,
    discoveredModel: primaryModel,
    discoveredModels: input.discoveredModels,
    validatedModels: input.validatedModels,
    attemptedModels: input.attempts,
    averageLatency: avgLatency,
  });
}

export function buildProtocolFailureResult(input: {
  message: string;
  statusCode: number | null;
  discoveredModels: string[];
  attempts: ManagedKeyTestResult["attemptedModels"];
}) {
  return createBaseResult({
    message: input.message,
    statusCode: input.statusCode,
    discoveryOk: true,
    discoveredModels: input.discoveredModels,
    attemptedModels: input.attempts,
  });
}

export function extractCombinedFailureStatus(results: ManagedKeyTestResult[]) {
  const explicitFailure = results.find(
    (result) =>
      !result.ok &&
      typeof result.statusCode === "number" &&
      result.statusCode >= 400,
  );

  if (explicitFailure) {
    return explicitFailure.statusCode;
  }

  const firstFailure = results.find((result) => !result.ok);
  return firstFailure?.statusCode ?? null;
}
