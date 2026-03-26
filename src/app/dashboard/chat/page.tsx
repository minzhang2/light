import type { Metadata } from "next";

import { ChatPlayground } from "@/components/chat-playground";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { listManagedKeys } from "@/features/managed-keys/service";
import { toChatKeyOption } from "@/features/chat/service";

export const metadata: Metadata = {
  title: "聊天",
  description: "使用已验证的 key 和模型发起聊天",
};

export default async function DashboardChatPage() {
  const keys = await listManagedKeys();
  const chatKeys = keys
    .map(toChatKeyOption)
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <>
      <DashboardPageHeader
        title="聊天"
        description="自动应用已验证 key 的可用模型，并支持在 key 与模型之间快速切换。"
      />
      <ChatPlayground keys={chatKeys} />
    </>
  );
}
