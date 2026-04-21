import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { GlobalConfig } from "@/features/managed-keys/types";
import {
  buildManagedKeyTestCacheResetData,
  parseJsonArray,
  parseBooleanValue,
  normalizeModelConfig,
} from "./utils";

function areStringArraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
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
  const currentConfig = await getGlobalConfig();
  const nextPreferredModels =
    config.preferredModels !== undefined
      ? normalizeModelConfig(config.preferredModels)
      : currentConfig.preferredModels;
  const nextExhaustiveModelTesting =
    config.exhaustiveModelTesting !== undefined
      ? Boolean(config.exhaustiveModelTesting)
      : currentConfig.exhaustiveModelTesting;
  const shouldInvalidateTestCache =
    (config.preferredModels !== undefined &&
      !areStringArraysEqual(currentConfig.preferredModels, nextPreferredModels)) ||
    (config.exhaustiveModelTesting !== undefined &&
      currentConfig.exhaustiveModelTesting !== nextExhaustiveModelTesting);

  if (config.preferredModels !== undefined) {
    await prisma.appConfig.upsert({
      where: { key: "preferredModels" },
      create: {
        key: "preferredModels",
        value: JSON.stringify(nextPreferredModels),
      },
      update: {
        value: JSON.stringify(nextPreferredModels),
      },
    });
  }

  if (config.exhaustiveModelTesting !== undefined) {
    await prisma.appConfig.upsert({
      where: { key: "exhaustiveModelTesting" },
      create: {
        key: "exhaustiveModelTesting",
        value: JSON.stringify(nextExhaustiveModelTesting),
      },
      update: {
        value: JSON.stringify(nextExhaustiveModelTesting),
      },
    });
  }

  if (shouldInvalidateTestCache) {
    await prisma.managedKey.updateMany({
      data: buildManagedKeyTestCacheResetData(),
    });
  }

  return {
    preferredModels: nextPreferredModels,
    exhaustiveModelTesting: nextExhaustiveModelTesting,
  };
}

export function isUnknownUpdateArgumentError(error: unknown, argument: string) {
  return (
    error instanceof Prisma.PrismaClientValidationError &&
    error.message.includes(`Unknown argument \`${argument}\``)
  );
}

export function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
