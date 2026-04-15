import type { NoteDocument } from "./types";

export async function createDocument(title: string) {
  const response = await fetch("/api/note-documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { document?: NoteDocument; message?: string }
    | null;

  if (!response.ok || !payload?.document) {
    throw new Error(payload?.message ?? "新建笔记失败");
  }

  return payload.document;
}

export async function updateDocument(
  id: string,
  data: { title?: string; content?: string; isPinned?: boolean },
) {
  const response = await fetch(`/api/note-documents/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const payload = (await response.json().catch(() => null)) as
    | { document?: NoteDocument; message?: string }
    | null;

  if (!response.ok || !payload?.document) {
    throw new Error(payload?.message ?? "保存失败");
  }

  return payload.document;
}

export async function deleteDocument(id: string) {
  const response = await fetch(`/api/note-documents/${id}`, {
    method: "DELETE",
  });

  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; message?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? "删除笔记失败");
  }
}

export async function enableShare(id: string) {
  const response = await fetch(`/api/note-documents/${id}/share`, {
    method: "POST",
  });

  const payload = (await response.json().catch(() => null)) as
    | { document?: NoteDocument; message?: string }
    | null;

  if (!response.ok || !payload?.document || !payload.document.shareToken) {
    throw new Error(payload?.message ?? "开启分享失败");
  }

  return payload.document;
}

export async function disableShare(id: string) {
  const response = await fetch(`/api/note-documents/${id}/share`, {
    method: "DELETE",
  });

  const payload = (await response.json().catch(() => null)) as
    | { document?: NoteDocument; message?: string }
    | null;

  if (!response.ok || !payload?.document) {
    throw new Error(payload?.message ?? "关闭分享失败");
  }

  return payload.document;
}
