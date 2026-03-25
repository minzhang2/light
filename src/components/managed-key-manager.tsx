"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  DownloadIcon,
  PencilIcon,
  EyeIcon,
  EyeOffIcon,
  FileCode2Icon,
  FlaskConicalIcon,
  FlaskConicalOffIcon,
  PinIcon,
  PinOffIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  ManagedKeyListItem,
  ManagedKeyTestResult,
  ManagedKeyUpdateInput,
} from "@/features/managed-keys/types";

type KeyFilter = "all" | "claude" | "codex";

type Notice = {
  tone: "success" | "error" | "info";
  message: string;
};

type EditDraft = {
  name: string;
  secret: string;
  baseUrl: string;
  model: string;
  launchCommand: "claude" | "codex" | "";
};

const GROUP_LABELS = {
  claude: "Claude",
  codex: "Codex",
} as const;

const BATCH_TEST_CONCURRENCY = 5;
const EMPTY_LAUNCH_COMMAND = "__none__";

function getKeyAvailableModels(key: ManagedKeyListItem) {
  const models = new Set<string>();

  for (const model of key.availableModels) {
    if (model) {
      models.add(model);
    }
  }

  if (key.model) {
    models.add(key.model);
  }

  return [...models];
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

function compareKeysForDisplay(a: ManagedKeyListItem, b: ManagedKeyListItem) {
  if (a.isPinned !== b.isPinned) {
    return a.isPinned ? -1 : 1;
  }

  return 0;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "未测试";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getToneClassName(tone: Notice["tone"]) {
  if (tone === "success") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (tone === "error") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-sky-200 bg-sky-50 text-sky-700";
}

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

function StatusDot({ status }: { status: ManagedKeyListItem["lastTestStatus"] }) {
  const className =
    status === "success"
      ? "bg-emerald-500"
      : status === "error"
        ? "bg-red-500"
        : "bg-muted-foreground/40";

  return <span className={`inline-block h-2 w-2 rounded-full ${className}`} />;
}

function TestMessage({
  message,
  status,
}: {
  message: string;
  status: ManagedKeyListItem["lastTestStatus"];
}) {
  const [expanded, setExpanded] = useState(false);
  const isCollapsible = message.length > 120 || message.includes("\n");
  const toneClassName =
    status === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "error"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-border bg-muted/50 text-muted-foreground";

  return (
    <div className={`rounded-lg border px-3 py-2 text-xs ${toneClassName}`}>
      {expanded || !isCollapsible ? (
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 break-all whitespace-pre-wrap">{message}</p>
          {isCollapsible ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="-mr-1 mt-0.5 shrink-0 rounded-full"
              aria-label="收起日志"
              onClick={() => setExpanded(false)}
            >
              <ChevronUpIcon className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <p className="min-w-0 flex-1 truncate">{message}</p>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="-mr-1 shrink-0 rounded-full"
            aria-label="展开日志"
            onClick={() => setExpanded(true)}
          >
            <ChevronDownIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

function SearchableModelFilter({
  models,
  value,
  onChange,
  placeholder,
  emptyLabel,
  className,
  compact = false,
}: {
  models: string[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder: string;
  emptyLabel?: string;
  className?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();

  const filteredModels = useMemo(() => {
    if (!normalizedQuery) {
      return models;
    }

    return models.filter((model) =>
      model.toLowerCase().includes(normalizedQuery),
    );
  }, [models, normalizedQuery]);

  const triggerLabel = value ?? placeholder;

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setQuery("");
        }
      }}
    >
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size={compact ? "sm" : "default"}
            className={className}
          />
        }
      >
        <span className="min-w-0 truncate text-left">{triggerLabel}</span>
        <ChevronDownIcon className="ml-auto h-4 w-4 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[min(360px,calc(100vw-2rem))] gap-2 p-2"
      >
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索模型..."
            className="pl-9"
          />
        </div>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            <XIcon className="h-3.5 w-3.5" />
            清除筛选
          </Button>
        ) : null}
        <div className="max-h-64 overflow-y-auto">
          {filteredModels.length > 0 ? (
            <div className="space-y-1">
              {filteredModels.map((model) => {
                const active = value === model;

                return (
                  <button
                    key={model}
                    type="button"
                    onClick={() => {
                      onChange(active ? null : model);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors ${
                      active
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    <span className="min-w-0 flex-1 break-all">{model}</span>
                    {active ? <CheckIcon className="h-4 w-4 shrink-0" /> : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-2 py-3 text-sm text-muted-foreground">
              {emptyLabel ?? "没有匹配的模型。"}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AvailableModelTags({
  models,
  effectiveModelFilter,
  onToggleModelFilter,
}: {
  models: string[];
  effectiveModelFilter: string | null;
  onToggleModelFilter: (model: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [collapsedHeight, setCollapsedHeight] = useState(0);
  const [expandedHeight, setExpandedHeight] = useState(0);
  const [isCollapsible, setIsCollapsible] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = contentRef.current;

    if (!element) {
      return;
    }

    const checkOverflow = () => {
      const chipElements = Array.from(element.children) as HTMLElement[];

      if (chipElements.length === 0) {
        setCollapsedHeight(0);
        setIsCollapsible(false);
        return;
      }

      const firstRowTop = chipElements[0].offsetTop;
      const firstRowBottom = chipElements.reduce((maxBottom, child) => {
        if (child.offsetTop !== firstRowTop) {
          return maxBottom;
        }

        return Math.max(maxBottom, child.offsetTop + child.offsetHeight);
      }, 0);

      setCollapsedHeight(firstRowBottom);
      setExpandedHeight(element.scrollHeight);
      setIsCollapsible(element.scrollHeight > firstRowBottom + 1);
    };

    checkOverflow();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(checkOverflow);
    observer.observe(element);

    return () => observer.disconnect();
  }, [models]);

  return (
    <div className="mt-2">
      <div
        className="relative overflow-hidden pr-12 transition-[max-height] duration-200 ease-out"
        style={{
          maxHeight: expanded ? `${expandedHeight || collapsedHeight}px` : `${collapsedHeight}px`,
        }}
      >
        <div ref={contentRef} className="flex flex-wrap gap-1.5">
          {models.map((model) => (
            <button
              key={model}
              type="button"
              onClick={() =>
                onToggleModelFilter(
                  effectiveModelFilter === model ? null : model,
                )
              }
              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                effectiveModelFilter === model
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              {model}
            </button>
          ))}
        </div>
        {isCollapsible ? (
          <div
            className={`pointer-events-none absolute top-0 right-1 flex items-start ${
              expanded
                ? ""
                : "bg-gradient-to-l from-card via-card to-transparent pl-8"
            }`}
            style={expanded ? undefined : { height: `${collapsedHeight}px` }}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="pointer-events-auto shrink-0 text-muted-foreground"
              aria-label={expanded ? "收起可用模型" : "展开可用模型"}
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? (
                <ChevronUpIcon className="h-3.5 w-3.5" />
              ) : (
                <ChevronDownIcon className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ManagedKeyCard({
  item,
  effectiveModelFilter,
  isRevealed,
  isDeleting,
  isTesting,
  isEditing,
  isSaving,
  isBatchTesting,
  editDraft,
  onToggleReveal,
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
  onToggleModelFilter,
}: {
  item: ManagedKeyListItem;
  effectiveModelFilter: string | null;
  isRevealed: boolean;
  isDeleting: boolean;
  isTesting: boolean;
  isEditing: boolean;
  isSaving: boolean;
  isBatchTesting: boolean;
  editDraft: EditDraft | null;
  onToggleReveal: () => void;
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
  onToggleModelFilter: (model: string | null) => void;
}) {
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const visibleModels = getKeyAvailableModels(item);
  const hasExpandableContent = visibleModels.length > 0 || !!item.lastTestMessage || isEditing;
  const expanded = isEditing || detailsExpanded;

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
              <span className="truncate font-mono">
                {isRevealed ? item.secret : item.maskedSecret}
              </span>
              <span className="hidden shrink-0 text-right md:block md:w-20">
                {formatDateTime(item.lastTestAt)}
              </span>
            </div>
          </div>
        </div>
        <div className="grid w-full grid-cols-9 gap-1.5 sm:grid-cols-6 md:flex md:w-auto md:items-center md:justify-end md:gap-1">
          <ActionIconButton
            type="button"
            tooltip={isRevealed ? "隐藏" : "显示"}
            onClick={onToggleReveal}
          >
            {isRevealed ? <EyeOffIcon /> : <EyeIcon />}
          </ActionIconButton>
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
        <div className="border-t border-border/70 px-4 py-3 space-y-3">
          {isEditing && editDraft ? (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-foreground/60">名称</span>
                  <Input
                    value={editDraft.name}
                    onChange={(event) => onChangeEditDraft({ name: event.target.value })}
                    placeholder="名称"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-foreground/60">Base URL</span>
                  <Input
                    value={editDraft.baseUrl}
                    onChange={(event) => onChangeEditDraft({ baseUrl: event.target.value })}
                    placeholder="https://api.example.com"
                  />
                </label>
              </div>
              <label className="space-y-1">
                <span className="text-xs font-medium text-foreground/60">密钥</span>
                <Input
                  value={editDraft.secret}
                  onChange={(event) => onChangeEditDraft({ secret: event.target.value })}
                  placeholder="sk-..."
                />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-foreground/60">默认模型</span>
                  <Input
                    value={editDraft.model}
                    onChange={(event) => onChangeEditDraft({ model: event.target.value })}
                    placeholder="可留空"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-foreground/60">启动命令</span>
                  <Select
                    value={editDraft.launchCommand || EMPTY_LAUNCH_COMMAND}
                    onValueChange={(value) =>
                      onChangeEditDraft({
                        launchCommand:
                          value === EMPTY_LAUNCH_COMMAND
                            ? ""
                            : (value as EditDraft["launchCommand"]),
                      })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EMPTY_LAUNCH_COMMAND}>无</SelectItem>
                      <SelectItem value="claude">claude</SelectItem>
                      <SelectItem value="codex">codex</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>协议：{item.protocol}</span>
                  <span>分组：{GROUP_LABELS[item.group]}</span>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={onCancelEdit} disabled={isSaving}>取消</Button>
                  <Button type="button" size="sm" onClick={onSaveEdit} disabled={isSaving}>{isSaving ? "保存中..." : "保存"}</Button>
                </div>
              </div>
            </div>
          ) : null}

          {!isEditing && item.model ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-foreground/50 font-medium">Model</span>
              <span className="text-muted-foreground">{item.model}</span>
            </div>
          ) : null}

          {!isEditing && visibleModels.length > 0 ? (
            <div>
              <p className="mb-1.5 text-xs font-medium text-foreground/60">可用模型</p>
              <AvailableModelTags
                models={visibleModels}
                effectiveModelFilter={
                  effectiveModelFilter && visibleModels.includes(effectiveModelFilter)
                    ? effectiveModelFilter
                    : null
                }
                onToggleModelFilter={onToggleModelFilter}
              />
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

export function ManagedKeyManager({
  initialKeys,
}: {
  initialKeys: ManagedKeyListItem[];
}) {
  const { toast } = useToast();
  const [keys, setKeys] = useState(initialKeys);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<KeyFilter>("claude");
  const [modelFilter, setModelFilter] = useState<string | null>(null);
  const [rawImport, setRawImport] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const [showAvailable, setShowAvailable] = useState(true);
  const [showOther, setShowOther] = useState(true);
  const [testingIds, setTestingIds] = useState<Record<string, boolean>>({});
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [editingIds, setEditingIds] = useState<Record<string, boolean>>({});
  const [editDrafts, setEditDrafts] = useState<Record<string, EditDraft>>({});
  const [isBatchTesting, setIsBatchTesting] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const hasTestingKeys = Object.keys(testingIds).length > 0;

  // Collect all available models for current group filter
  const availableModelOptions = useMemo(() => {
    const grouped = keys.filter(
      (key) => filter === "all" || key.group === filter,
    );
    const modelSet = new Set<string>();
    for (const key of grouped) {
      for (const model of getKeyAvailableModels(key)) {
        modelSet.add(model);
      }
    }
    return [...modelSet].sort();
  }, [keys, filter]);

  // Reset model filter when it's no longer valid
  const effectiveModelFilter =
    modelFilter && availableModelOptions.includes(modelFilter)
      ? modelFilter
      : null;

  const filteredKeys = useMemo(() => {
    return keys.filter((key) => {
      if (filter !== "all" && key.group !== filter) {
        return false;
      }

      if (effectiveModelFilter && !getKeyAvailableModels(key).includes(effectiveModelFilter)) {
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
  }, [effectiveModelFilter, filter, keys, query]);

  const testableFilteredKeys = useMemo(() => {
    return filteredKeys.filter((key) => key.isTestable);
  }, [filteredKeys]);

  const availableKeys = useMemo(() => {
    return filteredKeys
      .filter((key) => key.lastTestStatus === "success" && !key.isPinned)
      .sort(compareKeysForDisplay);
  }, [filteredKeys]);

  const pinnedKeys = useMemo(() => {
    return filteredKeys
      .filter((key) => key.isPinned)
      .sort(compareKeysForDisplay);
  }, [filteredKeys]);

  const otherKeys = useMemo(() => {
    return filteredKeys
      .filter((key) => key.lastTestStatus !== "success" && !key.isPinned)
      .sort(compareKeysForDisplay);
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
      setNotice({ tone: "error", message: "请先粘贴原始 key 文本。" });
      return;
    }

    setIsImporting(true);

    try {
      const response = await fetch("/api/keys/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ raw: rawImport }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { message?: string; keys?: ManagedKeyListItem[] }
        | null;

      if (!response.ok || !payload?.keys) {
        throw new Error(payload?.message ?? "导入失败。");
      }

      setKeys(payload.keys);
      setRawImport("");
      setShowImport(false);
      setNotice({
        tone: "success",
        message: payload.message ?? `已导入 ${payload.keys.length} 条 key。`,
      });
    } catch (error) {
      setNotice({
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
      const response = await fetch("/api/keys/export");

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;

        throw new Error(payload?.message ?? "导出失败。");
      }

      const text = await response.text();
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

      setNotice({
        tone: "success",
        message: `已导出 ${keys.length} 条 key。`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "导出失败。",
      });
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingIds((current) => ({ ...current, [id]: true }));

    try {
      const response = await fetch(`/api/keys/${id}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => null)) as
        | { message?: string; keys?: ManagedKeyListItem[] }
        | null;

      if (!response.ok || !payload?.keys) {
        throw new Error(payload?.message ?? "删除失败。");
      }

      setKeys(payload.keys);
      setRevealedIds((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setTestingIds((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setSavingIds((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setEditingIds((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setEditDrafts((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setDeleteTargetId((current) => (current === id ? null : current));
      setNotice({ tone: "success", message: payload.message ?? "已删除。" });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "删除失败。",
      });
    } finally {
      setDeletingIds((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
  }

  function startEditing(key: ManagedKeyListItem) {
    setEditingIds((current) => ({ ...current, [key.id]: true }));
    setEditDrafts((current) => ({
      ...current,
      [key.id]: {
        name: key.name,
        secret: key.secret,
        baseUrl: key.baseUrl,
        model: key.model ?? "",
        launchCommand: key.launchCommand ?? "",
      },
    }));
  }

  function cancelEditing(id: string) {
    setEditingIds((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setEditDrafts((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function updateEditDraft(id: string, patch: Partial<EditDraft>) {
    setEditDrafts((current) => ({
      ...current,
      [id]: {
        ...current[id],
        ...patch,
      },
    }));
  }

  async function patchKey(
    id: string,
    patch: ManagedKeyUpdateInput,
    fallbackMessage: string,
  ) {
    setSavingIds((current) => ({ ...current, [id]: true }));

    try {
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

      setKeys((current) =>
        current.map((item) => (item.id === id ? payload.key! : item)),
      );
      setNotice({
        tone: "success",
        message: payload.message ?? fallbackMessage,
      });
      return payload.key;
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "保存失败。",
      });
      return null;
    } finally {
      setSavingIds((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
  }

  async function handleSaveEdit(id: string) {
    const draft = editDrafts[id];

    if (!draft) {
      return;
    }

    const updated = await patchKey(
      id,
      {
        name: draft.name,
        secret: draft.secret,
        baseUrl: draft.baseUrl,
        model: draft.model.trim() || null,
        launchCommand: draft.launchCommand || null,
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
    setTestingIds((current) => ({ ...current, [id]: true }));

    try {
      const response = await fetch(`/api/keys/${id}/test`, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as
        | {
            message?: string;
            key?: ManagedKeyListItem;
            result?: ManagedKeyTestResult;
          }
        | null;

      if (!response.ok || !payload?.key) {
        const errorMessage = payload?.message ?? "测试失败。";
        setKeys((current) =>
          current.map((item) =>
            item.id === id
              ? { ...item, lastTestStatus: "error" as const, lastTestMessage: errorMessage, lastTestAt: new Date().toISOString() }
              : item,
          ),
        );
        return false;
      }

      setKeys((current) =>
        current.map((item) => {
          if (item.id !== id) {
            return item;
          }

          const discoveredModels = payload.result?.discoveredModels ?? [];
          const discoveredModel = payload.result?.discoveredModel ?? null;
          const mergedAvailableModels = mergeAvailableModels(
            mergeAvailableModels(
              item.availableModels,
              payload.key!.availableModels,
              payload.key!.model,
            ),
            discoveredModels,
            discoveredModel,
          );

          return {
            ...payload.key!,
            model: payload.key!.model ?? discoveredModel,
            availableModels: mergedAvailableModels,
          };
        }),
      );
      return payload.key.lastTestStatus === "success";
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "测试失败。";
      setKeys((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, lastTestStatus: "error" as const, lastTestMessage: errorMessage, lastTestAt: new Date().toISOString() }
            : item,
        ),
      );
      return false;
    } finally {
      setTestingIds((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
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

    async function runWorker() {
      while (queue.length > 0) {
        const item = queue.shift();

        if (!item) {
          return;
        }

        const ok = await handleTest(item.id);
        completedCount += 1;

        if (ok) {
          successCount += 1;
        } else {
          failureCount += 1;
        }

        setNotice({
          tone: "info",
          message: `并发测试中：${completedCount} / ${testableFilteredKeys.length}，可用 ${successCount}，失败 ${failureCount}。`,
        });
      }
    }

    try {
      setNotice({
        tone: "info",
        message: `开始并发测试，共 ${testableFilteredKeys.length} 个可测试 key，并发数 ${Math.min(BATCH_TEST_CONCURRENCY, testableFilteredKeys.length)}。`,
      });

      await Promise.all(
        Array.from({
          length: Math.min(BATCH_TEST_CONCURRENCY, testableFilteredKeys.length),
        }, () => runWorker()),
      );

      setNotice({
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
          className="h-10 md:max-w-xs"
        />
        <div className="flex gap-2">
          {(["all", "claude", "codex"] as const).map((item) => (
            <Button
              key={item}
              type="button"
              variant={filter === item ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setFilter(item);
                setModelFilter(null);
              }}
            >
              {item === "all"
                ? `全部 (${keys.length})`
                : `${GROUP_LABELS[item]} (${keys.filter((k) => k.group === item).length})`}
            </Button>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleBatchTest}
          disabled={testableFilteredKeys.length === 0 || isBatchTesting || hasTestingKeys}
        >
          <FlaskConicalIcon className="h-4 w-4" />
          {isBatchTesting ? "批量测试中..." : `一键测试 (${testableFilteredKeys.length})`}
        </Button>
        <div className="ml-auto flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportAll}
            disabled={keys.length === 0 || isExporting}
          >
            <DownloadIcon className="h-4 w-4" />
            {isExporting ? "导出中..." : `全部导出 (${keys.length})`}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowImport(!showImport)}
          >
            批量导入
            {showImport ? <ChevronUpIcon className="ml-1 h-4 w-4" /> : <ChevronDownIcon className="ml-1 h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Model sub-filter */}
      {availableModelOptions.length > 0 ? (
        <div className="rounded-2xl border border-border/70 bg-card p-3 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">模型筛选</p>
              <p className="text-xs text-muted-foreground">
                搜索并筛选当前列表中的可用模型
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SearchableModelFilter
                models={availableModelOptions}
                value={effectiveModelFilter}
                onChange={setModelFilter}
                placeholder={`选择模型 (${availableModelOptions.length})`}
                emptyLabel="没有匹配的模型筛选项。"
                className="min-w-56 justify-start"
              />
              {effectiveModelFilter ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 px-3 text-xs"
                  onClick={() => setModelFilter(null)}
                >
                  <XIcon className="h-3.5 w-3.5" />
                  清除筛选
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Notice */}
      {notice ? (
        <div
          className={`rounded-xl border px-4 py-2.5 text-sm ${getToneClassName(notice.tone)}`}
        >
          {notice.message}
        </div>
      ) : null}

      {/* Collapsible import */}
      {showImport ? (
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <textarea
            value={rawImport}
            onChange={(event) => setRawImport(event.target.value)}
            placeholder="粘贴 export ... 文本，系统自动去重归类"
            className="min-h-32 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50"
          />
          <div className="mt-2 flex justify-end">
            <Button
              type="button"
              onClick={handleImport}
              disabled={isImporting}
            >
              {isImporting ? "导入中..." : "导入并合并"}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Key list */}
      {filteredKeys.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          没有找到任何 key。
        </div>
      ) : (
        <div className="space-y-4">
          {pinnedKeys.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">置顶 Key</h2>
                  <p className="text-xs text-muted-foreground">
                    手动置顶：{pinnedKeys.length}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => setShowPinned((current) => !current)}
                >
                  {showPinned ? "收起" : "展开"}
                  {showPinned ? (
                    <ChevronUpIcon className="h-4 w-4" />
                  ) : (
                    <ChevronDownIcon className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {showPinned ? (
                <div className="flex flex-col gap-1.5">
                  {pinnedKeys.map((key) => (
                    <div key={key.id}>
                      <ManagedKeyCard
                        item={key}
                        effectiveModelFilter={effectiveModelFilter}
                        isRevealed={Boolean(revealedIds[key.id])}
                        isDeleting={Boolean(deletingIds[key.id])}
                        isTesting={Boolean(testingIds[key.id])}
                        isEditing={Boolean(editingIds[key.id])}
                        isSaving={Boolean(savingIds[key.id])}
                        isBatchTesting={isBatchTesting}
                        editDraft={editDrafts[key.id] ?? null}
                        onToggleReveal={() =>
                          setRevealedIds((current) => ({
                            ...current,
                            [key.id]: !current[key.id],
                          }))
                        }
                        onCopyKey={() => copyToClipboard(key.secret, "Key")}
                        onCopyEnv={() => copyToClipboard(key.copyText, "环境变量")}
                        onDelete={() => setDeleteTargetId(key.id)}
                        onTest={() => handleTest(key.id)}
                        onTogglePinned={() => handleTogglePinned(key)}
                        onToggleTestable={() => handleToggleTestable(key)}
                        onStartEdit={() => startEditing(key)}
                        onCancelEdit={() => cancelEditing(key.id)}
                        onChangeEditDraft={(patch) => updateEditDraft(key.id, patch)}
                        onSaveEdit={() => handleSaveEdit(key.id)}
                        onToggleModelFilter={setModelFilter}
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {availableKeys.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">可用 Key</h2>
                  <p className="text-xs text-muted-foreground">
                    已测试通过：{availableKeys.length}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => setShowAvailable((current) => !current)}
                >
                  {showAvailable ? "收起" : "展开"}
                  {showAvailable ? (
                    <ChevronUpIcon className="h-4 w-4" />
                  ) : (
                    <ChevronDownIcon className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {showAvailable ? (
                <div className="flex flex-col gap-1.5">
                  {availableKeys.map((key) => (
                    <div key={key.id}>
                      <ManagedKeyCard
                        item={key}
                        effectiveModelFilter={effectiveModelFilter}
                        isRevealed={Boolean(revealedIds[key.id])}
                        isDeleting={Boolean(deletingIds[key.id])}
                        isTesting={Boolean(testingIds[key.id])}
                        isEditing={Boolean(editingIds[key.id])}
                        isSaving={Boolean(savingIds[key.id])}
                        isBatchTesting={isBatchTesting}
                        editDraft={editDrafts[key.id] ?? null}
                        onToggleReveal={() =>
                          setRevealedIds((current) => ({
                            ...current,
                            [key.id]: !current[key.id],
                          }))
                        }
                        onCopyKey={() => copyToClipboard(key.secret, "Key")}
                        onCopyEnv={() => copyToClipboard(key.copyText, "环境变量")}
                        onDelete={() => setDeleteTargetId(key.id)}
                        onTest={() => handleTest(key.id)}
                        onTogglePinned={() => handleTogglePinned(key)}
                        onToggleTestable={() => handleToggleTestable(key)}
                        onStartEdit={() => startEditing(key)}
                        onCancelEdit={() => cancelEditing(key.id)}
                        onChangeEditDraft={(patch) => updateEditDraft(key.id, patch)}
                        onSaveEdit={() => handleSaveEdit(key.id)}
                        onToggleModelFilter={setModelFilter}
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {otherKeys.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    {availableKeys.length > 0 ? "不可用 / 未测试 Key" : "全部 Key"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    包含测试失败和暂未测试的 key。
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => setShowOther((current) => !current)}
                >
                  {showOther ? "收起" : "展开"}
                  {showOther ? (
                    <ChevronUpIcon className="h-4 w-4" />
                  ) : (
                    <ChevronDownIcon className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {showOther ? (
                <div className="flex flex-col gap-1.5">
                  {otherKeys.map((key) => (
                    <div key={key.id}>
                      <ManagedKeyCard
                        item={key}
                        effectiveModelFilter={effectiveModelFilter}
                        isRevealed={Boolean(revealedIds[key.id])}
                        isDeleting={Boolean(deletingIds[key.id])}
                        isTesting={Boolean(testingIds[key.id])}
                        isEditing={Boolean(editingIds[key.id])}
                        isSaving={Boolean(savingIds[key.id])}
                        isBatchTesting={isBatchTesting}
                        editDraft={editDrafts[key.id] ?? null}
                        onToggleReveal={() =>
                          setRevealedIds((current) => ({
                            ...current,
                            [key.id]: !current[key.id],
                          }))
                        }
                        onCopyKey={() => copyToClipboard(key.secret, "Key")}
                        onCopyEnv={() => copyToClipboard(key.copyText, "环境变量")}
                        onDelete={() => setDeleteTargetId(key.id)}
                        onTest={() => handleTest(key.id)}
                        onTogglePinned={() => handleTogglePinned(key)}
                        onToggleTestable={() => handleToggleTestable(key)}
                        onStartEdit={() => startEditing(key)}
                        onCancelEdit={() => cancelEditing(key.id)}
                        onChangeEditDraft={(patch) => updateEditDraft(key.id, patch)}
                        onSaveEdit={() => handleSaveEdit(key.id)}
                        onToggleModelFilter={setModelFilter}
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}
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
                  void handleDelete(deleteTargetId);
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
