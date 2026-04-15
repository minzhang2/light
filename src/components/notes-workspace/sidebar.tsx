import { FilePlus2Icon, PinIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { NoteDocument } from "./types";
import { groupDocuments } from "./utils";

interface NotesSidebarProps {
  documents: NoteDocument[];
  activeId: string | null;
  referenceNow: number | null;
  busyAction: "creating" | "deleting" | null;
  onCreateDocument: () => void;
  onSelectDocument: (document: NoteDocument) => void;
  onTogglePinned: (document: NoteDocument) => void;
  onDeleteDocument: (documentId: string) => void;
}

export function NotesSidebar({
  documents,
  activeId,
  referenceNow,
  busyAction,
  onCreateDocument,
  onSelectDocument,
  onTogglePinned,
  onDeleteDocument,
}: NotesSidebarProps) {
  const isNotesInitialLoading = referenceNow === null;
  // Use 0 as fallback to avoid calling Date.now() during render
  const effectiveNow = referenceNow ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="p-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={onCreateDocument}
          disabled={busyAction === "creating"}
        >
          <FilePlus2Icon />
          新建笔记
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {isNotesInitialLoading ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            加载中...
          </p>
        ) : documents.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            暂无笔记
          </p>
        ) : (
          groupDocuments(documents, effectiveNow).map((group) => (
            <div key={group.label} className="mb-3">
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
                {group.label}
              </p>
              {group.items.map((document) => (
                <button
                  key={document.id}
                  type="button"
                  onClick={() => onSelectDocument(document)}
                  className={cn(
                    "group my-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                    document.id === activeId && "bg-accent font-medium",
                  )}
                >
                  <span className="flex-1 truncate">
                    {document.title || "未命名笔记"}
                  </span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              onTogglePinned(document);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.stopPropagation();
                                onTogglePinned(document);
                              }
                            }}
                            className={cn(
                              "flex shrink-0 rounded p-0.5",
                              document.isPinned
                                ? "text-primary"
                                : "text-muted-foreground hover:text-foreground md:opacity-0 md:group-hover:opacity-100",
                            )}
                          />
                        }
                      >
                        <PinIcon className="h-3.5 w-3.5" />
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {document.isPinned ? "取消置顶" : "置顶笔记"}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteDocument(document.id);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.stopPropagation();
                                onDeleteDocument(document.id);
                              }
                            }}
                            className="flex shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive md:opacity-0 md:group-hover:opacity-100"
                          />
                        }
                      >
                        <Trash2Icon className="h-3.5 w-3.5" />
                      </TooltipTrigger>
                      <TooltipContent side="top">删除笔记</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
