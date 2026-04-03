import { prisma } from "@/lib/prisma";

export interface NoteDocumentRecord {
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

const DEFAULT_NOTE_TITLE = "Light 使用说明";
const DEFAULT_NOTE_CONTENT = `
<h1>欢迎使用 Light</h1>
<p>这是一份系统自动创建的默认使用文档，帮助你快速了解当前可用功能。</p>
<h2>你可以做什么</h2>
<ul>
  <li><p><strong>聊天</strong>：选择可用 key 与模型，发起多轮对话，并保留历史记录。</p></li>
  <li><p><strong>笔记</strong>：使用富文本编辑器记录内容，支持自动保存、置顶、分享和预览。</p></li>
  <li><p><strong>Key 管理</strong>：导入、搜索、测试和整理 Claude / Codex key。</p></li>
  <li><p><strong>临时邮箱</strong>：分配临时邮箱并接收验证码。</p></li>
  <li><p><strong>邀请码 / 管理后台</strong>：管理员可管理注册权限和用户角色。</p></li>
</ul>
<h2>笔记使用方式</h2>
<ol>
  <li><p>点击左侧“新建笔记”创建内容。</p></li>
  <li><p>标题和正文都会自动保存，也可以手动点击“保存”。</p></li>
  <li><p>支持编辑 / 预览切换，适合整理说明、草稿和长期文档。</p></li>
  <li><p>开启分享后可复制链接给他人查看，关闭分享后旧链接会失效。</p></li>
</ol>
<h2>使用建议</h2>
<ul>
  <li><p>把常用说明、提示词、工作记录放在笔记里，方便反复复用。</p></li>
  <li><p>重要笔记可以置顶，便于长期保留在列表顶部。</p></li>
  <li><p>如果你是管理员，建议先检查邀请码、邮箱和 key 配置是否正常。</p></li>
</ul>
<p>你可以直接修改这份文档，或者新建自己的第一篇笔记开始使用。</p>
`.trim();

function serializeDocument(document: {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  isShared: boolean;
  shareToken: string | null;
  sharedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): NoteDocumentRecord {
  return {
    id: document.id,
    title: document.title,
    content: document.content,
    isPinned: document.isPinned,
    isShared: document.isShared,
    shareToken: document.shareToken,
    sharedAt: document.sharedAt?.toISOString() ?? null,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

export async function ensureDefaultNoteDocument(userId: string) {
  const existing = await prisma.noteDocument.findFirst({
    where: {
      userId,
      title: DEFAULT_NOTE_TITLE,
    },
    select: { id: true },
  });

  if (existing) {
    return;
  }

  await prisma.noteDocument.create({
    data: {
      userId,
      title: DEFAULT_NOTE_TITLE,
      content: DEFAULT_NOTE_CONTENT,
      isPinned: true,
    },
  });
}

export async function listNoteDocuments(userId: string) {
  await ensureDefaultNoteDocument(userId);

  const documents = await prisma.noteDocument.findMany({
    where: { userId },
    orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
  });

  return documents.map(serializeDocument);
}

export async function getNoteDocument(id: string, userId: string) {
  const document = await prisma.noteDocument.findFirst({
    where: { id, userId },
  });

  return document ? serializeDocument(document) : null;
}

export async function getSharedNoteDocumentByToken(shareToken: string) {
  const document = await prisma.noteDocument.findFirst({
    where: {
      shareToken,
      isShared: true,
    },
  });

  return document ? serializeDocument(document) : null;
}
