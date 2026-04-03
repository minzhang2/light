import type { Metadata } from "next";

import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor";
import { getSharedNoteDocumentByToken } from "@/features/notes/service";

export const metadata: Metadata = {
  title: "分享笔记",
  description: "公开分享的笔记内容。",
};

export default async function SharedNotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const document = await getSharedNoteDocumentByToken(token);

  if (!document) {
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-3xl items-center justify-center px-6 py-12">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">分享链接已失效</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            这篇笔记可能已取消分享，或链接地址不正确。
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-svh bg-background">
      <div className="mx-auto flex min-h-svh w-full max-w-5xl flex-col px-4 py-8 md:px-8">
        <header className="border-b border-border/70 pb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Shared Note
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            {document.title}
          </h1>
        </header>

        <div className="min-h-0 flex-1 py-6">
          <SimpleEditor
            content={document.content}
            editable={false}
            showToolbar={false}
          />
        </div>
      </div>
    </main>
  );
}
