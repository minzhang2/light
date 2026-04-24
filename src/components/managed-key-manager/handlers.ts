import type { ManagedKeyListItem } from "@/features/managed-keys/types";
import type { EditDraft } from "./types";
import { inferLaunchCommand, mergeAvailableModels } from "./utils";
import * as api from "./api";

export interface HandlerDependencies {
  keys: ManagedKeyListItem[];
  setKeys: (keys: ManagedKeyListItem[] | ((prev: ManagedKeyListItem[]) => ManagedKeyListItem[])) => void;
  setTestingIds: (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
  setSavingIds: (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
  setDeletingIds: (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
  setEditingIds: (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
  setEditDrafts: (fn: (prev: Record<string, EditDraft>) => Record<string, EditDraft>) => void;
  setDeleteTargetId: (fn: (prev: string | null) => string | null) => void;
  toast: (input: { message: string; tone?: "success" | "error" | "info"; duration?: number }) => string;
}

export function createHandlers(deps: HandlerDependencies) {
  async function handleDuplicate(item: ManagedKeyListItem) {
    console.info("[managed-key-manager] duplicating key", {
      id: item.id,
      name: item.name,
    });

    deps.setSavingIds((current) => ({ ...current, [item.id]: true }));

    try {
      const payload = await api.duplicateKey(item.id);

      if (!payload.key || !payload.keys) {
        throw new Error("复制失败：未返回 key 数据");
      }

      deps.setKeys(payload.keys);
      deps.toast({
        tone: "success",
        message: payload.message ?? `已复制为 ${payload.key.name}。`,
      });
    } catch (error) {
      deps.toast({
        tone: "error",
        message: error instanceof Error ? error.message : "复制失败。",
      });
    } finally {
      deps.setSavingIds((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
    }
  }

  async function handleDelete(id: string) {
    deps.setDeletingIds((current) => ({ ...current, [id]: true }));

    try {
      const payload = await api.deleteKey(id);

      if (!payload.keys) {
        throw new Error("删除失败：未返回 keys 数据");
      }

      deps.setKeys(payload.keys);
      deps.setTestingIds((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      deps.setSavingIds((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      deps.setEditingIds((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      deps.setEditDrafts((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      deps.setDeleteTargetId((current) => (current === id ? null : current));
      deps.toast({ tone: "success", message: payload.message ?? "已删除。" });
    } catch (error) {
      deps.toast({
        tone: "error",
        message: error instanceof Error ? error.message : "删除失败。",
      });
    } finally {
      deps.setDeletingIds((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
  }

  function startEditing(key: ManagedKeyListItem) {
    deps.setEditingIds((current) => ({ ...current, [key.id]: true }));
    deps.setEditDrafts((current) => ({
      ...current,
      [key.id]: {
        name: key.name,
        secret: key.secret,
        baseUrl: key.baseUrl,
        model: key.model ?? "",
        launchCommand: inferLaunchCommand(key),
      },
    }));
  }

  function cancelEditing(id: string) {
    deps.setEditingIds((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    deps.setEditDrafts((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function updateEditDraft(id: string, patch: Partial<EditDraft>) {
    deps.setEditDrafts((current) => ({
      ...current,
      [id]: {
        ...current[id],
        ...patch,
      },
    }));
  }

  async function patchKey(
    id: string,
    patch: Partial<Pick<ManagedKeyListItem, "name" | "secret" | "baseUrl" | "model" | "launchCommand" | "isPinned" | "isTestable">>,
    fallbackMessage: string,
  ) {
    deps.setSavingIds((current) => ({ ...current, [id]: true }));

    try {
      const payload = await api.updateKey(id, patch);

      if (!payload.key) {
        throw new Error("更新失败：未返回 key 数据");
      }

      const updatedKey = payload.key;
      deps.setKeys((current) =>
        current.map((item) => (item.id === id ? updatedKey : item)),
      );
      deps.toast({
        tone: "success",
        message: payload.message ?? fallbackMessage,
      });
      return payload.key;
    } catch (error) {
      deps.toast({
        tone: "error",
        message: error instanceof Error ? error.message : "保存失败。",
      });
      return null;
    } finally {
      deps.setSavingIds((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
  }

  async function handleSaveEdit(id: string, editDrafts: Record<string, EditDraft>) {
    const draft = editDrafts[id];
    const currentKey = deps.keys.find((key) => key.id === id);

    if (!draft || !currentKey) {
      return;
    }

    const inferredLaunchCommand = inferLaunchCommand(currentKey);
    const nextLaunchCommand =
      currentKey.launchCommand === null &&
      draft.launchCommand === inferredLaunchCommand
        ? undefined
        : draft.launchCommand;

    const updated = await patchKey(
      id,
      {
        name: draft.name,
        secret: draft.secret,
        baseUrl: draft.baseUrl,
        model: draft.model.trim() || null,
        launchCommand: nextLaunchCommand,
      },
      "已保存。",
    );

    if (updated) {
      cancelEditing(id);
    }
  }

  async function handleTogglePinned(item: ManagedKeyListItem) {
    await patchKey(
      item.id,
      { isPinned: !item.isPinned },
      item.isPinned ? "已取消置顶。" : "已置顶到当前分区顶部。",
    );
  }

  async function handleToggleTestable(item: ManagedKeyListItem) {
    await patchKey(
      item.id,
      { isTestable: !item.isTestable },
      item.isTestable ? "已禁止该 key 测试。" : "已允许该 key 测试。",
    );
  }

  async function handleTest(id: string) {
    deps.setTestingIds((current) => ({ ...current, [id]: true }));

    try {
      const payload = await api.testKey(id);

      deps.setKeys((current) =>
        current.map((item) => {
          if (item.id !== id) {
            return item;
          }

          const validatedModels = payload.result?.validatedModels ?? [];
          const discoveredModel = payload.result?.discoveredModel ?? null;
          if (!payload.key) {
            return item;
          }

          const mergedAvailableModels = mergeAvailableModels(
            mergeAvailableModels(
              item.availableModels,
              payload.key.availableModels,
              payload.key.model,
            ),
            validatedModels,
            discoveredModel,
          );

          return {
            ...payload.key,
            model: payload.key.model ?? discoveredModel,
            availableModels: mergedAvailableModels,
          };
        }),
      );
      return payload.key?.lastTestStatus === "success";
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "测试失败。";
      deps.setKeys((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, lastTestStatus: "error" as const, lastTestMessage: errorMessage, lastTestAt: new Date().toISOString() }
            : item,
        ),
      );
      return false;
    } finally {
      deps.setTestingIds((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
  }

  return {
    handleDuplicate,
    handleDelete,
    startEditing,
    cancelEditing,
    updateEditDraft,
    handleSaveEdit,
    handleTogglePinned,
    handleToggleTestable,
    handleTest,
  };
}
