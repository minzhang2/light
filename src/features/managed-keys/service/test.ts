import type { ManagedKey } from "@prisma/client";
import type {
  ManagedKeyListItem,
  ManagedKeyProtocol,
  ManagedKeyTestResult,
} from "@/features/managed-keys/types";
import {
  buildCombinedTestMessage,
  calculateAverageLatency,
  pickDiscoveredModel,
  summarizeTagAvailability,
} from "./discovery";
import {
  createBaseResult,
  extractCombinedFailureStatus,
} from "./protocol-test-helpers";
import {
  buildKeyLogContext,
  logKeyTestInfo,
  logKeyTestWarn,
} from "./test-logger";
import { testAnthropicKey } from "./anthropic-test";
import { testOpenAiKey } from "./openai-test";

const TEST_CACHE_DURATION = 5 * 60 * 1000;

export { testAnthropicKey, testOpenAiKey };

export function shouldSkipTest(key: ManagedKey): boolean {
  return shouldSkipTestWithOptions(key);
}

export function shouldSkipTestWithOptions(
  key: ManagedKey,
  options?: { force?: boolean },
) {
  if (options?.force) {
    return false;
  }

  if (!key.lastTestAt || key.lastTestStatus !== "success") {
    return false;
  }

  const lastTest = key.lastTestAt.getTime();
  return Date.now() - lastTest < TEST_CACHE_DURATION;
}

export function buildTestInputByProtocol(
  key: ManagedKeyListItem,
  protocol: ManagedKeyProtocol,
): ManagedKeyListItem {
  return {
    ...key,
    protocol,
    group: protocol === "openai" ? "codex" : "claude",
  };
}

export async function runProtocolTest(
  key: ManagedKeyListItem,
  protocol: ManagedKeyProtocol,
  globalPreferredModels: string[],
  exhaustiveModelTesting: boolean,
): Promise<ManagedKeyTestResult> {
  try {
    const candidate = buildTestInputByProtocol(key, protocol);
    return protocol === "anthropic"
      ? await testAnthropicKey(candidate, globalPreferredModels, exhaustiveModelTesting)
      : await testOpenAiKey(candidate, globalPreferredModels, exhaustiveModelTesting);
  } catch (error) {
    const result = createBaseResult({
      message: error instanceof Error ? error.message : "请求失败，请稍后再试。",
    });

    logKeyTestWarn("协议测试抛出未捕获异常", {
      ...buildKeyLogContext(key),
      protocol,
      error: error instanceof Error ? error.message : String(error),
    });

    return result;
  }
}

export async function testManagedKeyWithCache(
  key: ManagedKey,
  toListItem: (key: ManagedKey) => ManagedKeyListItem,
  globalPreferredModels: string[],
  exhaustiveModelTesting: boolean,
  options?: { force?: boolean },
): Promise<{ result: ManagedKeyTestResult; key: ManagedKeyListItem }> {
  if (shouldSkipTestWithOptions(key, options)) {
    const listItem = toListItem(key);
    const cachedModels = JSON.parse(key.availableModels || "[]") as string[];

    logKeyTestInfo("命中 key 测试缓存", {
      keyId: key.id,
      name: key.name,
      protocol: key.protocol,
      baseUrl: key.baseUrl,
      cachedModelCount: cachedModels.length,
      lastTestAt: key.lastTestAt?.toISOString() ?? null,
    });

    return {
      result: createBaseResult({
        ok: key.lastTestStatus === "success",
        message: key.lastTestMessage ?? "使用缓存的测试结果",
        statusCode: key.lastTestStatus === "success" ? 200 : null,
        testedAt: key.lastTestAt?.toISOString() ?? new Date().toISOString(),
        discoveryOk: key.lastTestStatus === "success",
        discoveredModel: key.model,
        discoveredModels: cachedModels,
        validatedModels: cachedModels,
        fromCache: true,
      }),
      key: listItem,
    };
  }

  const listItem = toListItem(key);

  logKeyTestInfo("开始整条 key 联合测试", {
    ...buildKeyLogContext(listItem),
    exhaustiveModelTesting,
    globalPreferredModels,
  });

  const [anthropicResult, openAiResult] = await Promise.all([
    runProtocolTest(listItem, "anthropic", globalPreferredModels, exhaustiveModelTesting),
    runProtocolTest(listItem, "openai", globalPreferredModels, exhaustiveModelTesting),
  ]);

  const protocolResults = [anthropicResult, openAiResult];
  const claudeSummary = summarizeTagAvailability({
    tag: "claude",
    results: protocolResults,
  });
  const codexSummary = summarizeTagAvailability({
    tag: "codex",
    results: protocolResults,
  });
  const combinedMessage = buildCombinedTestMessage({
    claudeSummary,
    codexSummary,
    anthropicResult,
    openAiResult,
  });
  const discoveredModels = [
    ...new Set([
      ...anthropicResult.discoveredModels,
      ...openAiResult.discoveredModels,
    ]),
  ];
  const validatedModels = [
    ...new Set([
      ...anthropicResult.validatedModels,
      ...openAiResult.validatedModels,
    ]),
  ];
  const overallOk = claudeSummary.ok || codexSummary.ok;
  const preferredDiscoveredModel =
    listItem.group === "claude"
      ? claudeSummary.discoveredModel ?? codexSummary.discoveredModel
      : codexSummary.discoveredModel ?? claudeSummary.discoveredModel;
  const discoveredModel =
    overallOk
      ? preferredDiscoveredModel ??
        pickDiscoveredModel(validatedModels, listItem.group)
      : null;
  const allAttempts = [
    ...anthropicResult.attemptedModels,
    ...openAiResult.attemptedModels,
  ];
  const avgLatency = calculateAverageLatency(allAttempts);

  const result = createBaseResult({
    ok: overallOk,
    message: combinedMessage,
    statusCode: overallOk ? 200 : extractCombinedFailureStatus(protocolResults),
    testedAt: new Date().toISOString(),
    discoveryOk: protocolResults.some((item) => item.discoveryOk),
    discoveredModel,
    discoveredModels,
    validatedModels,
    attemptedModels: allAttempts,
    averageLatency: avgLatency,
    fromCache: false,
  });
  const summaryLogger = result.ok ? logKeyTestInfo : logKeyTestWarn;

  summaryLogger("整条 key 联合测试完成", {
    ...buildKeyLogContext(listItem),
    ok: result.ok,
    discoveryOk: result.discoveryOk,
    statusCode: result.statusCode,
    discoveredModel: result.discoveredModel,
    discoveredModelCount: result.discoveredModels.length,
    validatedModelCount: result.validatedModels.length,
    validatedModels: result.validatedModels,
    attemptedModelCount: result.attemptedModels.length,
    averageLatency: result.averageLatency ?? null,
    message: result.message,
  });

  return { result, key: listItem };
}
