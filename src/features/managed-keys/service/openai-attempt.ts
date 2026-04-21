import type { ManagedKeyAttemptHealthStatus } from "@/features/managed-keys/types";
import {
  buildOpenAiRequestBody,
  resolveOpenAiRequestTargets,
  type OpenAiRequestTarget,
} from "@/lib/openai-compatible";
import {
  buildManagedKeyChallengeFailureMessage,
  getDegradedLatencyThresholdMs,
  validateManagedKeyChallengeResponse,
} from "./challenge";
import {
  buildEmptyProviderResponseMessage,
  buildProviderRequestErrorMessage,
  extractProviderContent,
  parseProviderResponse,
} from "./discovery";

export type OpenAiEndpointAttemptLog = {
  endpoint: OpenAiRequestTarget;
  ok: boolean;
  statusCode: number | null;
  latency: number;
  message: string;
  healthStatus: ManagedKeyAttemptHealthStatus;
};

export type OpenAiCandidateAttemptResult = {
  ok: boolean;
  statusCode: number | null;
  latency: number;
  message: string;
  healthStatus: ManagedKeyAttemptHealthStatus;
  endpoint: OpenAiRequestTarget | null;
  endpointLogs: OpenAiEndpointAttemptLog[];
};

export async function runOpenAiCandidateChallenge(input: {
  baseUrl: string;
  secret: string;
  model: string;
  prompt: string;
  expectedAnswer: string;
  timeoutMs: number;
}): Promise<OpenAiCandidateAttemptResult> {
  const targets = resolveOpenAiRequestTargets(input.baseUrl, input.model);
  const endpointLogs: OpenAiEndpointAttemptLog[] = [];
  let lastFailure: OpenAiCandidateAttemptResult = {
    ok: false,
    statusCode: null,
    latency: 0,
    message: "消息测试失败，请稍后再试。",
    healthStatus: "error",
    endpoint: null,
    endpointLogs,
  };

  for (const target of targets) {
    const startedAt = Date.now();

    try {
      const response = await fetch(target.url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${input.secret}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(
          buildOpenAiRequestBody({
            target,
            model: input.model,
            prompt: input.prompt,
            maxTokens: 32,
          }),
        ),
        signal: AbortSignal.timeout(input.timeoutMs),
      });

      const latency = Date.now() - startedAt;
      const providerResponse = await parseProviderResponse(response);
      const isHtmlResponse = providerResponse.contentType?.includes("text/html");
      const content = isHtmlResponse
        ? ""
        : extractProviderContent(providerResponse, "openai");

      if (!response.ok) {
        const failure = {
          ok: false,
          statusCode: response.status,
          latency,
          message: buildProviderRequestErrorMessage(
            providerResponse,
            `消息测试失败（HTTP ${response.status}）`,
          ),
          healthStatus: "request_failed" as const,
          endpoint: target,
          endpointLogs,
        };

        endpointLogs.push(failure);
        lastFailure = failure;
        continue;
      }

      if (!content || isHtmlResponse) {
        const failure = {
          ok: false,
          statusCode: response.status,
          latency,
          message: buildEmptyProviderResponseMessage(providerResponse, "openai"),
          healthStatus: "request_failed" as const,
          endpoint: target,
          endpointLogs,
        };

        endpointLogs.push(failure);
        lastFailure = failure;
        continue;
      }

      const validation = validateManagedKeyChallengeResponse(
        content,
        input.expectedAnswer,
      );

      if (!validation.valid) {
        const failure = {
          ok: false,
          statusCode: response.status,
          latency,
          message: buildManagedKeyChallengeFailureMessage(
            input.expectedAnswer,
            validation.extractedNumbers,
          ),
          healthStatus: "validation_failed" as const,
          endpoint: target,
          endpointLogs,
        };

        endpointLogs.push(failure);
        lastFailure = failure;
        continue;
      }

      const success = {
        ok: true,
        statusCode: response.status,
        latency,
        message: `验证通过（${latency}ms）`,
        healthStatus:
          latency <= getDegradedLatencyThresholdMs()
            ? ("operational" as const)
            : ("degraded" as const),
        endpoint: target,
        endpointLogs,
      };

      endpointLogs.push(success);
      return success;
    } catch (error) {
      const failure = {
        ok: false,
        statusCode: null,
        latency: Date.now() - startedAt,
        message:
          error instanceof Error ? error.message : "请求失败，请稍后再试。",
        healthStatus: "error" as const,
        endpoint: target,
        endpointLogs,
      };

      endpointLogs.push(failure);
      lastFailure = failure;
    }
  }

  return lastFailure;
}
