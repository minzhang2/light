"use client";

import { startTransition, useEffect, useEffectEvent, useRef, useState } from "react";
import {
  FilePlus2Icon,
  FileTextIcon,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useIsMobile } from "@/hooks/use-mobile";
import type { NoteDocument, SaveState, ViewMode } from "./notes-workspace/types";
import { AUTO_SAVE_DEBOUNCE_MS } from "./notes-workspace/types";
import { formatSavedLabel, sortDocuments, buildShareUrl } from "./notes-workspace/utils";
import { EditorHeader } from "./notes-workspace/editor-header";
import { NotesSidebar } from "./notes-workspace/sidebar";
import * as api from "./notes-workspace/api";

export function NotesWorkspace({
  initialDocuments,
}: {
  initialDocuments: NoteDocument[];
}) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [documents, setDocuments] = useState(initialDocuments);
  const [clientOrigin, setClientOrigin] = useState("");
  const [referenceNow, setReferenceNow] = useState<number | null>(null);
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

    try {
      const savedDocument = await api.updateDocument(snapshot.id, {
        title: snapshot.title,
        content: snapshot.content,
      });

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
    } catch (error) {
      setSaveState("error");
      setSaveMessage(error instanceof Error ? error.message : "保存失败，请稍后再试");
    }
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
      const document = await api.createDocument(`新建笔记 ${documents.length + 1}`);

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
    } catch (error) {
      setSaveState("error");
      setSaveMessage(error instanceof Error ? error.message : "新建笔记失败");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDeleteDocument(documentId: string) {
    setBusyAction("deleting");
    try {
      await api.deleteDocument(documentId);

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
    } catch (error) {
      setSaveState("error");
      setSaveMessage(error instanceof Error ? error.message : "删除笔记失败");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleTogglePinned(document: NoteDocument) {
    try {
      const updated = await api.updateDocument(document.id, {
        isPinned: !document.isPinned,
      });

      setDocuments((currentDocuments) =>
        currentDocuments
          .map((item) =>
            item.id === document.id
              ? { ...item, isPinned: updated.isPinned, updatedAt: updated.updatedAt }
              : item,
          )
          .sort(sortDocuments),
      );
      setSaveMessage(updated.isPinned ? "已置顶" : "已取消置顶");
    } catch (error) {
      setSaveState("error");
      setSaveMessage(error instanceof Error ? error.message : "置顶状态更新失败");
    }
  }

  async function handleEnableShare() {
    if (!activeDocument) {
      return;
    }

    try {
      const sharedDocument = await api.enableShare(activeDocument.id);
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

      const shareUrl = buildShareUrl(shareToken, clientOrigin);

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
    } catch (error) {
      toast({
        tone: "error",
        message: error instanceof Error ? error.message : "开启分享失败",
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
      const document = await api.disableShare(activeDocument.id);

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
    } catch (error) {
      toast({
        tone: "error",
        message: error instanceof Error ? error.message : "关闭分享失败",
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

  useEffect(() => {
    setClientOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    setReferenceNow(Date.now());
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

  const handleSaveShortcut = useEffectEvent(() => {
    if (!activeDocument || !isActiveDirty || saveState === "saving") {
      return;
    }

    void saveDocument(activeDocument);
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) {
        return;
      }

      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        handleSaveShortcut();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="flex min-h-svh flex-col">
      <DashboardPageHeader
        title="笔记"
        description="独立的富文本笔记空间，使用 Tiptap Simple Editor，支持自动保存与编辑/预览切换。"
      />

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="grid h-full min-h-0 gap-0 md:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="hidden min-h-0 border-r border-border/70 bg-background md:flex md:flex-col">
            <NotesSidebar
              documents={documents}
              activeId={activeId}
              referenceNow={referenceNow}
              busyAction={busyAction}
              onCreateDocument={() => void handleCreateDocument()}
              onSelectDocument={handleSelectDocument}
              onTogglePinned={(doc) => void handleTogglePinned(doc)}
              onDeleteDocument={setPendingDeleteId}
            />
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
                <EditorHeader
                  activeDocument={activeDocument}
                  saveState={saveState}
                  saveMessage={saveMessage}
                  isActiveDirty={isActiveDirty}
                  viewMode={viewMode}
                  onTitleChange={(title) => updateActiveDocument({ title })}
                  onToggleViewMode={() => void handleToggleViewMode()}
                  onCopyShareLink={() => void handleCopyShareLink()}
                  onOpenShareDialog={() => setShareDialogOpen(true)}
                  onEnableShare={() => void handleEnableShare()}
                  onToggleMobileSidebar={() => setMobileSidebarOpen(true)}
                  isDisablingShare={isDisablingShare}
                  activeShareUrl={activeShareUrl}
                />

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
          <NotesSidebar
            documents={documents}
            activeId={activeId}
            referenceNow={referenceNow}
            busyAction={busyAction}
            onCreateDocument={() => void handleCreateDocument()}
            onSelectDocument={(doc) => {
              handleSelectDocument(doc);
              setMobileSidebarOpen(false);
            }}
            onTogglePinned={(doc) => void handleTogglePinned(doc)}
            onDeleteDocument={setPendingDeleteId}
          />
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
