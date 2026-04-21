import { useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ManagedKeyListItem } from "@/features/managed-keys/types";
import { normalizeProviderLabels } from "./utils";

interface TestMessageProps {
  message: string;
  status: ManagedKeyListItem["lastTestStatus"];
}

export function TestMessage({ message, status }: TestMessageProps) {
  const [expanded, setExpanded] = useState(false);
  const normalizedMessage = normalizeProviderLabels(message);
  const isCollapsible =
    normalizedMessage.length > 120 || normalizedMessage.includes("\n");
  const toneClassName =
    status === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "error"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-border bg-muted/50 text-muted-foreground";

  const lines = normalizedMessage.split("\n");

  function renderHighlightedLine(line: string, lineIndex: number) {
    const parts = line
      .split(
        /((?:^|[，,]\s*)[^，,\n]*（(?:失败\/?\d*|验证失败|错误)）)/g,
      )
      .filter(Boolean);

    return (
      <span key={`${lineIndex}-${line}`} className="block">
        {parts.map((part, partIndex) => {
          const failureMatch = part.match(
            /^([，,]?\s*)([^，,\n]*（(?:失败\/?\d*|验证失败|错误)）)(.*)$/,
          );

          if (!failureMatch) {
            return <span key={`${lineIndex}-${partIndex}`}>{part}</span>;
          }

          return (
            <span key={`${lineIndex}-${partIndex}`}>
              {failureMatch[1]}
              <span className="text-red-600">{failureMatch[2]}</span>
              {failureMatch[3]}
            </span>
          );
        })}
      </span>
    );
  }

  function renderHighlightedInline(text: string) {
    return renderHighlightedLine(text.replace(/\n+/g, " "), 0);
  }

  return (
    <div className={`rounded-lg border px-3 py-2 text-xs ${toneClassName}`}>
      {expanded || !isCollapsible ? (
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 break-all whitespace-pre-wrap">
            {lines.map((line, index) => renderHighlightedLine(line, index))}
          </div>
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
          <div className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
            {renderHighlightedInline(normalizedMessage)}
          </div>
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

export function StatusDot({ status }: { status: ManagedKeyListItem["lastTestStatus"] }) {
  const className =
    status === "success"
      ? "bg-emerald-500"
      : status === "error"
        ? "bg-red-500"
        : "bg-muted-foreground/40";

  return <span className={`inline-block h-2 w-2 rounded-full ${className}`} />;
}
