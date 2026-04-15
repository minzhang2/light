import type {
  GlobalConfig,
  ManagedKeyListItem,
  ManagedKeyTestResult,
  ManagedKeyUpdateInput,
} from "@/features/managed-keys/types";

export async function importKeys(raw: string, isTestable: boolean) {
  const response = await fetch("/api/keys/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ raw, isTestable }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { message?: string; keys?: ManagedKeyListItem[]; newKeyIds?: string[] }
    | null;

  if (!response.ok || !payload?.keys) {
    throw new Error(payload?.message ?? "导入失败。");
  }

  return payload;
}

export async function exportKeys() {
  const response = await fetch("/api/keys/export");

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(payload?.message ?? "导出失败。");
  }

  return await response.text();
}

export async function deleteKey(id: string) {
  const response = await fetch(`/api/keys/${id}`, { method: "DELETE" });
  const payload = (await response.json().catch(() => null)) as
    | { message?: string; keys?: ManagedKeyListItem[] }
    | null;

  if (!response.ok || !payload?.keys) {
    throw new Error(payload?.message ?? "删除失败。");
  }

  return payload;
}

export async function updateKey(id: string, patch: ManagedKeyUpdateInput) {
  const response = await fetch(`/api/keys/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });

  const payload = (await response.json().catch(() => null)) as
    | { message?: string; key?: ManagedKeyListItem }
    | null;

  if (!response.ok || !payload?.key) {
    throw new Error(payload?.message ?? "保存失败。");
  }

  return payload;
}

export async function testKey(id: string) {
  const response = await fetch(`/api/keys/${id}/test`, { method: "POST" });
  const payload = (await response.json().catch(() => null)) as
    | {
        message?: string;
        key?: ManagedKeyListItem;
        result?: ManagedKeyTestResult;
      }
    | null;

  if (!response.ok || !payload?.key) {
    throw new Error(payload?.message ?? "测试失败。");
  }

  return payload;
}

export async function updateGlobalConfig(config: {
  preferredModels: string[];
  exhaustiveModelTesting: boolean;
}) {
  const response = await fetch("/api/keys/config", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(config),
  });

  const payload = (await response.json().catch(() => null)) as
    | { config?: GlobalConfig; message?: string }
    | null;

  if (!response.ok || !payload?.config) {
    throw new Error(payload?.message ?? "保存失败。");
  }

  return payload;
}

export async function repairKey(params: {
  corruptedKey: string;
  baseUrl: string;
  protocol: "anthropic" | "openai";
  keyId?: string;
  model?: string;
  customPrompt?: string;
  previousCandidates: string[];
  maxCandidates: number;
}) {
  const response = await fetch("/api/keys/repair", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        success?: boolean;
        repairedKey?: string;
        attempts?: number;
        message?: string;
        candidates?: string[];
        validCandidates?: string[];
        testResults?: Array<{ candidate: string; status: "testing" | "success" | "failed" }>;
      }
    | null;

  if (!response.ok || !payload) {
    throw new Error(payload?.message ?? "修复失败。");
  }

  return payload;
}
