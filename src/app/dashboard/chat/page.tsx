import type { Metadata } from "next";

import { ChatContainer } from "@/components/chat-container";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { listManagedKeys } from "@/features/managed-keys/service";
import { getChatSession, toChatKeyOption } from "@/features/chat/service";
import { requireSession } from "@/lib/auth/require-session";

export const metadata: Metadata = {
  title: "聊天",
  description: "使用已验证的 key 和模型发起聊天",
};

export default async function DashboardChatPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const session = await requireSession();
  const { session: sessionId } = await searchParams;

  const keys = await listManagedKeys();
  const sortedKeys = [...keys].sort((a, b) => {
    if (a.isPinned === b.isPinned) {
      return 0;
    }

    return a.isPinned ? -1 : 1;
  });

  const chatKeys = sortedKeys
    .map(toChatKeyOption)
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const initialSession = sessionId
    ? await getChatSession(sessionId, session.user.id)
    : null;

  return (
    <div className="flex h-svh min-h-0 flex-col overflow-hidden">
      <DashboardPageHeader
        title="聊天"
        description="使用已验证的 key 与模型发起对话。"
      />
      <div className="min-h-0 flex-1 overflow-hidden">
        <ChatContainer
          keys={chatKeys}
          initialSession={initialSession}
          initialSessionId={sessionId ?? null}
        />
      </div>
    </div>
  );
}
