import type { Metadata } from "next";

import { NotesWorkspace } from "@/components/notes-workspace";
import { listNoteDocuments } from "@/features/notes/service";
import { requireSession } from "@/lib/auth/require-session";

export const metadata: Metadata = {
  title: "笔记",
  description: "独立的文本笔记空间，支持持续保存与编辑。",
};

export default async function DashboardNotesPage() {
  const session = await requireSession();
  const documents = await listNoteDocuments(session.user.id);

  return <NotesWorkspace initialDocuments={documents} />;
}
