import type {
  ManagedKeyListItem,
  ManagedKeyTestResult,
} from "@/features/managed-keys/types";
import {
  buildManagedKeyChallengeFailureMessage,
  generateManagedKeyChallenge,
  validateManagedKeyChallengeResponse,
} from "./challenge";
import {
  buildEmptyProviderResponseMessage,
  buildModelsToTest,
  buildProviderRequestErrorMessage,
  discoverAnthropicModels,
  extractProviderContent,
  parseProviderResponse,
} from "./discovery";
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
  logProtocolSummary,
} from "./test-logger";
import { joinBaseUrl } from "./utils";

export async function testAnthropicKey(
  key: ManagedKeyListItem,
  globalPreferredModels: string[],
  exhaustiveModelTesting: boolean,
): Promise<ManagedKeyTestResult> {
  logKeyTestInfo("开始 Claude 协议测试", {
    ...buildKeyLogContext(key),
    exhaustiveModelTesting,
    globalPreferredModels,
  });

  const discovered = await discoverAnthropicModels(key);
  const modelsToTest = buildModelsToTest(
    key,
    discovered.ids,
    globalPreferredModels,
    exhaustiveModelTesting,
  );

  logDiscoveryStage({
    key,
    providerLabel: "Claude",
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
      providerLabel: "Claude",
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
      providerLabel: "Claude",
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
    const startedAt = Date.now();

    try {
      const response = await fetch(joinBaseUrl(key.baseUrl, "/v1/messages"), {
        method: "POST",
        headers: {
          "anthropic-version": "2023-06-01",
          authorization: `Bearer ${key.secret}`,
          "content-type": "application/json",
          "x-api-key": key.secret,
        },
        body: JSON.stringify({
          model: candidate.model,
          max_tokens: 32,
          messages: [{ role: "user", content: challenge.prompt }],
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      const latency = Date.now() - startedAt;
      const providerResponse = await parseProviderResponse(response);
      const content = extractProviderContent(providerResponse, "anthropic");

      if (!response.ok) {
        lastFailureMessage = buildProviderRequestErrorMessage(
          providerResponse,
          `消息测试失败（HTTP ${response.status}）`,
        );
        lastStatusCode = response.status;
        attempts.push(
          createFailedAttempt({
            model: candidate.model,
            source: candidate.source,
            statusCode: response.status,
            message: lastFailureMessage,
            latency,
            healthStatus: "request_failed",
          }),
        );
        logAttemptResult({
          key,
          providerLabel: "Claude",
          attempt: attempts[attempts.length - 1],
        });
        continue;
      }

      if (!content) {
        lastFailureMessage = buildEmptyProviderResponseMessage(
          providerResponse,
          "anthropic",
        );
        lastStatusCode = response.status;
        attempts.push(
          createFailedAttempt({
            model: candidate.model,
            source: candidate.source,
            statusCode: response.status,
            message: lastFailureMessage,
            latency,
            healthStatus: "request_failed",
          }),
        );
        logAttemptResult({
          key,
          providerLabel: "Claude",
          attempt: attempts[attempts.length - 1],
        });
        continue;
      }

      const validation = validateManagedKeyChallengeResponse(
        content,
        challenge.expectedAnswer,
      );

      if (!validation.valid) {
        lastFailureMessage = buildManagedKeyChallengeFailureMessage(
          challenge.expectedAnswer,
          validation.extractedNumbers,
        );
        lastStatusCode = response.status;
        attempts.push(
          createFailedAttempt({
            model: candidate.model,
            source: candidate.source,
            statusCode: response.status,
            message: lastFailureMessage,
            latency,
            healthStatus: "validation_failed",
          }),
        );
        logAttemptResult({
          key,
          providerLabel: "Claude",
          attempt: attempts[attempts.length - 1],
        });
        continue;
      }

      validatedModels.push(candidate.model);
      attempts.push(
        createSuccessfulAttempt({
          model: candidate.model,
          source: candidate.source,
          latency,
        }),
      );
      logAttemptResult({
        key,
        providerLabel: "Claude",
        attempt: attempts[attempts.length - 1],
      });
    } catch (error) {
      const latency = Date.now() - startedAt;
      lastFailureMessage =
        error instanceof Error ? error.message : "请求失败，请稍后再试。";
      lastStatusCode = null;
      attempts.push(
        createFailedAttempt({
          model: candidate.model,
          source: candidate.source,
          statusCode: null,
          message: lastFailureMessage,
          latency,
          healthStatus: "error",
        }),
      );
      logAttemptResult({
        key,
        providerLabel: "Claude",
        attempt: attempts[attempts.length - 1],
      });
    }
  }

  if (validatedModels.length > 0) {
    const successfulConfiguredModels = attempts
      .filter((attempt) => attempt.ok && attempt.source === "configured")
      .map((attempt) => attempt.model);
    const successfulPreferredModels = attempts
      .filter((attempt) => attempt.ok && attempt.source === "preferred")
      .map((attempt) => attempt.model);

    const result = buildProtocolSuccessResult({
      label: "Claude",
      statusCode: 200,
      discoveredModels: discovered.ids,
      validatedModels,
      attempts,
      successfulConfiguredModels,
      successfulPreferredModels,
    });

    logProtocolSummary({
      key,
      providerLabel: "Claude",
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
    providerLabel: "Claude",
    result,
  });

  return result;
}
