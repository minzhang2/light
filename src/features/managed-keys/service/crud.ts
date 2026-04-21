import type { ManagedKey } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildManagedKeyFingerprint,
  maskSecret,
  parseManagedKeys,
} from "@/features/managed-keys/parser";
import { normalizeBaseUrl } from "@/features/managed-keys/utils";
import type {
  ManagedKeyListItem,
  ManagedKeyUpdateInput,
  ParsedManagedKeyInput,
} from "@/features/managed-keys/types";
import {
  parseJsonRecord,
  parseJsonArray,
  buildManagedKeyTestCacheResetData,
  buildCopyText,
  buildExportText,
  stringifyAliases,
  stringifyExtraEnv,
  mergeAvailableModels,
} from "./utils";
import { isUniqueConstraintError, isUnknownUpdateArgumentError } from "./config";

export function toListItem(key: ManagedKey): ManagedKeyListItem {
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
      protocol: key.protocol as ManagedKeyListItem["protocol"],
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

export function mergeExistingWithParsed(
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

  const shouldResetTestCache =
    Boolean(existing) && existing?.fingerprint !== entry.fingerprint;

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
    ...(shouldResetTestCache ? buildManagedKeyTestCacheResetData() : {}),
    ...(typeof options?.isTestable === "boolean"
      ? { isTestable: options.isTestable }
      : {}),
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
  const shouldResetTestCache = existing.fingerprint !== nextFingerprint;

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
          ...(shouldResetTestCache ? buildManagedKeyTestCacheResetData() : {}),
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
        ...(shouldResetTestCache ? buildManagedKeyTestCacheResetData() : {}),
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

export async function testManagedKey(
  id: string,
  globalPreferredModels: string[],
  exhaustiveModelTesting: boolean,
  options?: { force?: boolean },
) {
  const key = await prisma.managedKey.findUnique({
    where: { id },
  });

  if (!key) {
    throw new Error("未找到对应的 key。");
  }

  if (!key.isTestable) {
    throw new Error("当前 key 已禁用测试。");
  }

  const { testManagedKeyWithCache } = await import("./test");
  const { result } = await testManagedKeyWithCache(
    key,
    toListItem,
    globalPreferredModels,
    exhaustiveModelTesting,
    options,
  );

  await prisma.managedKey.update({
    where: { id },
    data: {
      lastTestStatus: result.ok ? "success" : "error",
      lastTestMessage: result.message,
      lastTestAt: new Date(result.testedAt),
    },
  });

  const nextModel = result.discoveredModel ?? key.model;

  try {
    await prisma.managedKey.update({
      where: { id },
      data: {
        model: nextModel,
        availableModels: JSON.stringify(result.validatedModels),
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
    result.validatedModels,
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
