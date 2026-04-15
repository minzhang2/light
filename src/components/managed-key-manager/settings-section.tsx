import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function SettingsSection({
  settingsDraft,
  setSettingsDraft,
  exhaustiveModelTestingDraft,
  setExhaustiveModelTestingDraft,
  isSavingSettings,
  onSave,
  onCancel,
}: {
  settingsDraft: string;
  setSettingsDraft: (value: string) => void;
  exhaustiveModelTestingDraft: boolean;
  setExhaustiveModelTestingDraft: (value: boolean) => void;
  isSavingSettings: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm space-y-3">
      <h3 className="text-sm font-semibold">全局测试配置</h3>
      <label className="block space-y-1">
        <span className="text-xs font-medium text-foreground/60">优先测试模型（逗号分隔）</span>
        <Input
          value={settingsDraft}
          onChange={(event) => setSettingsDraft(event.target.value)}
          placeholder="如：claude-sonnet-4-5, gpt-4o"
        />
        <p className="text-xs text-muted-foreground">测试时优先使用列表中的模型，适用于所有 key。</p>
      </label>
      <div className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5">
        <div className="space-y-1">
          <Label className="text-sm font-medium">发现模型时逐个覆盖测试</Label>
          <p className="text-xs text-muted-foreground">
            关闭时只测试全局优先模型，其他模型仅扫描发现；开启后会继续把发现到的模型逐个测试。
          </p>
        </div>
        <Switch
          checked={exhaustiveModelTestingDraft}
          onCheckedChange={setExhaustiveModelTestingDraft}
          aria-label="切换逐个覆盖测试"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={isSavingSettings}>
          取消
        </Button>
        <Button type="button" size="sm" onClick={onSave} disabled={isSavingSettings}>
          {isSavingSettings ? "保存中..." : "保存"}
        </Button>
      </div>
    </div>
  );
}
