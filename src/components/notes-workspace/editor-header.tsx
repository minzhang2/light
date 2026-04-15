import { AlertCircleIcon, CloudIcon, CopyIcon, EyeIcon, LockIcon, MenuIcon, PencilLineIcon, Share2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { NoteDocument, SaveState, ViewMode } from "./types";

export function EditorHeader({
  activeDocument,
  saveState,
  saveMessage,
  isActiveDirty,
  viewMode,
  onTitleChange,
  onToggleViewMode,
  onCopyShareLink,
  onOpenShareDialog,
  onEnableShare,
  onToggleMobileSidebar,
  isDisablingShare,
  activeShareUrl,
}: {
  activeDocument: NoteDocument;
  saveState: SaveState;
  saveMessage: string;
  isActiveDirty: boolean;
  viewMode: ViewMode;
  onTitleChange: (title: string) => void;
  onToggleViewMode: () => void;
  onCopyShareLink: () => void;
  onOpenShareDialog: () => void;
  onEnableShare: () => void;
  onToggleMobileSidebar: () => void;
  isDisablingShare: boolean;
  activeShareUrl: string | null;
}) {
  const SaveStatusIcon = saveState === "error"
    ? AlertCircleIcon
    : saveState === "saving" || isActiveDirty
      ? CloudIcon
      : LockIcon;
  const activeTitleMeasure = activeDocument.title || "输入笔记标题";

  return (
    <div className="flex flex-col gap-2 border-b border-border/70 px-4 py-2 md:flex-row md:flex-wrap md:items-center md:justify-between md:px-4">
      <div className="min-w-0 flex flex-1 flex-col gap-1 md:flex-row md:flex-wrap md:items-center md:gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onToggleMobileSidebar}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground md:hidden"
            aria-label="打开笔记列表"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <div className="relative min-w-0 flex-1 overflow-hidden md:w-max md:max-w-[32rem] md:flex-none lg:max-w-[40rem]">
            <span
              aria-hidden="true"
              className="invisible block min-w-[4ch] max-w-full truncate whitespace-pre px-0 py-0 text-xl font-semibold md:text-lg"
            >
              {activeTitleMeasure}
            </span>
            <Input
              value={activeDocument.title}
              onChange={(event) => onTitleChange(event.target.value)}
              className="absolute inset-0 h-full min-w-0 w-full border-0 bg-transparent px-0 py-0 text-xl font-semibold shadow-none focus-visible:ring-0 md:text-lg"
              placeholder="输入笔记标题"
            />
          </div>
        </div>
        <div className={cn(
          "flex shrink-0 items-center gap-2 text-xs",
          saveState === "error" ? "text-destructive" : "text-muted-foreground",
        )}>
          <SaveStatusIcon
            className={cn(
              "size-4 shrink-0",
              saveState === "error"
                ? "text-destructive"
                : saveState === "saving"
                  ? "text-amber-500"
                  : isActiveDirty
                    ? "text-sky-500"
                    : "text-muted-foreground",
            )}
          />
          <span>{saveMessage}</span>
        </div>
      </div>

      <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">
        {activeDocument.isShared ? (
          <>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-none"
                      onClick={onCopyShareLink}
                    >
                      <CopyIcon />
                      复制链接
                    </Button>
                  }
                />
                <TooltipContent
                  side="top"
                  className="max-w-sm whitespace-normal break-all"
                >
                  {activeShareUrl}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={onOpenShareDialog}
              disabled={isDisablingShare}
            >
              <Share2Icon />
              关闭分享
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none"
            onClick={onEnableShare}
          >
            <Share2Icon />
            分享
          </Button>
        )}
        <Button
          variant="default"
          size="sm"
          className="flex-1 sm:flex-none"
          onClick={onToggleViewMode}
        >
          {viewMode === "edit" ? <EyeIcon /> : <PencilLineIcon />}
          {viewMode === "edit" ? "预览" : "编辑"}
        </Button>
      </div>
    </div>
  );
}
