import type {
  ManagedKeyListItem,
  ManagedKeyTestResult,
} from "@/features/managed-keys/types";
import { generateManagedKeyChallenge } from "./challenge";
import {
  buildModelsToTest,
  discoverOpenAiModels,
} from "./discovery";
import { runOpenAiCandidateChallenge } from "./openai-attempt";
import {
  buildDiscoveryFailureResult,
  buildDiscoveryOnlyResult,
  buildProtocolFailureResult,
  buildProtocolSuccessResult,
  createFailedAttempt,
  createSuccessfulAttempt,
  REQUEST_TIMEOUT_MS,
} from "./protocol-test-helpers";
import {
  buildKeyLogContext,
  logAttemptResult,
  logDiscoveryStage,
  logKeyTestInfo,
  logOpenAiEndpointAttempt,
  logProtocolSummary,
} from "./test-logger";

export async function testOpenAiKey(
  key: ManagedKeyListItem,
  globalPreferredModels: string[],
  exhaustiveModelTesting: boolean,
): Promise<ManagedKeyTestResult> {
  logKeyTestInfo("开始 Codex 协议测试", {
    ...buildKeyLogContext(key),
    exhaustiveModelTesting,
    globalPreferredModels,
  });

  const discovered = await discoverOpenAiModels(key);
  const modelsToTest = buildModelsToTest(
    key,
    discovered.ids,
    globalPreferredModels,
    exhaustiveModelTesting,
  );

  logDiscoveryStage({
    key,
    providerLabel: "Codex",
    discoveredModels: discovered.ids,
    modelsToTest,
    discoveryStatusCode: discovered.response.status,
  });

  if (!discovered.response.ok) {
    const result = buildDiscoveryFailureResult({
      discoveredModels: discovered.ids,
      body: discovered.body,
      statusCode: discovered.response.status,
    });

    logProtocolSummary({
      key,
      providerLabel: "Codex",
      result,
    });

    return result;
  }

  if (modelsToTest.length === 0) {
    const result = buildDiscoveryOnlyResult({
      discoveredModels: discovered.ids,
      statusCode: discovered.response.status,
      globalPreferredModels,
    });

    logProtocolSummary({
      key,
      providerLabel: "Codex",
      result,
    });

    return result;
  }

  const attempts: ManagedKeyTestResult["attemptedModels"] = [];
  const validatedModels: string[] = [];
  let lastFailureMessage = "消息测试失败，请稍后再试。";
  let lastStatusCode: number | null = discovered.response.status;

  for (const candidate of modelsToTest) {
    const challenge = generateManagedKeyChallenge();
    const outcome = await runOpenAiCandidateChallenge({
      baseUrl: key.baseUrl,
      secret: key.secret,
      model: candidate.model,
      prompt: challenge.prompt,
      expectedAnswer: challenge.expectedAnswer,
      timeoutMs: REQUEST_TIMEOUT_MS,
    });

    for (const endpointLog of outcome.endpointLogs) {
      logOpenAiEndpointAttempt({
        key,
        model: candidate.model,
        source: candidate.source,
        endpointLog,
      });
    }

    if (outcome.ok) {
      validatedModels.push(candidate.model);
      attempts.push(
        createSuccessfulAttempt({
          model: candidate.model,
          source: candidate.source,
          latency: outcome.latency,
        }),
      );
      logAttemptResult({
        key,
        providerLabel: "Codex",
        attempt: attempts[attempts.length - 1],
      });
      continue;
    }

    lastFailureMessage = outcome.message;
    lastStatusCode = outcome.statusCode;
    attempts.push(
      createFailedAttempt({
        model: candidate.model,
        source: candidate.source,
        statusCode: outcome.statusCode,
        message: outcome.message,
        latency: outcome.latency,
        healthStatus:
          outcome.healthStatus === "operational" || outcome.healthStatus === "degraded"
            ? "request_failed"
            : outcome.healthStatus,
      }),
    );
    logAttemptResult({
      key,
      providerLabel: "Codex",
      attempt: attempts[attempts.length - 1],
    });
  }

  if (validatedModels.length > 0) {
    const successfulConfiguredModels = attempts
      .filter((attempt) => attempt.ok && attempt.source === "configured")
      .map((attempt) => attempt.model);
    const successfulPreferredModels = attempts
      .filter((attempt) => attempt.ok && attempt.source === "preferred")
      .map((attempt) => attempt.model);

    const result = buildProtocolSuccessResult({
      label: "Codex",
      statusCode: 200,
      discoveredModels: discovered.ids,
      validatedModels,
      attempts,
      successfulConfiguredModels,
      successfulPreferredModels,
    });

    logProtocolSummary({
      key,
      providerLabel: "Codex",
      result,
    });

    return result;
  }

  const result = buildProtocolFailureResult({
    message: lastFailureMessage,
    statusCode: lastStatusCode,
    discoveredModels: discovered.ids,
    attempts,
  });

  logProtocolSummary({
    key,
    providerLabel: "Codex",
    result,
  });

  return result;
}
