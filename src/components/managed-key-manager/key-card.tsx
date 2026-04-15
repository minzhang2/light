import { useState } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  FileCode2Icon,
  FlaskConicalIcon,
  FlaskConicalOffIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  Trash2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ManagedKeyListItem } from "@/features/managed-keys/types";
import type { EditDraft } from "./types";
import { StatusDot, TestMessage } from "./status-components";
import { AvailableModelTags } from "./model-tags";
import { getKeyAvailableModels, getSupportedProviders, formatDateTime } from "./utils";

function ActionIconButton({
  tooltip,
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button> & {
  tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="icon-lg"
            variant="outline"
            className={className ?? "size-8 rounded-[0.9rem] md:size-9 md:rounded-lg"}
            {...props}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

interface ManagedKeyCardProps {
  item: ManagedKeyListItem;
  isDeleting: boolean;
  isTesting: boolean;
  isEditing: boolean;
  isSaving: boolean;
  isBatchTesting: boolean;
  editDraft: EditDraft | null;
  onCopyKey: () => void;
  onCopyEnv: () => void;
  onDelete: () => void;
  onTest: () => void;
  onTogglePinned: () => void;
  onToggleTestable: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onChangeEditDraft: (patch: Partial<EditDraft>) => void;
  onSaveEdit: () => void;
}

export function ManagedKeyCard({
  item,
  isDeleting,
  isTesting,
  isEditing,
  isSaving,
  isBatchTesting,
  editDraft,
  onCopyKey,
  onCopyEnv,
  onDelete,
  onTest,
  onTogglePinned,
  onToggleTestable,
  onStartEdit,
  onCancelEdit,
  onChangeEditDraft,
  onSaveEdit,
}: ManagedKeyCardProps) {
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const visibleModels = getKeyAvailableModels(item);
  const supportedProviders = getSupportedProviders(item.lastTestMessage);
  const hasExpandableContent = visibleModels.length > 0 || !!item.lastTestMessage || isEditing;
  const expanded = isEditing || detailsExpanded;
  const editFieldClassName = "h-8 rounded-md px-2 text-sm";

  return (
    <article className="rounded-xl border border-border/70 bg-card shadow-sm overflow-hidden">
      {/* Main row */}
      <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="pt-1 md:pt-0">
            <StatusDot status={item.lastTestStatus} />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <h3 className="truncate text-sm font-semibold leading-5">{item.name}</h3>
                  {item.isPinned ? (
                    <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">顶</span>
                  ) : null}
                  {!item.isTestable ? (
                    <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">禁</span>
                  ) : null}
                  {supportedProviders.includes("anthropic") ? (
                    <span className="shrink-0 rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                      Claude
                    </span>
                  ) : null}
                  {supportedProviders.includes("openai") ? (
                    <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                      Codex
                    </span>
                  ) : null}
                </div>
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground md:hidden">
                {formatDateTime(item.lastTestAt)}
              </span>
            </div>
            <div className="grid gap-1 text-xs text-muted-foreground md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center md:gap-x-4">
              <a
                href={item.baseUrl}
                target="_blank"
                rel="noreferrer"
                className="truncate transition-colors hover:text-foreground hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {item.baseUrl}
              </a>
              <span className="truncate font-mono">{item.maskedSecret}</span>
              <span className="hidden shrink-0 text-right md:block md:w-20">
                {formatDateTime(item.lastTestAt)}
              </span>
            </div>
          </div>
        </div>
        <div className="grid w-full grid-cols-8 gap-1.5 sm:grid-cols-5 md:flex md:w-auto md:items-center md:justify-end md:gap-1">
          <ActionIconButton
            type="button"
            tooltip="复制 Key"
            onClick={onCopyKey}
          >
            <CopyIcon />
          </ActionIconButton>
          <ActionIconButton
            type="button"
            tooltip="复制环境变量"
            onClick={onCopyEnv}
          >
            <FileCode2Icon />
          </ActionIconButton>
          <ActionIconButton
            type="button"
            tooltip={isEditing ? "取消编辑" : "编辑"}
            onClick={isEditing ? onCancelEdit : onStartEdit}
            disabled={isDeleting || isTesting || isBatchTesting || isSaving}
          >
            <PencilIcon />
          </ActionIconButton>
          {isEditing ? (
            <ActionIconButton
              type="button"
              tooltip={isSaving ? "保存中..." : "保存"}
              onClick={onSaveEdit}
              disabled={isSaving}
            >
              <CheckIcon className="h-4 w-4" />
            </ActionIconButton>
          ) : (
            <ActionIconButton
              type="button"
              tooltip={!item.isTestable ? "已禁测" : isTesting ? "测试中..." : "测试"}
              onClick={onTest}
              disabled={!item.isTestable || isTesting || isBatchTesting || isSaving}
            >
              <FlaskConicalIcon />
            </ActionIconButton>
          )}
          <ActionIconButton
            type="button"
            tooltip={item.isPinned ? "取消置顶" : "置顶"}
            onClick={onTogglePinned}
            disabled={isDeleting || isTesting || isBatchTesting || isSaving}
          >
            {item.isPinned ? <PinOffIcon /> : <PinIcon />}
          </ActionIconButton>
          <ActionIconButton
            type="button"
            tooltip={item.isTestable ? "禁止测试" : "允许测试"}
            onClick={onToggleTestable}
            disabled={isDeleting || isTesting || isBatchTesting || isSaving}
          >
            {item.isTestable ? <FlaskConicalOffIcon /> : <FlaskConicalIcon />}
          </ActionIconButton>
          <ActionIconButton
            type="button"
            variant="destructive"
            tooltip={isDeleting ? "删除中..." : "删除"}
            onClick={onDelete}
            disabled={isDeleting || isBatchTesting || isEditing || isSaving}
          >
            <Trash2Icon />
          </ActionIconButton>
          {hasExpandableContent ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              className="size-8 justify-self-start rounded-[0.9rem] md:size-9 md:rounded-lg"
              onClick={() => setDetailsExpanded((v) => !v)}
              aria-label={expanded ? "收起" : "展开"}
            >
              {expanded ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Test message always visible when collapsed */}
      {!isEditing && !expanded && item.lastTestMessage ? (
        <div className="px-4 pb-2">
          <TestMessage message={item.lastTestMessage} status={item.lastTestStatus} />
        </div>
      ) : null}

      {/* Expandable detail section */}
      {expanded && (
        <div className="space-y-2.5 border-t border-border/70 px-4 py-2.5">
          {isEditing && editDraft ? (
            <div className="grid gap-2.5 md:grid-cols-3">
              <label className="space-y-0.5">
                <span className="text-xs font-medium text-foreground/60">名称</span>
                <Input
                  value={editDraft.name}
                  onChange={(event) => onChangeEditDraft({ name: event.target.value })}
                  placeholder="名称"
                  className={editFieldClassName}
                />
              </label>
              <label className="space-y-0.5">
                <span className="text-xs font-medium text-foreground/60">Base URL</span>
                <Input
                  value={editDraft.baseUrl}
                  onChange={(event) => onChangeEditDraft({ baseUrl: event.target.value })}
                  placeholder="https://api.example.com"
                  className={editFieldClassName}
                />
              </label>
              <label className="space-y-0.5">
                <span className="text-xs font-medium text-foreground/60">密钥</span>
                <Input
                  value={editDraft.secret}
                  onChange={(event) => onChangeEditDraft({ secret: event.target.value })}
                  placeholder="sk-..."
                  className={editFieldClassName}
                />
              </label>
              <label className="space-y-0.5">
                <span className="text-xs font-medium text-foreground/60">默认模型</span>
                <Input
                  value={editDraft.model}
                  onChange={(event) => onChangeEditDraft({ model: event.target.value })}
                  placeholder="如：claude-sonnet-4-5 或 gpt-4o"
                  className={editFieldClassName}
                />
              </label>
              <label className="space-y-0.5">
                <span className="text-xs font-medium text-foreground/60">启动模式</span>
                <Select
                  value={editDraft.launchCommand}
                  onValueChange={(value) =>
                    onChangeEditDraft({
                      launchCommand: value as EditDraft["launchCommand"],
                    })
                  }
                >
                  <SelectTrigger className={editFieldClassName}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="claude">claude</SelectItem>
                    <SelectItem value="codex">codex</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <div className="flex items-end justify-start pt-1 md:justify-end">
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={onCancelEdit} disabled={isSaving}>取消</Button>
                  <Button type="button" size="sm" onClick={onSaveEdit} disabled={isSaving}>{isSaving ? "保存中..." : "保存"}</Button>
                </div>
              </div>
            </div>
          ) : null}

          {!isEditing && item.model ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-foreground/50 font-medium">默认模型</span>
              <span className="text-muted-foreground">{item.model}</span>
            </div>
          ) : null}

          {!isEditing && visibleModels.length > 0 ? (
            <div>
              <p className="mb-1.5 text-xs font-medium text-foreground/60">可用模型</p>
              <AvailableModelTags models={visibleModels} />
            </div>
          ) : null}

          {!isEditing && item.lastTestMessage ? (
            <TestMessage message={item.lastTestMessage} status={item.lastTestStatus} />
          ) : null}
        </div>
      )}
    </article>
  );
}
