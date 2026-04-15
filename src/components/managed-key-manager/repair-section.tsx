import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GlobalConfig, ManagedKeyListItem } from "@/features/managed-keys/types";

export function RepairSection({
  repairInput,
  repairMaxCandidates,
  setRepairMaxCandidates,
  repairKeyId,
  setRepairKeyId,
  repairModel,
  setRepairModel,
  repairCustomPrompt,
  setRepairCustomPrompt,
  availableClaudeKeys,
  globalConfig,
  isRepairing,
  repairCandidates,
  repairValidCandidates,
  repairTestResults,
  onRepair,
  onCancel,
  onInputChange,
}: {
  repairInput: string;
  repairMaxCandidates: string;
  setRepairMaxCandidates: (value: string) => void;
  repairKeyId: string;
  setRepairKeyId: (value: string) => void;
  repairModel: string;
  setRepairModel: (value: string) => void;
  repairCustomPrompt: string;
  setRepairCustomPrompt: (value: string) => void;
  availableClaudeKeys: ManagedKeyListItem[];
  globalConfig: GlobalConfig;
  isRepairing: boolean;
  repairCandidates: string[];
  repairValidCandidates: string[];
  repairTestResults: Array<{ candidate: string; status: "testing" | "success" | "failed" }>;
  onRepair: () => void;
  onCancel: () => void;
  onInputChange: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm space-y-3">
      <div>
        <h3 className="text-sm font-semibold mb-1">修复损坏的 Key</h3>
        <p className="text-xs text-muted-foreground">
          输入包含异常字符的损坏 key（如中文、特殊符号等），系统会自动尝试替换并测试可用性。
        </p>
      </div>
      <Input
        value={repairInput}
        onChange={(event) => onInputChange(event.target.value)}
        placeholder="例如：sk-AWFh观察者V8ErJswxnk56mKn14W8X9qqfh8RjHZAhX0lqJ5XcH"
        className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm font-mono outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50"
      />
      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1">
          <span className="text-xs font-medium text-foreground/60">使用的 Key（可选）</span>
          <Select
            value={repairKeyId}
            onValueChange={(value) => {
              setRepairKeyId(value ?? "");
              localStorage.setItem("repair_keyId", value ?? "");
            }}
          >
            <SelectTrigger className="h-8 rounded-md px-2 text-sm">
              <SelectValue>
                {repairKeyId
                  ? availableClaudeKeys.find((k) => k.id === repairKeyId)?.name ?? "自动选择"
                  : "自动选择"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">自动选择</SelectItem>
              {availableClaudeKeys.map((key) => (
                <SelectItem key={key.id} value={key.id}>
                  {key.name} ({key.maskedSecret})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-foreground/60">使用的模型（可选）</span>
          <Select
            value={repairModel}
            onValueChange={(value) => {
              setRepairModel(value ?? "");
              localStorage.setItem("repair_model", value ?? "");
            }}
          >
            <SelectTrigger className="h-8 rounded-md px-2 text-sm">
              <SelectValue placeholder="自动选择" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">自动选择</SelectItem>
              {globalConfig?.preferredModels.map((model) => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-foreground/60">候选数量</span>
          <Input
            value={repairMaxCandidates}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "" || (/^\d+$/.test(value) && Number.parseInt(value, 10) >= 1 && Number.parseInt(value, 10) <= 200)) {
                setRepairMaxCandidates(value);
                localStorage.setItem("repair_maxCandidates", value);
              }
            }}
            placeholder="50"
            className="h-8 rounded-md px-2 text-sm"
          />
        </label>
      </div>
      <label className="space-y-1 mb-2">
        <span className="text-xs font-medium text-foreground/60">自定义提示符（可选）</span>
        <Input
          value={repairCustomPrompt}
          onChange={(event) => {
            setRepairCustomPrompt(event.target.value);
            localStorage.setItem("repair_customPrompt", event.target.value);
          }}
          placeholder="留空则使用默认提示符。可以自定义推断规则，例如：需要 2 位小写字母..."
          className="h-8 rounded-md px-2 text-sm"
        />
      </label>
      <div className="mt-3 flex justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={isRepairing}
        >
          取消
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onRepair}
          disabled={isRepairing || !repairInput.trim()}
        >
          {isRepairing ? "修复中..." : "开始修复"}
        </Button>
      </div>
      {repairValidCandidates.length > 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-emerald-800">✓ 修复成功</h4>
            <span className="text-xs text-emerald-600 cursor-pointer">找到 {repairValidCandidates.length} 个可用候选</span>
          </div>
          <code className="block text-xs font-mono text-emerald-900 break-all">
            {(() => {
              const corruptedPart = repairInput.match(/[\u4e00-\u9fa5]+/)?.[0] || "";
              const repairedKey = repairInput.replace(corruptedPart, repairValidCandidates[0]);
              const beforeIndex = repairInput.indexOf(corruptedPart);
              const afterIndex = beforeIndex + repairValidCandidates[0].length;
              return (
                <>
                  {repairedKey.slice(0, beforeIndex)}
                  <span className="bg-emerald-600 text-white px-0.5 rounded">{repairValidCandidates[0]}</span>
                  {repairedKey.slice(afterIndex)}
                </>
              );
            })()}
          </code>
        </div>
      ) : repairTestResults.length > 0 ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-red-800">✗ 修复失败</h4>
              <span className="text-xs text-red-600">已测试 {repairTestResults.length} 个候选</span>
            </div>
            <p className="text-xs text-red-700">
              AI 生成了 {repairCandidates.length} 个候选字符，测试了 {repairTestResults.length} 个，但均未通过验证。建议检查 Base URL 是否正确，或尝试手动修复。
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-foreground/80">AI 生成的候选字符</h4>
              <span className="text-xs text-muted-foreground">共 {repairCandidates.length} 个</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {repairCandidates.map((candidate, index) => (
                <span
                  key={index}
                  className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-mono text-sky-700"
                >
                  {candidate}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : repairCandidates.length > 0 ? (
        <div className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-foreground/80">AI 生成的候选字符</h4>
            <span className="text-xs text-muted-foreground">共 {repairCandidates.length} 个</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {repairCandidates.map((candidate, index) => (
              <span
                key={index}
                className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-mono text-sky-700"
              >
                {candidate}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
