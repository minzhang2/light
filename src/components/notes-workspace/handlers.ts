import { startTransition } from "react";
import type { NoteDocument, SaveState } from "./types";
import { formatSavedLabel, sortDocuments } from "./utils";
import * as api from "./api";

export function useDocumentHandlers({
  documents,
  setDocuments,
  activeId,
  setActiveId,
  setViewMode,
  saveState,
  setSaveState,
  setSaveMessage,
  setBusyAction,
  setPendingDeleteId,
  setLastSavedMap,
  activeDocument,
  isDocumentDirty,
  saveDocument,
  toast,
}: {
  documents: NoteDocument[];
  setDocuments: React.Dispatch<React.SetStateAction<NoteDocument[]>>;
  activeId: string | null;
  setActiveId: React.Dispatch<React.SetStateAction<string | null>>;
  setViewMode: React.Dispatch<React.SetStateAction<"edit" | "preview">>;
  saveState: SaveState;
  setSaveState: React.Dispatch<React.SetStateAction<SaveState>>;
  setSaveMessage: React.Dispatch<React.SetStateAction<string>>;
  setBusyAction: React.Dispatch<React.SetStateAction<"creating" | "deleting" | null>>;
  setPendingDeleteId: React.Dispatch<React.SetStateAction<string | null>>;
  setLastSavedMap: React.Dispatch<React.SetStateAction<Record<string, { title: string; content: string }>>>;
  activeDocument: NoteDocument | null;
  isDocumentDirty: (document: NoteDocument) => boolean;
  saveDocument: (document: NoteDocument) => Promise<void>;
  toast: (options: { tone: string; message: string }) => void;
}) {
  async function handleToggleViewMode() {
    if (saveState === "preview") {
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

  return {
    handleToggleViewMode,
    handleCreateDocument,
    handleDeleteDocument,
    handleTogglePinned,
  };
}
