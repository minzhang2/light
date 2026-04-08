import { Prisma, type ManagedKey } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildManagedKeyFingerprint,
  maskSecret,
  parseManagedKeys,
} from "@/features/managed-keys/parser";
import type {
  GlobalConfig,
  ManagedKeyListItem,
  ManagedKeyProtocol,
  ManagedKeyTestResult,
  ManagedKeyUpdateInput,
  ParsedManagedKeyInput,
} from "@/features/managed-keys/types";

function parseJsonRecord(value: string | null) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function joinBaseUrl(baseUrl: string, path: string) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(path.replace(/^\//, ""), normalizedBase);
}

function parseJsonArray(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as string[];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseBooleanValue(value: string | null, fallback = false) {
  if (value === null) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === "boolean" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function normalizeModelConfig(values: string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();

    if (!trimmed) {
      continue;
    }

    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) {
      continue;
    }

    seen.add(lower);
    normalized.push(trimmed);
  }

  return normalized;
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function buildCopyText(key: {
  protocol: ManagedKeyProtocol;
  secret: string;
  baseUrl: string;
  model: string | null;
  extraEnv: Record<string, string>;
}) {
  const lines =
    key.protocol === "anthropic"
      ? [
          `export ANTHROPIC_AUTH_TOKEN=${key.secret}`,
          `export ANTHROPIC_BASE_URL=${key.baseUrl}`,
          ...(key.model ? [`export ANTHROPIC_MODEL=${key.model}`] : []),
        ]
      : [
          `export OPENAI_API_KEY=${key.secret}`,
          `export OPENAI_BASE_URL=${key.baseUrl}`,
          ...(key.model ? [`export OPENAI_MODEL=${key.model}`] : []),
        ];

  for (const [envKey, envValue] of Object.entries(key.extraEnv)) {
    lines.push(`export ${envKey}=${envValue}`);
  }

  return lines.join("\n");
}

function buildExportText(keys: ManagedKeyListItem[]) {
  return keys
    .map((key) => [`// ${key.name}`, key.copyText].join("\n"))
    .join("\n\n");
}

function toListItem(key: ManagedKey): ManagedKeyListItem {
  const aliases = parseJsonArray(key.aliases);
  const extraEnv = parseJsonRecord(key.extraEnv);

  return {
    id: key.id,
    name: key.name,
    aliases,
    group: key.groupName as ManagedKeyListItem["group"],
    protocol: key.protocol as ManagedKeyListItem["protocol"],
    secret: key.secret,
    maskedSecret: maskSecret(key.secret),
    baseUrl: key.baseUrl,
    model: key.model,
    launchCommand: (key.launchCommand as ManagedKeyListItem["launchCommand"]) ?? null,
    extraEnv,
    availableModels: parseJsonArray(key.availableModels),
    copyText: buildCopyText({
      protocol: key.protocol as ManagedKeyProtocol,
      secret: key.secret,
      baseUrl: key.baseUrl,
      model: key.model,
      extraEnv,
    }),
    isTestable: key.isTestable,
    isPinned: key.isPinned,
    lastTestStatus:
      key.lastTestStatus === "success" || key.lastTestStatus === "error"
        ? key.lastTestStatus
        : null,
    lastTestMessage: key.lastTestMessage,
    lastTestAt: key.lastTestAt?.toISOString() ?? null,
    createdAt: key.createdAt.toISOString(),
    updatedAt: key.updatedAt.toISOString(),
  };
}

function stringifyAliases(values: string[]) {
  return JSON.stringify([...new Set(values.filter(Boolean))]);
}

function stringifyExtraEnv(value: Record<string, string>) {
  return JSON.stringify(value);
}

function mergeAvailableModels(
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

function isUnknownUpdateArgumentError(error: unknown, argument: string) {
  return (
    error instanceof Prisma.PrismaClientValidationError &&
    error.message.includes(`Unknown argument \`${argument}\``)
  );
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function mergeExistingWithParsed(
  existing: ManagedKey | null,
  entry: ParsedManagedKeyInput,
  options?: { isTestable?: boolean },
) {
  const aliases = new Set([
    ...parseJsonArray(existing?.aliases ?? null),
    ...entry.aliases,
    existing?.name ?? "",
    entry.name,
  ]);

  aliases.delete(entry.name);
  aliases.delete("");

  return {
    name: entry.name,
    aliases: stringifyAliases([...aliases]),
    groupName: entry.group,
    protocol: entry.protocol,
    secret: entry.secret,
    baseUrl: entry.baseUrl,
    model: entry.model,
    launchCommand: entry.launchCommand,
    extraEnv: stringifyExtraEnv({
      ...parseJsonRecord(existing?.extraEnv ?? null),
      ...entry.extraEnv,
    }),
    fingerprint: entry.fingerprint,
    ...(typeof options?.isTestable === "boolean"
      ? { isTestable: options.isTestable }
      : {}),
  };
}

async function discoverAnthropicModels(key: ManagedKeyListItem) {
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

async function discoverOpenAiModels(key: ManagedKeyListItem) {
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

function pickDiscoveredModel(models: string[], preferredGroup: ManagedKeyListItem["group"]) {
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

function sortModelsByGroupPriority(
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

function matchesModelGroup(model: string, group: ManagedKeyListItem["group"]) {
  return group === "claude" ? isClaudeFamilyModel(model) : !isClaudeFamilyModel(model);
}

function normalizeModelAlias(model: string) {
  return model
    .trim()
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

type TestCandidate = {
  model: string;
  source: "preferred" | "fallback";
};

function getScopedPreferredModels(
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

function buildModelsToTest(
  key: ManagedKeyListItem,
  discoveredModels: string[],
  globalPreferredModels: string[],
  exhaustiveModelTesting: boolean,
): TestCandidate[] {
  const scopedDiscoveredModels = discoveredModels.filter((model) =>
    matchesModelGroup(model, key.group),
  );
  const scopedPreferredModels = getScopedPreferredModels(key, globalPreferredModels);
  const preferredCandidates = scopedPreferredModels.map((model) => ({
    model,
    source: "preferred" as const,
  }));
  const preferredSeen = new Set(
    scopedPreferredModels.map((model) => normalizeModelAlias(model)),
  );
  const fallbackModels = sortModelsByGroupPriority(
    scopedDiscoveredModels.filter(
      (model) => !preferredSeen.has(normalizeModelAlias(model)),
    ),
    key.group,
  );

  return exhaustiveModelTesting
    ? [
        ...preferredCandidates,
        ...fallbackModels.map((model) => ({ model, source: "fallback" as const })),
      ]
    : preferredCandidates;
}

function isClaudeFamilyModel(model: string) {
  return /(claude|sonnet|opus|haiku|anthropic)/i.test(model);
}

type ProviderTag = "claude" | "codex";

function summarizeTagAvailability(input: {
  tag: ProviderTag;
  results: ManagedKeyTestResult[];
}) {
  const label = input.tag === "claude" ? "Claude" : "Codex";
  const tagGroup = input.tag === "claude" ? "claude" : "codex";
  const matchedModel = input.results
    .filter((result) => result.ok && Boolean(result.discoveredModel))
    .map((result) => result.discoveredModel as string)
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

  const hasAccessibleModelList = input.results.some((result) => result.ok);
  const discoveredModels = sortModelsByGroupPriority(
    [
      ...new Set(
        input.results.flatMap((result) =>
          result.discoveredModels.filter((model) =>
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
        discoveredModel: pickDiscoveredModel(discoveredModels, tagGroup),
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

function buildCombinedTestMessage(input: {
  claudeSummary: ReturnType<typeof summarizeTagAvailability>;
  codexSummary: ReturnType<typeof summarizeTagAvailability>;
  anthropicResult: ManagedKeyTestResult;
  openAiResult: ManagedKeyTestResult;
}) {
  const parts = [input.claudeSummary.message, input.codexSummary.message].filter(
    (message) =>
      !/^\s*(Claude|Codex)\s*可用（测试模型：/.test(message) &&
      !/^\s*(Claude|Codex)\s*(已发现模型|未验证)/.test(message),
  );

  parts.push(
    input.anthropicResult.attemptedModels.length > 0
      ? `Claude 模型测试：${buildAttemptSummary(input.anthropicResult.attemptedModels)}`
      : input.anthropicResult.discoveredModels.length > 0
        ? "Claude 模型测试：未验证（接口可用）"
        : "Claude 模型测试：无可用模型",
  );

  parts.push(
    input.openAiResult.attemptedModels.length > 0
      ? `Codex 模型测试：${buildAttemptSummary(input.openAiResult.attemptedModels)}`
      : input.openAiResult.discoveredModels.length > 0
        ? "Codex 模型测试：未验证（接口可用）"
        : "Codex 模型测试：无可用模型",
  );

  return parts.join("\n");
}

function buildTestInputByProtocol(
  key: ManagedKeyListItem,
  protocol: ManagedKeyProtocol,
): ManagedKeyListItem {
  return {
    ...key,
    protocol,
    group: protocol === "openai" ? "codex" : "claude",
  };
}

async function runProtocolTest(
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
    return {
      ok: false,
      message: error instanceof Error ? error.message : "请求失败，请稍后再试。",
      statusCode: null,
      testedAt: new Date().toISOString(),
      discoveredModel: null,
      discoveredModels: [],
      attemptedModels: [],
    };
  }
}

function extractErrorMessage(payload: unknown) {
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

function buildAttemptSummary(attempts: ManagedKeyTestResult["attemptedModels"]) {
  if (attempts.length === 0) {
    return "";
  }

  const orderedAttempts = [
    ...attempts.filter((attempt) => attempt.ok),
    ...attempts.filter((attempt) => !attempt.ok),
  ];

  return orderedAttempts
    .map((attempt) => {
      if (attempt.ok) {
        return attempt.model;
      }

      return `${attempt.model}（失败${attempt.statusCode ? `/${attempt.statusCode}` : ""}）`;
    })
    .join("，");
}

async function testAnthropicKey(
  key: ManagedKeyListItem,
  globalPreferredModels: string[],
  exhaustiveModelTesting: boolean,
): Promise<ManagedKeyTestResult> {
  const discovered = await discoverAnthropicModels(key);
  const modelsToTest = buildModelsToTest(
    key,
    discovered.ids,
    globalPreferredModels,
    exhaustiveModelTesting,
  );

  if (!discovered.response.ok) {
    return {
      ok: false,
      message:
        extractErrorMessage(discovered.body) ??
        `模型列表请求失败（HTTP ${discovered.response.status}）`,
      statusCode: discovered.response.status,
      testedAt: new Date().toISOString(),
      discoveredModel: null,
      discoveredModels: discovered.ids,
      attemptedModels: [],
    };
  }

  if (modelsToTest.length === 0) {
    return {
      ok: true,
      message:
        discovered.ids.length > 0
          ? globalPreferredModels.length > 0
            ? "模型列表访问成功，但未命中全局优先模型；已完成可用模型扫描。"
            : "模型列表访问成功，但尚未配置全局优先模型；已完成可用模型扫描。"
          : "模型列表访问成功，但没有识别出可测试模型。",
      statusCode: discovered.response.status,
      testedAt: new Date().toISOString(),
      discoveredModel: null,
      discoveredModels: discovered.ids,
      attemptedModels: [],
    };
  }

  const attempts: ManagedKeyTestResult["attemptedModels"] = [];
  let lastFailureMessage: string | null = null;
  let lastStatusCode: number | null = discovered.response.status;
  let successfulModel: string | null = null;
  let successfulPreferredModel: string | null = null;

  for (const candidate of modelsToTest) {
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
        max_tokens: 12,
        messages: [{ role: "user", content: "ping" }],
      }),
      signal: AbortSignal.timeout(20000),
    });

    const payload = (await response.json().catch(() => null)) as
      | { content?: Array<{ text?: string }> }
      | { error?: { message?: string } }
      | null;

    if (response.ok) {
      attempts.push({
        model: candidate.model,
        ok: true,
        statusCode: response.status,
        message: "测试成功",
        source: candidate.source,
      });
      successfulModel ??= candidate.model;
      if (candidate.source === "preferred") {
        successfulPreferredModel ??= candidate.model;
      }
      continue;
    }

    lastFailureMessage = extractErrorMessage(payload) ?? `消息测试失败（HTTP ${response.status}）`;
    lastStatusCode = response.status;
    attempts.push({
      model: candidate.model,
      ok: false,
      statusCode: response.status,
      message: lastFailureMessage,
      source: candidate.source,
    });
  }

  const passedPreferredModels = attempts
    .filter((attempt) => attempt.ok && attempt.source === "preferred")
    .map((attempt) => attempt.model);

  if (successfulModel) {
    const primaryModel = successfulPreferredModel ?? successfulModel;
    const successLabel =
      passedPreferredModels.length > 0
        ? `Claude 可用（全局优先模型通过：${passedPreferredModels.join("、")}）`
        : `Claude 可用（测试模型：${primaryModel}）`;
    const attemptSummary = buildAttemptSummary(attempts);

    return {
      ok: true,
      message: attemptSummary ? `${successLabel}\n覆盖测试：${attemptSummary}` : successLabel,
      statusCode: 200,
      testedAt: new Date().toISOString(),
      discoveredModel: primaryModel,
      discoveredModels: discovered.ids,
      attemptedModels: attempts,
    };
  }

  return {
    ok: false,
    message: lastFailureMessage ?? "消息测试失败，请稍后再试。",
    statusCode: lastStatusCode,
    testedAt: new Date().toISOString(),
    discoveredModel: null,
    discoveredModels: discovered.ids,
    attemptedModels: attempts,
  };
}

async function testOpenAiKey(
  key: ManagedKeyListItem,
  globalPreferredModels: string[],
  exhaustiveModelTesting: boolean,
): Promise<ManagedKeyTestResult> {
  const discovered = await discoverOpenAiModels(key);
  const modelsToTest = buildModelsToTest(
    key,
    discovered.ids,
    globalPreferredModels,
    exhaustiveModelTesting,
  );

  if (!discovered.response.ok) {
    return {
      ok: false,
      message:
        extractErrorMessage(discovered.body) ??
        `模型列表请求失败（HTTP ${discovered.response.status}）`,
      statusCode: discovered.response.status,
      testedAt: new Date().toISOString(),
      discoveredModel: null,
      discoveredModels: discovered.ids,
      attemptedModels: [],
    };
  }

  if (modelsToTest.length === 0) {
    return {
      ok: true,
      message:
        discovered.ids.length > 0
          ? globalPreferredModels.length > 0
            ? "模型列表访问成功，但未命中全局优先模型；已完成可用模型扫描。"
            : "模型列表访问成功，但尚未配置全局优先模型；已完成可用模型扫描。"
          : "模型列表访问成功，但没有识别出可测试模型。",
      statusCode: discovered.response.status,
      testedAt: new Date().toISOString(),
      discoveredModel: null,
      discoveredModels: discovered.ids,
      attemptedModels: [],
    };
  }

  const attempts: ManagedKeyTestResult["attemptedModels"] = [];
  let lastFailureMessage: string | null = null;
  let lastStatusCode: number | null = discovered.response.status;
  let successfulModel: string | null = null;
  let successfulPreferredModel: string | null = null;

  for (const candidate of modelsToTest) {
    const response = await fetch(joinBaseUrl(key.baseUrl, "/chat/completions"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${key.secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: candidate.model,
        max_tokens: 12,
        messages: [{ role: "user", content: "ping" }],
      }),
      signal: AbortSignal.timeout(20000),
    });

    const payload = (await response.json().catch(() => null)) as
      | { choices?: Array<{ message?: { content?: string } }> }
      | { error?: { message?: string } }
      | null;

    if (response.ok) {
      attempts.push({
        model: candidate.model,
        ok: true,
        statusCode: response.status,
        message: "测试成功",
        source: candidate.source,
      });
      successfulModel ??= candidate.model;
      if (candidate.source === "preferred") {
        successfulPreferredModel ??= candidate.model;
      }
      continue;
    }

    lastFailureMessage = extractErrorMessage(payload) ?? `消息测试失败（HTTP ${response.status}）`;
    lastStatusCode = response.status;
    attempts.push({
      model: candidate.model,
      ok: false,
      statusCode: response.status,
      message: lastFailureMessage,
      source: candidate.source,
    });
  }

  const passedPreferredModels = attempts
    .filter((attempt) => attempt.ok && attempt.source === "preferred")
    .map((attempt) => attempt.model);

  if (successfulModel) {
    const primaryModel = successfulPreferredModel ?? successfulModel;
    const successLabel =
      passedPreferredModels.length > 0
        ? `Codex 可用（全局优先模型通过：${passedPreferredModels.join("、")}）`
        : `Codex 可用（测试模型：${primaryModel}）`;
    const attemptSummary = buildAttemptSummary(attempts);

    return {
      ok: true,
      message: attemptSummary ? `${successLabel}\n覆盖测试：${attemptSummary}` : successLabel,
      statusCode: 200,
      testedAt: new Date().toISOString(),
      discoveredModel: primaryModel,
      discoveredModels: discovered.ids,
      attemptedModels: attempts,
    };
  }

  return {
    ok: false,
    message: lastFailureMessage ?? "消息测试失败，请稍后再试。",
    statusCode: lastStatusCode,
    testedAt: new Date().toISOString(),
    discoveredModel: null,
    discoveredModels: discovered.ids,
    attemptedModels: attempts,
  };
}

export async function getGlobalConfig(): Promise<GlobalConfig> {
  const preferredRecord = await prisma.appConfig.findUnique({
    where: { key: "preferredModels" },
  });
  const exhaustiveModelTestingRecord = await prisma.appConfig.findUnique({
    where: { key: "exhaustiveModelTesting" },
  });
  const preferredModels = normalizeModelConfig(
    parseJsonArray(preferredRecord?.value ?? null),
  );
  const exhaustiveModelTesting = parseBooleanValue(
    exhaustiveModelTestingRecord?.value ?? null,
    false,
  );

  return { preferredModels, exhaustiveModelTesting };
}

export async function setGlobalConfig(config: Partial<GlobalConfig>): Promise<GlobalConfig> {
  if (config.preferredModels !== undefined) {
    await prisma.appConfig.upsert({
      where: { key: "preferredModels" },
      create: {
        key: "preferredModels",
        value: JSON.stringify(normalizeModelConfig(config.preferredModels)),
      },
      update: {
        value: JSON.stringify(normalizeModelConfig(config.preferredModels)),
      },
    });
  }

  if (config.exhaustiveModelTesting !== undefined) {
    await prisma.appConfig.upsert({
      where: { key: "exhaustiveModelTesting" },
      create: {
        key: "exhaustiveModelTesting",
        value: JSON.stringify(Boolean(config.exhaustiveModelTesting)),
      },
      update: {
        value: JSON.stringify(Boolean(config.exhaustiveModelTesting)),
      },
    });
  }

  return getGlobalConfig();
}

export async function listManagedKeys() {
  const records = await prisma.managedKey.findMany({
    orderBy: [{ groupName: "asc" }, { isPinned: "desc" }, { createdAt: "desc" }],
  });

  return records.map(toListItem);
}

export async function exportManagedKeys() {
  const keys = await listManagedKeys();
  return buildExportText(keys);
}

export async function importManagedKeys(
  raw: string,
  options?: { isTestable?: boolean },
) {
  const entries = parseManagedKeys(raw);
  const newKeyIds: string[] = [];

  for (const entry of entries) {
    const existing = await prisma.managedKey.findUnique({
      where: { fingerprint: entry.fingerprint },
    });

    const data = mergeExistingWithParsed(existing, entry, options);

    const record = await prisma.managedKey.upsert({
      where: { fingerprint: entry.fingerprint },
      create: data,
      update: data,
    });

    if (!existing) {
      newKeyIds.push(record.id);
    }
  }

  return {
    parsedCount: entries.length,
    newKeyIds,
    keys: await listManagedKeys(),
  };
}

export async function removeManagedKey(id: string) {
  await prisma.managedKey.delete({
    where: { id },
  });

  return listManagedKeys();
}

export async function updateManagedKey(id: string, input: ManagedKeyUpdateInput) {
  const existing = await prisma.managedKey.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error("未找到对应的 key。");
  }

  const name = input.name?.trim() ?? existing.name;
  const secret = input.secret?.trim() ?? existing.secret;
  const baseUrl =
    input.baseUrl !== undefined
      ? normalizeBaseUrl(input.baseUrl)
      : existing.baseUrl;
  const model =
    input.model === undefined
      ? existing.model
      : input.model?.trim()
        ? input.model.trim()
        : null;
  const launchCommand =
    input.launchCommand === undefined ? existing.launchCommand : input.launchCommand;
  const isTestable = input.isTestable ?? existing.isTestable;
  const isPinned = input.isPinned ?? existing.isPinned;

  if (!name || !secret || !baseUrl) {
    throw new Error("名称、Base URL 和密钥不能为空。");
  }

  try {
    new URL(baseUrl);
  } catch {
    throw new Error("Base URL 格式不正确。");
  }

  const nextFingerprint = buildManagedKeyFingerprint([
    existing.protocol,
    baseUrl,
    secret,
    model,
    launchCommand,
  ]);

  const conflicting = await prisma.managedKey.findFirst({
    where: {
      fingerprint: nextFingerprint,
      NOT: { id },
    },
  });

  if (conflicting) {
    if (existing.fingerprint === nextFingerprint) {
      throw new Error("已存在相同配置的 key。");
    }

    const mergedAliases = new Set<string>([
      ...parseJsonArray(existing.aliases),
      ...parseJsonArray(conflicting.aliases),
      existing.name,
      conflicting.name,
    ]);

    mergedAliases.delete(name);
    mergedAliases.delete("");

    const repaired = await prisma.$transaction(async (tx) => {
      await tx.managedKey.delete({
        where: { id: conflicting.id },
      });

      return tx.managedKey.update({
        where: { id },
        data: {
          name,
          aliases: stringifyAliases([...mergedAliases]),
          secret,
          baseUrl,
          model,
          launchCommand,
          isTestable,
          isPinned,
          fingerprint: nextFingerprint,
        },
      });
    });

    return toListItem(repaired);
  }

  try {
    const updated = await prisma.managedKey.update({
      where: { id },
      data: {
        name,
        secret,
        baseUrl,
        model,
        launchCommand,
        isTestable,
        isPinned,
        fingerprint: nextFingerprint,
      },
    });

    return toListItem(updated);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error("已存在相同配置的 key。");
    }

    throw error;
  }
}

export async function testManagedKey(id: string) {
  const key = await prisma.managedKey.findUnique({
    where: { id },
  });

  if (!key) {
    throw new Error("未找到对应的 key。");
  }

  if (!key.isTestable) {
    throw new Error("当前 key 已禁用测试。");
  }

  const listItem = toListItem(key);
  const globalConfig = await getGlobalConfig();
  const globalPreferredModels = globalConfig.preferredModels;
  const exhaustiveModelTesting = globalConfig.exhaustiveModelTesting;
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

  const discoveredModels = [...new Set([
    ...anthropicResult.discoveredModels,
    ...openAiResult.discoveredModels,
  ])];
  const overallOk = claudeSummary.ok || codexSummary.ok;
  const preferredDiscoveredModel =
    listItem.group === "claude"
      ? claudeSummary.discoveredModel ?? codexSummary.discoveredModel
      : codexSummary.discoveredModel ?? claudeSummary.discoveredModel;
  const discoveredModel =
    overallOk
      ? preferredDiscoveredModel ?? pickDiscoveredModel(discoveredModels, listItem.group)
      : null;

  const result: ManagedKeyTestResult = {
    ...anthropicResult,
    ok: overallOk,
    message: combinedMessage,
    statusCode: overallOk
      ? 200
      : anthropicResult.statusCode ?? openAiResult.statusCode,
    testedAt: new Date().toISOString(),
    discoveredModel,
    discoveredModels,
  };

  await prisma.managedKey.update({
    where: { id },
    data: {
      lastTestStatus: result.ok ? "success" : "error",
      lastTestMessage: combinedMessage,
      lastTestAt: new Date(result.testedAt),
    },
  });

  const nextModel = result.discoveredModel ?? key.model;

  try {
    await prisma.managedKey.update({
      where: { id },
      data: {
        model: nextModel,
        availableModels: JSON.stringify(result.discoveredModels),
      },
    });
  } catch (error) {
    if (isUnknownUpdateArgumentError(error, "availableModels")) {
      await prisma.managedKey.update({
        where: { id },
        data: {
          model: nextModel,
        },
      });
    } else {
      console.warn("Failed to persist managed key test metadata", {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const updated = await prisma.managedKey.findUnique({
    where: { id },
  });

  if (!updated) {
    throw new Error("测试完成后未能重新读取 key。");
  }

  const nextItem = toListItem(updated);
  const nextAvailableModels = mergeAvailableModels(
    nextItem.availableModels,
    result.discoveredModels,
    result.discoveredModel,
  );

  return {
    result,
    key: {
      ...nextItem,
      model: nextItem.model ?? result.discoveredModel,
      availableModels: nextAvailableModels,
    },
  };
}
