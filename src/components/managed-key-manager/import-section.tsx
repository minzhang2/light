import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export function ImportSection({
  rawImport,
  setRawImport,
  importAsTestable,
  setImportAsTestable,
  isImporting,
  onImport,
}: {
  rawImport: string;
  setRawImport: (value: string) => void;
  importAsTestable: boolean;
  setImportAsTestable: (value: boolean) => void;
  isImporting: boolean;
  onImport: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
      <Textarea
        value={rawImport}
        onChange={(event) => setRawImport(event.target.value)}
        placeholder="粘贴 export ... 文本，系统自动去重归类"
        className="min-h-32 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50"
      />
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/20 px-3 py-2">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">是否测试</Label>
            <p className="text-xs text-muted-foreground">
              关闭后导入的 key 会标记为禁测，且不会自动触发导入后测试。
            </p>
          </div>
          <Switch
            checked={importAsTestable}
            onCheckedChange={setImportAsTestable}
            aria-label="切换导入后是否测试"
          />
        </div>
        <Button type="button" onClick={onImport} disabled={isImporting}>
          {isImporting ? "导入中..." : "导入并合并"}
        </Button>
      </div>
    </div>
  );
}
