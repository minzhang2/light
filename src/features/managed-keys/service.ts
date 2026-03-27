import { Prisma, type ManagedKey } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildManagedKeyFingerprint,
  maskSecret,
  parseManagedKeys,
} from "@/features/managed-keys/parser";
import type {
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

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function buildCopyText(key: {
  protocol: ManagedKeyProtocol;
  secret: string;
  baseUrl: string;
  model: string | null;
  extraEnv: Record<string, string>;
  launchCommand: string | null;
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

  if (key.launchCommand) {
    lines.push(key.launchCommand);
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
      launchCommand: key.launchCommand,
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

function mergeExistingWithParsed(existing: ManagedKey | null, entry: ParsedManagedKeyInput) {
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

function pickModelForTest(key: ManagedKeyListItem, discoveredModels: string[]) {
  if (key.model && discoveredModels.includes(key.model)) {
    return key.model;
  }

  return pickDiscoveredModel(discoveredModels, key.group);
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
  if (hasAccessibleModelList) {
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
}) {
  return `${input.claudeSummary.message}；${input.codexSummary.message}`;
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
): Promise<ManagedKeyTestResult> {
  try {
    const candidate = buildTestInputByProtocol(key, protocol);
    return protocol === "anthropic"
      ? await testAnthropicKey(candidate)
      : await testOpenAiKey(candidate);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "请求失败，请稍后再试。",
      statusCode: null,
      testedAt: new Date().toISOString(),
      discoveredModel: null,
      discoveredModels: [],
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

async function testAnthropicKey(key: ManagedKeyListItem): Promise<ManagedKeyTestResult> {
  const discovered = await discoverAnthropicModels(key);
  const discoveredModel = pickModelForTest(key, discovered.ids);

  if (!discovered.response.ok) {
    return {
      ok: false,
      message:
        extractErrorMessage(discovered.body) ??
        `模型列表请求失败（HTTP ${discovered.response.status}）`,
      statusCode: discovered.response.status,
      testedAt: new Date().toISOString(),
      discoveredModel,
      discoveredModels: discovered.ids,
    };
  }

  if (!discoveredModel) {
    return {
      ok: true,
      message: "模型列表访问成功，但没有识别出可测试模型。",
      statusCode: discovered.response.status,
      testedAt: new Date().toISOString(),
      discoveredModel: null,
      discoveredModels: discovered.ids,
    };
  }

  const response = await fetch(joinBaseUrl(key.baseUrl, "/v1/messages"), {
    method: "POST",
    headers: {
      "anthropic-version": "2023-06-01",
      authorization: `Bearer ${key.secret}`,
      "content-type": "application/json",
      "x-api-key": key.secret,
    },
    body: JSON.stringify({
      model: discoveredModel,
      max_tokens: 12,
      messages: [{ role: "user", content: "ping" }],
    }),
    signal: AbortSignal.timeout(20000),
  });

  const payload = (await response.json().catch(() => null)) as
    | { content?: Array<{ text?: string }> }
    | { error?: { message?: string } }
    | null;

  return {
    ok: response.ok,
    message: response.ok
      ? `Claude 可用，测试模型：${discoveredModel}`
      : extractErrorMessage(payload) ?? `消息测试失败（HTTP ${response.status}）`,
    statusCode: response.status,
    testedAt: new Date().toISOString(),
    discoveredModel,
    discoveredModels: discovered.ids,
  };
}

async function testOpenAiKey(key: ManagedKeyListItem): Promise<ManagedKeyTestResult> {
  const discovered = await discoverOpenAiModels(key);
  const discoveredModel = pickModelForTest(key, discovered.ids);

  if (!discovered.response.ok) {
    return {
      ok: false,
      message:
        extractErrorMessage(discovered.body) ??
        `模型列表请求失败（HTTP ${discovered.response.status}）`,
      statusCode: discovered.response.status,
      testedAt: new Date().toISOString(),
      discoveredModel,
      discoveredModels: discovered.ids,
    };
  }

  if (!discoveredModel) {
    return {
      ok: true,
      message: "模型列表访问成功，但没有识别出可测试模型。",
      statusCode: discovered.response.status,
      testedAt: new Date().toISOString(),
      discoveredModel: null,
      discoveredModels: discovered.ids,
    };
  }

  const response = await fetch(joinBaseUrl(key.baseUrl, "/chat/completions"), {
    method: "POST",
    headers: {
      authorization: `Bearer ${key.secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: discoveredModel,
      max_tokens: 12,
      messages: [{ role: "user", content: "ping" }],
    }),
    signal: AbortSignal.timeout(20000),
  });

  const payload = (await response.json().catch(() => null)) as
    | { choices?: Array<{ message?: { content?: string } }> }
    | { error?: { message?: string } }
    | null;

  return {
    ok: response.ok,
    message: response.ok
      ? `Codex 可用，测试模型：${discoveredModel}`
      : extractErrorMessage(payload) ?? `消息测试失败（HTTP ${response.status}）`,
    statusCode: response.status,
    testedAt: new Date().toISOString(),
    discoveredModel,
    discoveredModels: discovered.ids,
  };
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

export async function importManagedKeys(raw: string) {
  const entries = parseManagedKeys(raw);
  const newKeyIds: string[] = [];

  for (const entry of entries) {
    const existing = await prisma.managedKey.findUnique({
      where: { fingerprint: entry.fingerprint },
    });

    const data = mergeExistingWithParsed(existing, entry);

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
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
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
  const [anthropicResult, openAiResult] = await Promise.all([
    runProtocolTest(listItem, "anthropic"),
    runProtocolTest(listItem, "openai"),
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

  const nextModel = key.model ?? result.discoveredModel;

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
