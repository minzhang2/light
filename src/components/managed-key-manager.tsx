"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import {
  DownloadIcon,
  FlaskConicalIcon,
  Settings2Icon,
  UploadIcon,
  WrenchIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/toast";
import type {
  GlobalConfig,
  ManagedKeyListItem,
} from "@/features/managed-keys/types";
import { compareManagedKeysForDisplay } from "@/features/managed-keys/utils";
import type { KeyFilter, EditDraft } from "./managed-key-manager/types";
import { GROUP_LABELS, BATCH_TEST_CONCURRENCY } from "./managed-key-manager/types";
import { buildKeyEnvCopyText, matchesKeyFilter } from "./managed-key-manager/utils";
import { ImportSection } from "./managed-key-manager/import-section";
import { SettingsSection } from "./managed-key-manager/settings-section";
import { RepairSection } from "./managed-key-manager/repair-section";
import { KeySection } from "./managed-key-manager/key-section";
import { useRepairFormState } from "./managed-key-manager/hooks";
import { createHandlers } from "./managed-key-manager/handlers";
import * as api from "./managed-key-manager/api";

export function ManagedKeyManager({
  initialKeys,
  initialConfig,
}: {
  initialKeys: ManagedKeyListItem[];
  initialConfig?: GlobalConfig;
}) {
  const { toast, dismiss } = useToast();
  const [keys, setKeys] = useState(initialKeys);
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig>(
    initialConfig ?? { preferredModels: [], exhaustiveModelTesting: false },
  );
  const [showSettings, setShowSettings] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState("");
  const [exhaustiveModelTestingDraft, setExhaustiveModelTestingDraft] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<KeyFilter>("all");
  const [rawImport, setRawImport] = useState("");
  const [importAsTestable, setImportAsTestable] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showPinned, setShowPinned] = useState(true);
  const [showNoTest, setShowNoTest] = useState(false);
  const [showAvailable, setShowAvailable] = useState(true);
  const [showOther, setShowOther] = useState(false);
  const [testingIds, setTestingIds] = useState<Record<string, boolean>>({});
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});
  const [editingIds, setEditingIds] = useState<Record<string, boolean>>({});
  const [editDrafts, setEditDrafts] = useState<Record<string, EditDraft>>({});
  const [isBatchTesting, setIsBatchTesting] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [showRepair, setShowRepair] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairCandidates, setRepairCandidates] = useState<string[]>([]);
  const [repairValidCandidates, setRepairValidCandidates] = useState<string[]>([]);
  const [repairRepairedKey, setRepairRepairedKey] = useState<string>("");
  const [repairTestResults, setRepairTestResults] = useState<Array<{ candidate: string; status: "testing" | "success" | "failed" }>>([]);
  const [repairHistory, setRepairHistory] = useState<string[]>([]);

  const repairForm = useRepairFormState();
  const hasTestingKeys = Object.keys(testingIds).length > 0;

  const handlers = createHandlers({
    keys,
    setKeys,
    setTestingIds,
    setSavingIds,
    setDeletingIds,
    setEditingIds,
    setEditDrafts,
    setDeleteTargetId,
    toast,
  });

  const filteredKeys = useMemo(() => {
    return keys.filter((key) => {
      if (!matchesKeyFilter(key, filter)) {
        return false;
      }

      if (!query.trim()) {
        return true;
      }

      const haystack = [
        key.name,
        key.baseUrl,
        key.model ?? "",
        key.maskedSecret,
        ...key.aliases,
        ...key.availableModels,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query.trim().toLowerCase());
    });
  }, [filter, keys, query]);

  const testableFilteredKeys = useMemo(() => {
    return filteredKeys.filter((key) => key.isTestable);
  }, [filteredKeys]);

  const availableClaudeKeys = useMemo(() => {
    return keys.filter(
      (key) =>
        key.isTestable &&
        key.lastTestStatus === "success" &&
        key.protocol === "anthropic",
    );
  }, [keys]);

  const availableKeys = useMemo(() => {
    return filteredKeys
      .filter((key) => key.isTestable && key.lastTestStatus === "success" && !key.isPinned)
      .sort(compareManagedKeysForDisplay);
  }, [filteredKeys]);

  const pinnedKeys = useMemo(() => {
    return filteredKeys
      .filter((key) => key.isPinned)
      .sort(compareManagedKeysForDisplay);
  }, [filteredKeys]);

  const noTestKeys = useMemo(() => {
    return filteredKeys
      .filter((key) => !key.isPinned && !key.isTestable)
      .sort(compareManagedKeysForDisplay);
  }, [filteredKeys]);

  const otherKeys = useMemo(() => {
    return filteredKeys
      .filter((key) => key.isTestable && key.lastTestStatus !== "success" && !key.isPinned)
      .sort(compareManagedKeysForDisplay);
  }, [filteredKeys]);

  const deleteTarget = useMemo(
    () => keys.find((key) => key.id === deleteTargetId) ?? null,
    [deleteTargetId, keys],
  );

  async function copyToClipboard(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast({ tone: "success", message: `${label} 已复制。` });
    } catch {
      toast({ tone: "error", message: `${label} 复制失败。` });
    }
  }

  async function handleImport() {
    if (!rawImport.trim()) {
      toast({ tone: "error", message: "请先粘贴原始 key 文本。" });
      return;
    }

    setIsImporting(true);

    try {
      const payload = await api.importKeys(rawImport, importAsTestable);

      if (!payload.keys) {
        throw new Error("导入失败：未返回 keys 数据");
      }

      setKeys(payload.keys);
      setRawImport("");
      setShowImport(false);
      toast({
        tone: "success",
        message: payload.message ?? `已导入 ${payload.keys.length} 条 key。`,
      });

      const untestedIds = (payload.newKeyIds ?? []).filter(
        (id) => payload.keys!.find((k) => k.id === id)?.isTestable,
      );

      if (untestedIds.length > 0) {
        let autoProgressId: string | null = toast({ tone: "info", duration: 0, message: `正在自动测试 ${untestedIds.length} 个新导入的 key…` });
        let autoSuccess = 0;
        let autoFail = 0;
        let autoDone = 0;
        const queue = [...untestedIds];
        async function runWorker() {
          while (queue.length > 0) {
            const id = queue.shift();
            if (!id) return;
            const ok = await handlers.handleTest(id);
            autoDone += 1;
            if (ok) autoSuccess += 1; else autoFail += 1;
            if (autoProgressId) dismiss(autoProgressId);
            autoProgressId = toast({ tone: "info", duration: 0, message: `自动测试中：${autoDone} / ${untestedIds.length}，可用 ${autoSuccess}，失败 ${autoFail}。` });
          }
        }
        void Promise.all(
          Array.from({ length: Math.min(BATCH_TEST_CONCURRENCY, untestedIds.length) }, () => runWorker()),
        ).then(() => {
          if (autoProgressId) dismiss(autoProgressId);
          toast({ tone: autoFail > 0 ? "info" : "success", message: `自动测试完成：${autoSuccess} 个可用，${autoFail} 个失败。` });
        });
      }
    } catch (error) {
      toast({
        tone: "error",
        message: error instanceof Error ? error.message : "导入失败。",
      });
    } finally {
      setIsImporting(false);
    }
  }

  async function handleExportAll() {
    if (isExporting) {
      return;
    }

    setIsExporting(true);

    try {
      const text = await api.exportKeys();
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

      anchor.href = url;
      anchor.download = `managed-keys-${timestamp}.txt`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);

      toast({
        tone: "success",
        message: `已导出 ${keys.length} 条 key。`,
      });
    } catch (error) {
      toast({
        tone: "error",
        message: error instanceof Error ? error.message : "导出失败。",
      });
    } finally {
      setIsExporting(false);
    }
  }

  async function handleSaveSettings() {
    setIsSavingSettings(true);

    try {
      const preferredModels = settingsDraft
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = await api.updateGlobalConfig({
        preferredModels,
        exhaustiveModelTesting: exhaustiveModelTestingDraft,
      });

      if (!payload.config) {
        throw new Error("保存失败：未返回配置数据");
      }

      setGlobalConfig(payload.config);
      setShowSettings(false);
      toast({ tone: "success", message: "全局配置已保存。" });
    } catch (error) {
      toast({
        tone: "error",
        message: error instanceof Error ? error.message : "保存失败。",
      });
    } finally {
      setIsSavingSettings(false);
    }
  }

  const handleSaveShortcut = useEffectEvent(() => {
    if (showSettings && !isSavingSettings) {
      void handleSaveSettings();
      return;
    }

    const editableIds = keys
      .map((key) => key.id)
      .filter((id) => Boolean(editingIds[id]) && !savingIds[id] && !deletingIds[id] && !testingIds[id]);

    if (editableIds.length === 0) {
      return;
    }

    void Promise.all(editableIds.map((id) => handlers.handleSaveEdit(id, editDrafts)));
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) {
        return;
      }

      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey || event.key.toLowerCase() !== "s") {
        return;
      }

      event.preventDefault();
      handleSaveShortcut();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  async function handleRepairKey() {
    if (!repairForm.repairInput.trim()) {
      toast({ tone: "error", message: "请输入损坏的 key。" });
      return;
    }

    setIsRepairing(true);
    setRepairCandidates([]);
    setRepairValidCandidates([]);
    setRepairRepairedKey("");
    setRepairTestResults([]);

    try {
      const payload = await api.repairKey({
        corruptedKey: repairForm.repairInput.trim(),
        baseUrl: repairForm.repairBaseUrl,
        protocol: repairForm.repairProtocol,
        keyId: repairForm.repairKeyId || undefined,
        model: repairForm.repairModel || undefined,
        customPrompt: repairForm.repairCustomPrompt.trim() || undefined,
        previousCandidates: repairHistory,
        maxCandidates: Number.parseInt(repairForm.repairMaxCandidates, 10) || 50,
      });

      if (payload.candidates && payload.candidates.length > 0) {
        setRepairCandidates(payload.candidates);
        setRepairHistory((prev) => [...prev, ...payload.candidates!]);
      }

      if (payload.validCandidates && payload.validCandidates.length > 0) {
        setRepairValidCandidates(payload.validCandidates);
      }

      if (payload.repairedKey) {
        setRepairRepairedKey(payload.repairedKey);
      }

      if (payload.testResults && payload.testResults.length > 0) {
        setRepairTestResults(payload.testResults);
      }

      if (payload.success && payload.repairedKey) {
        await navigator.clipboard.writeText(payload.repairedKey);
        toast({
          tone: "success",
          message: payload.message || `修复成功！已复制到剪贴板。`,
        });
        repairForm.setRepairInput("");
        setRepairHistory([]);
      } else {
        toast({
          tone: "error",
          message: payload.message ?? "未能修复 key。",
        });
      }
    } catch (error) {
      toast({
        tone: "error",
        message: error instanceof Error ? error.message : "修复失败。",
      });
    } finally {
      setIsRepairing(false);
    }
  }

  async function handleBatchTest() {
    if (testableFilteredKeys.length === 0 || isBatchTesting) {
      return;
    }

    setIsBatchTesting(true);

    let successCount = 0;
    let failureCount = 0;
    let completedCount = 0;

    const queue = [...testableFilteredKeys];
    let progressToastId: string | null = null;

    async function runWorker() {
      while (queue.length > 0) {
        const item = queue.shift();

        if (!item) {
          return;
        }

        const ok = await handlers.handleTest(item.id);
        completedCount += 1;

        if (ok) {
          successCount += 1;
        } else {
          failureCount += 1;
        }

        if (progressToastId) dismiss(progressToastId);
        progressToastId = toast({
          tone: "info",
          duration: 0,
          message: `测试中：${completedCount} / ${testableFilteredKeys.length}，可用 ${successCount}，失败 ${failureCount}。`,
        });
      }
    }

    try {
      progressToastId = toast({
        tone: "info",
        duration: 0,
        message: `开始并发测试，共 ${testableFilteredKeys.length} 个可测试 key…`,
      });

      await Promise.all(
        Array.from({
          length: Math.min(BATCH_TEST_CONCURRENCY, testableFilteredKeys.length),
        }, () => runWorker()),
      );

      if (progressToastId) dismiss(progressToastId);
      toast({
        tone: failureCount > 0 ? "info" : "success",
        message: `批量测试完成：${successCount} 个可用，${failureCount} 个失败。`,
      });
    } finally {
      setIsBatchTesting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      {/* Toolbar: search + filter + import toggle */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索名称、域名、模型..."
          className="h-8 md:max-w-[200px]"
        />
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "claude", "codex"] as const).map((item) => (
            <Button
              key={item}
              type="button"
              variant={filter === item ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(item)}
            >
              {item === "all"
                ? `全部 (${keys.length})`
                : `${GROUP_LABELS[item]} (${keys.filter((k) => matchesKeyFilter(k, item)).length})`}
            </Button>
          ))}
          <div className="ml-auto flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleBatchTest}
              disabled={testableFilteredKeys.length === 0 || isBatchTesting || hasTestingKeys}
            >
              <FlaskConicalIcon className="h-4 w-4" />
              {isBatchTesting ? "测试中..." : `测试 (${testableFilteredKeys.length})`}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportAll}
              disabled={keys.length === 0 || isExporting}
            >
              <DownloadIcon className="h-4 w-4" />
              {isExporting ? "导出中..." : `导出 (${keys.length})`}
            </Button>
            <Button
              type="button"
              variant={showImport ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setShowImport(!showImport);
                setShowRepair(false);
                setShowSettings(false);
              }}
            >
              <UploadIcon className="h-4 w-4" />
              导入
            </Button>
            <Button
              type="button"
              variant={showRepair ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setShowRepair(!showRepair);
                setShowImport(false);
                setShowSettings(false);
              }}
            >
              <WrenchIcon className="h-4 w-4" />
              修复
            </Button>
            <Button
              type="button"
              variant={showSettings ? "default" : "outline"}
              size="sm"
              onClick={() => {
                if (!showSettings) {
                  setSettingsDraft((globalConfig?.preferredModels ?? []).join(", "));
                  setExhaustiveModelTestingDraft(
                    globalConfig?.exhaustiveModelTesting ?? false,
                  );
                }
                setShowSettings(!showSettings);
                setShowImport(false);
                setShowRepair(false);
              }}
            >
              <Settings2Icon className="h-4 w-4" />
              设置
            </Button>
          </div>
        </div>
      </div>

      {/* Collapsible import */}
      {showImport ? (
        <ImportSection
          rawImport={rawImport}
          setRawImport={setRawImport}
          importAsTestable={importAsTestable}
          setImportAsTestable={setImportAsTestable}
          isImporting={isImporting}
          onImport={handleImport}
        />
      ) : null}

      {/* Collapsible repair */}
      {showRepair ? (
        <RepairSection
          repairInput={repairForm.repairInput}
          repairMaxCandidates={repairForm.repairMaxCandidates}
          setRepairMaxCandidates={repairForm.setRepairMaxCandidates}
          repairKeyId={repairForm.repairKeyId}
          setRepairKeyId={repairForm.setRepairKeyId}
          repairModel={repairForm.repairModel}
          setRepairModel={repairForm.setRepairModel}
          repairCustomPrompt={repairForm.repairCustomPrompt}
          setRepairCustomPrompt={repairForm.setRepairCustomPrompt}
          availableClaudeKeys={availableClaudeKeys}
          globalConfig={globalConfig}
          isRepairing={isRepairing}
          repairCandidates={repairCandidates}
          repairValidCandidates={repairValidCandidates}
          repairRepairedKey={repairRepairedKey}
          repairTestResults={repairTestResults}
          onRepair={handleRepairKey}
          onCancel={() => {
            setShowRepair(false);
            setRepairCandidates([]);
            setRepairValidCandidates([]);
            setRepairRepairedKey("");
            setRepairTestResults([]);
            repairForm.setRepairCustomPrompt("");
            setRepairHistory([]);
          }}
          onInputChange={(value) => {
            repairForm.setRepairInput(value);
            localStorage.setItem("repair_key", value);
            setRepairHistory([]);
            setRepairCandidates([]);
            setRepairValidCandidates([]);
            setRepairTestResults([]);
          }}
        />
      ) : null}

      {/* Global settings */}
      {showSettings ? (
        <SettingsSection
          settingsDraft={settingsDraft}
          setSettingsDraft={setSettingsDraft}
          exhaustiveModelTestingDraft={exhaustiveModelTestingDraft}
          setExhaustiveModelTestingDraft={setExhaustiveModelTestingDraft}
          isSavingSettings={isSavingSettings}
          onSave={handleSaveSettings}
          onCancel={() => setShowSettings(false)}
        />
      ) : null}

      {/* Key list */}
      {filteredKeys.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          没有找到任何 key。
        </div>
      ) : (
        <div className="space-y-4">
          <KeySection
            title="置顶 Key"
            description={`手动置顶：${pinnedKeys.length}`}
            keys={pinnedKeys}
            isExpanded={showPinned}
            onToggleExpanded={() => setShowPinned((current) => !current)}
            deletingIds={deletingIds}
            testingIds={testingIds}
            editingIds={editingIds}
            savingIds={savingIds}
            isBatchTesting={isBatchTesting}
            editDrafts={editDrafts}
            onCopyKey={(secret) => copyToClipboard(secret, "Key")}
            onCopyEnv={(keyId) => {
              const key = keys.find((k) => k.id === keyId);
              if (key) copyToClipboard(buildKeyEnvCopyText(key), "环境变量");
            }}
            onDelete={setDeleteTargetId}
            onTest={handlers.handleTest}
            onTogglePinned={handlers.handleTogglePinned}
            onToggleTestable={handlers.handleToggleTestable}
            onStartEdit={handlers.startEditing}
            onCancelEdit={handlers.cancelEditing}
            onChangeEditDraft={handlers.updateEditDraft}
            onSaveEdit={(id) => handlers.handleSaveEdit(id, editDrafts)}
          />

          <KeySection
            title="禁止测试 Key"
            description={`已禁止测试：${noTestKeys.length}`}
            keys={noTestKeys}
            isExpanded={showNoTest}
            onToggleExpanded={() => setShowNoTest((current) => !current)}
            deletingIds={deletingIds}
            testingIds={testingIds}
            editingIds={editingIds}
            savingIds={savingIds}
            isBatchTesting={isBatchTesting}
            editDrafts={editDrafts}
            onCopyKey={(secret) => copyToClipboard(secret, "Key")}
            onCopyEnv={(keyId) => {
              const key = keys.find((k) => k.id === keyId);
              if (key) copyToClipboard(buildKeyEnvCopyText(key), "环境变量");
            }}
            onDelete={setDeleteTargetId}
            onTest={handlers.handleTest}
            onTogglePinned={handlers.handleTogglePinned}
            onToggleTestable={handlers.handleToggleTestable}
            onStartEdit={handlers.startEditing}
            onCancelEdit={handlers.cancelEditing}
            onChangeEditDraft={handlers.updateEditDraft}
            onSaveEdit={(id) => handlers.handleSaveEdit(id, editDrafts)}
          />

          <KeySection
            title="可用 Key"
            description={`已测试通过：${availableKeys.length}`}
            keys={availableKeys}
            isExpanded={showAvailable}
            onToggleExpanded={() => setShowAvailable((current) => !current)}
            deletingIds={deletingIds}
            testingIds={testingIds}
            editingIds={editingIds}
            savingIds={savingIds}
            isBatchTesting={isBatchTesting}
            editDrafts={editDrafts}
            onCopyKey={(secret) => copyToClipboard(secret, "Key")}
            onCopyEnv={(keyId) => {
              const key = keys.find((k) => k.id === keyId);
              if (key) copyToClipboard(buildKeyEnvCopyText(key), "环境变量");
            }}
            onDelete={setDeleteTargetId}
            onTest={handlers.handleTest}
            onTogglePinned={handlers.handleTogglePinned}
            onToggleTestable={handlers.handleToggleTestable}
            onStartEdit={handlers.startEditing}
            onCancelEdit={handlers.cancelEditing}
            onChangeEditDraft={handlers.updateEditDraft}
            onSaveEdit={(id) => handlers.handleSaveEdit(id, editDrafts)}
          />

          <KeySection
            title={availableKeys.length > 0 ? "不可用 / 未测试 Key" : "全部 Key"}
            description="包含测试失败和暂未测试的可测试 key。"
            keys={otherKeys}
            isExpanded={showOther}
            onToggleExpanded={() => setShowOther((current) => !current)}
            deletingIds={deletingIds}
            testingIds={testingIds}
            editingIds={editingIds}
            savingIds={savingIds}
            isBatchTesting={isBatchTesting}
            editDrafts={editDrafts}
            onCopyKey={(secret) => copyToClipboard(secret, "Key")}
            onCopyEnv={(keyId) => {
              const key = keys.find((k) => k.id === keyId);
              if (key) copyToClipboard(buildKeyEnvCopyText(key), "环境变量");
            }}
            onDelete={setDeleteTargetId}
            onTest={handlers.handleTest}
            onTogglePinned={handlers.handleTogglePinned}
            onToggleTestable={handlers.handleToggleTestable}
            onStartEdit={handlers.startEditing}
            onCancelEdit={handlers.cancelEditing}
            onChangeEditDraft={handlers.updateEditDraft}
            onSaveEdit={(id) => handlers.handleSaveEdit(id, editDrafts)}
          />
        </div>
      )}

      <AlertDialog
        open={Boolean(deleteTargetId)}
        onOpenChange={(open) => {
          if (!open && deleteTargetId && !deletingIds[deleteTargetId]) {
            setDeleteTargetId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除这个 key？</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? (
                <>
                  将删除 <span className="font-medium text-foreground">{deleteTarget.name}</span>
                  ，此操作不可撤销。
                </>
              ) : (
                "此操作不可撤销。"
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTargetId(null)}
              disabled={Boolean(deleteTargetId && deletingIds[deleteTargetId])}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (deleteTargetId) {
                  void handlers.handleDelete(deleteTargetId);
                }
              }}
              disabled={Boolean(deleteTargetId && deletingIds[deleteTargetId])}
            >
              {deleteTargetId && deletingIds[deleteTargetId] ? "删除中..." : "确认删除"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
