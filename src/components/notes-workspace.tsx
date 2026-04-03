"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import {
  AlertCircleIcon,
  CloudIcon,
  CopyIcon,
  EyeIcon,
  FilePlus2Icon,
  FileTextIcon,
  LockIcon,
  MenuIcon,
  PencilLineIcon,
  PinIcon,
  Share2Icon,
  Trash2Icon,
} from "lucide-react";

import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface NoteDocument {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  isShared: boolean;
  shareToken: string | null;
  sharedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
type ViewMode = "edit" | "preview";

const AUTO_SAVE_DEBOUNCE_MS = 1800;

export function NotesWorkspace({
  initialDocuments,
}: {
  initialDocuments: NoteDocument[];
}) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [documents, setDocuments] = useState(initialDocuments);
  const [clientOrigin, setClientOrigin] = useState("");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(
    initialDocuments[0]?.id ?? null,
  );
  const [viewMode, setViewMode] = useState<ViewMode>("edit");
  const [saveState, setSaveState] = useState<SaveState>(
    initialDocuments.length > 0 ? "saved" : "idle",
  );
  const [saveMessage, setSaveMessage] = useState(
    initialDocuments.length > 0 ? "已保存" : "新建一篇笔记开始记录",
  );
  const [busyAction, setBusyAction] = useState<"creating" | "deleting" | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [isDisablingShare, setIsDisablingShare] = useState(false);
  const [lastSavedMap, setLastSavedMap] = useState<
    Record<string, { title: string; content: string }>
  >(
    Object.fromEntries(
      initialDocuments.map((document) => [
        document.id,
        { title: document.title, content: document.content },
      ]),
    ),
  );

  const activeDocument =
    documents.find((document) => document.id === activeId) ?? null;
  const pendingDeleteDocument =
    documents.find((document) => document.id === pendingDeleteId) ?? null;
  const pendingResaveRef = useRef(false);
  const activeShareUrl = activeDocument?.shareToken
    ? buildShareUrl(activeDocument.shareToken, clientOrigin)
    : null;

  function buildShareUrl(shareToken: string, origin = clientOrigin) {
    if (!origin) {
      return `/share/note/${shareToken}`;
    }

    return `${origin}/share/note/${shareToken}`;
  }

  function isDocumentDirty(document: NoteDocument) {
    const lastSaved = lastSavedMap[document.id];

    if (!lastSaved) {
      return false;
    }

    return (
      document.title !== lastSaved.title || document.content !== lastSaved.content
    );
  }

  function setDocumentDirty() {
    setSaveState("dirty");
  }

  function updateDocument(
    documentId: string,
    patch: Partial<Pick<NoteDocument, "title" | "content" | "isPinned" | "updatedAt">>,
  ) {
    setDocuments((currentDocuments) =>
      currentDocuments.map((document) =>
        document.id === documentId ? { ...document, ...patch } : document,
      ),
    );
  }

  function updateActiveDocument(
    patch: Partial<Pick<NoteDocument, "title" | "content">>,
  ) {
    if (!activeDocument) {
      return;
    }

    updateDocument(activeDocument.id, patch);
    setDocumentDirty();

    if (saveState === "saving") {
      pendingResaveRef.current = true;
    }
  }

  async function saveDocument(document: NoteDocument) {
    const snapshot = {
      id: document.id,
      title: document.title,
      content: document.content,
    };

    pendingResaveRef.current = false;
    setSaveState("saving");
    setSaveMessage("正在保存...");

    const response = await fetch(`/api/note-documents/${snapshot.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: snapshot.title,
        content: snapshot.content,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { document?: NoteDocument; message?: string }
      | null;

    if (!response.ok || !payload?.document) {
      setSaveState("error");
      setSaveMessage(payload?.message ?? "保存失败，请稍后再试");
      return;
    }

    const savedDocument = payload.document;

    let hasNewerLocalChanges = false;

    setDocuments((currentDocuments) =>
      currentDocuments
        .map((currentDocument) => {
          if (currentDocument.id !== savedDocument.id) {
            return currentDocument;
          }

          hasNewerLocalChanges =
            currentDocument.title !== snapshot.title ||
            currentDocument.content !== snapshot.content;

          if (!hasNewerLocalChanges) {
            return savedDocument;
          }

          return {
            ...currentDocument,
            updatedAt: savedDocument.updatedAt,
            isPinned: savedDocument.isPinned,
            isShared: savedDocument.isShared,
            shareToken: savedDocument.shareToken,
            sharedAt: savedDocument.sharedAt,
          };
        })
        .sort(sortDocuments),
    );
    setLastSavedMap((currentMap) => ({
      ...currentMap,
      [savedDocument.id]: {
        title: snapshot.title,
        content: snapshot.content,
      },
    }));

    if (hasNewerLocalChanges || pendingResaveRef.current) {
      setSaveState("dirty");
      setSaveMessage(formatSavedLabel(savedDocument.updatedAt));
      return;
    }

    setSaveState("saved");
    setSaveMessage(formatSavedLabel(savedDocument.updatedAt));
  }

  async function handleSaveActiveDocument() {
    if (!activeDocument) {
      return;
    }

    await saveDocument(activeDocument);
  }

  async function handleToggleViewMode() {
    if (viewMode === "preview") {
      setViewMode("edit");
      return;
    }

    if (activeDocument && isDocumentDirty(activeDocument) && saveState !== "saving") {
      await saveDocument(activeDocument);
    }

    setViewMode("preview");
  }

  async function handleCreateDocument() {
    setBusyAction("creating");
    try {
      const response = await fetch("/api/note-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `新建笔记 ${documents.length + 1}`,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { document?: NoteDocument; message?: string }
        | null;

      if (!response.ok || !payload?.document) {
        setSaveState("error");
        setSaveMessage(payload?.message ?? "新建笔记失败");
        return;
      }

      const document = payload.document;
      setDocuments((currentDocuments) =>
        [...currentDocuments, document].sort(sortDocuments),
      );
      setLastSavedMap((currentMap) => ({
        ...currentMap,
        [document.id]: {
          title: document.title,
          content: document.content,
        },
      }));
      startTransition(() => {
        setActiveId(document.id);
        setViewMode("edit");
      });
      setSaveState("saved");
      setSaveMessage(formatSavedLabel(document.updatedAt));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDeleteDocument(documentId: string) {
    setBusyAction("deleting");
    try {
      const response = await fetch(`/api/note-documents/${documentId}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null;

      if (!response.ok) {
        setSaveState("error");
        setSaveMessage(payload?.message ?? "删除笔记失败");
        return;
      }

      const nextDocuments = documents.filter(
        (document) => document.id !== documentId,
      );

      setDocuments(nextDocuments);
      setLastSavedMap((currentMap) => {
        const nextMap = { ...currentMap };
        delete nextMap[documentId];
        return nextMap;
      });

      if (activeId === documentId) {
        startTransition(() => {
          setActiveId(nextDocuments[0]?.id ?? null);
          setViewMode("edit");
        });
      }

      setSaveState(nextDocuments.length > 0 ? "saved" : "idle");
      setSaveMessage(
        nextDocuments[0]?.updatedAt
          ? formatSavedLabel(nextDocuments[0].updatedAt)
          : "新建一篇笔记开始记录",
      );
      setPendingDeleteId(null);
      toast({
        tone: "success",
        message: "笔记已删除",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleTogglePinned(document: NoteDocument) {
    const response = await fetch(`/api/note-documents/${document.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isPinned: !document.isPinned,
      }),
    });
    const payload = (await response.json().catch(() => null)) as
      | { document?: NoteDocument; message?: string }
      | null;

    if (!response.ok || !payload?.document) {
      setSaveState("error");
      setSaveMessage(payload?.message ?? "置顶状态更新失败");
      return;
    }

    setDocuments((currentDocuments) =>
      currentDocuments
        .map((item) =>
          item.id === document.id
            ? { ...item, isPinned: payload.document!.isPinned, updatedAt: payload.document!.updatedAt }
            : item,
        )
        .sort(sortDocuments),
    );
    setSaveMessage(payload.document.isPinned ? "已置顶" : "已取消置顶");
  }

  async function handleEnableShare() {
    if (!activeDocument) {
      return;
    }

    const response = await fetch(`/api/note-documents/${activeDocument.id}/share`, {
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as
      | { document?: NoteDocument; message?: string }
      | null;

    if (!response.ok || !payload?.document || !payload.document.shareToken) {
      toast({
        tone: "error",
        message: payload?.message ?? "开启分享失败",
      });
      return;
    }

    const sharedDocument = payload.document;
    const shareToken = sharedDocument.shareToken;
    if (!shareToken) {
      toast({
        tone: "error",
        message: "分享链接生成失败",
      });
      return;
    }
    setDocuments((currentDocuments) =>
      currentDocuments.map((document) =>
        document.id === sharedDocument.id ? sharedDocument : document,
      ),
    );

    const shareUrl = buildShareUrl(shareToken);

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        tone: "success",
        message: "分享链接已复制",
      });
    } catch {
      toast({
        tone: "info",
        message: shareUrl,
        duration: 5000,
      });
    }
  }

  async function handleCopyShareLink() {
    if (!activeShareUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(activeShareUrl);
      toast({
        tone: "success",
        message: "分享链接已复制",
      });
    } catch {
      toast({
        tone: "info",
        message: activeShareUrl,
        duration: 5000,
      });
    }
  }

  async function handleDisableShare() {
    if (!activeDocument?.isShared) {
      return;
    }

    setIsDisablingShare(true);
    try {
      const response = await fetch(`/api/note-documents/${activeDocument.id}/share`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | { document?: NoteDocument; message?: string }
        | null;

      if (!response.ok || !payload?.document) {
        toast({
          tone: "error",
          message: payload?.message ?? "关闭分享失败",
        });
        return;
      }

      const document = payload.document;
      setDocuments((currentDocuments) =>
        currentDocuments.map((item) =>
          item.id === document.id ? document : item,
        ),
      );
      setShareDialogOpen(false);
      toast({
        tone: "success",
        message: "已关闭分享",
      });
    } finally {
      setIsDisablingShare(false);
    }
  }

  function handleSelectDocument(document: NoteDocument) {
    if (activeDocument && isDocumentDirty(activeDocument) && saveState !== "saving") {
      void saveDocument(activeDocument);
    }

    startTransition(() => {
      setActiveId(document.id);
    });
    if (isMobile) {
      setMobileSidebarOpen(false);
    }

    setSaveState("saved");
    setSaveMessage(
      document.updatedAt
        ? formatSavedLabel(document.updatedAt)
        : "新建一篇笔记开始记录",
    );
  }

  const isActiveDirty = activeDocument ? isDocumentDirty(activeDocument) : false;
  const SaveStatusIcon = saveState === "error"
    ? AlertCircleIcon
    : saveState === "saving" || isActiveDirty
      ? CloudIcon
      : LockIcon;

  useEffect(() => {
    setClientOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (saveState === "saving" || saveState === "error" || isActiveDirty) {
      return;
    }

    setSaveMessage(
      activeDocument?.updatedAt
        ? formatSavedLabel(activeDocument.updatedAt)
        : "新建一篇笔记开始记录",
    );
  }, [activeDocument?.id, activeDocument?.updatedAt, isActiveDirty, saveState]);

  useEffect(() => {
    if (!isMobile) {
      setMobileSidebarOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (!activeDocument || !isActiveDirty || saveState === "saving") {
      return;
    }

    const timer = window.setTimeout(() => {
      void saveDocument(activeDocument);
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeDocument, isActiveDirty, saveState]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) {
        return;
      }

      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "s") {
        event.preventDefault();

        if (!activeDocument || !isActiveDirty || saveState === "saving") {
          return;
        }

        void handleSaveActiveDocument();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeDocument, isActiveDirty, saveState]);

  const notesSidebar = (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="p-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => void handleCreateDocument()}
          disabled={busyAction === "creating"}
        >
          <FilePlus2Icon />
          新建笔记
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {documents.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            暂无笔记
          </p>
        ) : (
          groupDocuments(documents).map((group) => (
            <div key={group.label} className="mb-3">
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
                {group.label}
              </p>
              {group.items.map((document) => (
                <button
                  key={document.id}
                  type="button"
                  onClick={() => handleSelectDocument(document)}
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
                              void handleTogglePinned(document);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.stopPropagation();
                                void handleTogglePinned(document);
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
                              setPendingDeleteId(document.id);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.stopPropagation();
                                setPendingDeleteId(document.id);
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

  return (
    <div className="flex min-h-svh flex-col">
      <DashboardPageHeader
        title="笔记"
        description="独立的富文本笔记空间，使用 Tiptap Simple Editor，支持自动保存与编辑/预览切换。"
      />

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="grid h-full min-h-0 gap-0 md:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="hidden min-h-0 border-r border-border/70 bg-background md:flex md:flex-col">
            {notesSidebar}
          </aside>

          <section className="min-h-0 overflow-y-auto bg-background">
            {!activeDocument ? (
              <div className="flex h-full min-h-[400px] items-center justify-center p-6">
                <div className="max-w-sm space-y-3 text-center">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted">
                    <FileTextIcon className="size-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">开始记录你的笔记</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      现在使用 Tiptap 官方的 Simple Editor，并支持自动保存。
                    </p>
                  </div>
                  <Button onClick={() => void handleCreateDocument()}>
                    <FilePlus2Icon />
                    新建第一篇笔记
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-0 flex-col">
                <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-4 md:flex-row md:flex-wrap md:items-center md:justify-between md:px-6">
                  <div className="min-w-0 flex flex-1 flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setMobileSidebarOpen(true)}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground md:hidden"
                        aria-label="打开笔记列表"
                      >
                        <MenuIcon className="h-5 w-5" />
                      </button>
                      <Input
                        value={activeDocument.title}
                        onChange={(event) =>
                          updateActiveDocument({ title: event.target.value })
                        }
                        className="h-auto min-w-0 flex-1 border-0 bg-transparent px-0 py-0 text-xl font-semibold shadow-none focus-visible:ring-0 md:min-w-[240px] md:text-3xl"
                        placeholder="输入笔记标题"
                      />
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
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
                                  onClick={() => void handleCopyShareLink()}
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
                          onClick={() => setShareDialogOpen(true)}
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
                        onClick={() => void handleEnableShare()}
                      >
                        <Share2Icon />
                        分享
                      </Button>
                    )}
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1 sm:flex-none"
                      onClick={() => void handleToggleViewMode()}
                    >
                      {viewMode === "edit" ? <EyeIcon /> : <PencilLineIcon />}
                      {viewMode === "edit" ? "预览" : "编辑"}
                    </Button>
                  </div>
                </div>

                <div className="min-h-0 flex-1">
                  <SimpleEditor
                    content={activeDocument.content}
                    editable={viewMode === "edit"}
                    showToolbar={viewMode === "edit"}
                    onChange={
                      viewMode === "edit"
                        ? (value) => updateActiveDocument({ content: value })
                        : undefined
                    }
                  />
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="w-[86vw] max-w-sm p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>笔记列表</SheetTitle>
            <SheetDescription>在移动端查看和切换笔记。</SheetDescription>
          </SheetHeader>
          {notesSidebar}
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open && busyAction !== "deleting") {
            setPendingDeleteId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除这篇笔记？</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteDocument ? (
                <>
                  将删除
                  <span className="mx-1 font-medium text-foreground">
                    {pendingDeleteDocument.title || "未命名笔记"}
                  </span>
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
              onClick={() => setPendingDeleteId(null)}
              disabled={busyAction === "deleting"}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (pendingDeleteId) {
                  void handleDeleteDocument(pendingDeleteId);
                }
              }}
              disabled={busyAction === "deleting"}
            >
              {busyAction === "deleting" ? "删除中..." : "确认删除"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={shareDialogOpen}
        onOpenChange={(open) => {
          if (!isDisablingShare) {
            setShareDialogOpen(open);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认关闭分享？</AlertDialogTitle>
            <AlertDialogDescription>
              关闭分享后，原链接将无法继续访问。你可以稍后重新开启分享，但会生成新的访问链接。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShareDialogOpen(false)}
              disabled={isDisablingShare}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDisableShare()}
              disabled={isDisablingShare}
            >
              {isDisablingShare ? "关闭中..." : "确认关闭"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function formatRelativeTime(value: string) {
  const now = Date.now();
  const target = new Date(value).getTime();
  const diffMinutes = Math.max(0, Math.round((now - target) / 60000));

  if (diffMinutes < 1) {
    return "刚刚";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} 分钟前`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} 小时前`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} 天前`;
}

function formatSavedTime(value: string) {
  return new Date(value).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatSavedLabel(value: string) {
  return `已保存 ${formatSavedTime(value)}`;
}

function sortDocuments(left: NoteDocument, right: NoteDocument) {
  if (left.isPinned !== right.isPinned) {
    return left.isPinned ? -1 : 1;
  }

  return (
    new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
}

function groupDocuments(documents: NoteDocument[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const groups: { label: string; items: NoteDocument[] }[] = [
    { label: "已置顶", items: [] },
    { label: "今天", items: [] },
    { label: "昨天", items: [] },
    { label: "最近 7 天", items: [] },
    { label: "更早", items: [] },
  ];

  for (const doc of documents) {
    if (doc.isPinned) {
      groups[0].items.push(doc);
      continue;
    }
    const d = new Date(doc.updatedAt);
    if (d >= today) {
      groups[1].items.push(doc);
    } else if (d >= yesterday) {
      groups[2].items.push(doc);
    } else if (d >= sevenDaysAgo) {
      groups[3].items.push(doc);
    } else {
      groups[4].items.push(doc);
    }
  }

  return groups.filter((g) => g.items.length > 0);
}
