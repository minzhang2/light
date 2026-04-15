import { useState } from "react";
import {
  CheckIcon,
  ClipboardIcon,
  FileIcon,
  ImageIcon,
  PaperclipIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ChatKeyOption } from "@/features/chat/types";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "./types";
import { parseMessageContent, inferAttachmentKind } from "./utils";

export function MessageActionButton({
  onClick,
  icon,
  label,
  disabled = false,
  destructive = false,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center transition-colors disabled:pointer-events-none disabled:opacity-50",
        destructive
          ? "text-destructive hover:text-destructive/80"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
    </button>
  );

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function MessageActions({
  children,
  align,
}: {
  children: React.ReactNode;
  align: "start" | "end";
}) {
  return <div className={cn("flex gap-1.5", align === "end" ? "justify-end" : "justify-start")}>{children}</div>;
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <MessageActionButton
      onClick={handleCopy}
      label={copied ? "已复制" : "复制"}
      icon={copied ? <CheckIcon className="h-[14px] w-[14px]" /> : <ClipboardIcon className="h-[14px] w-[14px]" />}
    />
  );
}

export function MessageContent({ message }: { message: ChatMessage }) {
  const parsed = parseMessageContent(message.content);
  const isUser = message.role === "user";
  const attachmentClassName = isUser ? "text-primary-foreground/72" : "text-muted-foreground";

  return (
    <div>
      {parsed.text ? (
        <p className="break-words whitespace-pre-wrap">{parsed.text}</p>
      ) : null}
      {parsed.attachments.length > 0 ? (
        <div className={cn("flex min-w-0 items-center gap-1.5 text-[11px]", attachmentClassName)}>
          {parsed.attachments.length === 1 && inferAttachmentKind(parsed.attachments[0]) === "图片" ? (
            <ImageIcon className="size-3 shrink-0" />
          ) : parsed.attachments.length === 1 ? (
            <FileIcon className="size-3 shrink-0" />
          ) : (
            <PaperclipIcon className="size-3 shrink-0" />
          )}
          <span className="min-w-0 truncate" title={parsed.attachments.join("、")}>
            {parsed.attachments.join("、")}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function FileChip({
  file,
  onRemove,
  disabled,
}: {
  file: File;
  onRemove: () => void;
  disabled: boolean;
}) {
  const isImage = file.type.startsWith("image/");

  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/70 bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
      <PaperclipIcon className="size-3 shrink-0" />
      <span className="truncate">{file.name}</span>
      <span className="shrink-0 text-[10px] uppercase text-foreground/45">
        {isImage ? "图片" : "文件"}
      </span>
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        className="size-5 rounded-full"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`移除 ${file.name}`}
      >
        <XIcon className="size-3" />
      </Button>
    </span>
  );
}

export function KeySupportBadges({
  keyOption,
  className,
}: {
  keyOption: ChatKeyOption;
  className?: string;
}) {
  const inferredClaude = keyOption.models.some((model) => /(claude|sonnet|opus|haiku)/i.test(model));
  const inferredCodex = keyOption.models.some((model) => !/(claude|sonnet|opus|haiku)/i.test(model));
  const showClaude =
    (typeof keyOption.supportsClaude === "boolean" ? keyOption.supportsClaude : false) ||
    inferredClaude ||
    keyOption.group === "claude";
  const showCodex =
    (typeof keyOption.supportsCodex === "boolean" ? keyOption.supportsCodex : false) ||
    inferredCodex ||
    keyOption.group === "codex";

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {showClaude ? (
        <span className="rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
          Claude
        </span>
      ) : null}
      {showCodex ? (
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
          Codex
        </span>
      ) : null}
    </span>
  );
}
