import { useState, useEffect, useRef } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AvailableModelTagsProps {
  models: string[];
}

export function AvailableModelTags({ models }: AvailableModelTagsProps) {
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
            <span
              key={model}
              className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
            >
              {model}
            </span>
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
