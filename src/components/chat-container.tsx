"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { MenuIcon, PlusIcon } from "lucide-react";

import { ChatHistoryList } from "@/components/chat-history-list";
import { ChatPlayground } from "@/components/chat-playground";
import type { ChatKeyOption, ChatSessionDetail } from "@/features/chat/types";

export function ChatContainer({
  keys,
  initialSession,
  initialSessionId,
}: {
  keys: ChatKeyOption[];
  initialSession: ChatSessionDetail | null;
  initialSessionId: string | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [activeSessionId, setActiveSessionId] = useState(initialSessionId);
  const [activeSession, setActiveSession] = useState(initialSession);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activeSessionIdRef = useRef<string | null>(initialSessionId);
  const requestControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    setActiveSessionId(initialSessionId);
    setActiveSession(initialSession);
  }, [initialSession, initialSessionId]);

  useEffect(
    () => () => {
      requestControllerRef.current?.abort();
      requestControllerRef.current = null;
    },
    [],
  );

  function updateSessionUrl(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());

    if (id) {
      params.set("session", id);
    } else {
      params.delete("session");
    }

    const query = params.toString();
    const nextUrl = query ? `${pathname}?${query}` : pathname;
    window.history.pushState(null, "", nextUrl);
  }

  async function loadSession(id: string) {
    requestControllerRef.current?.abort();

    const controller = new AbortController();
    requestControllerRef.current = controller;

    setActiveSessionId(id);
    // Don't clear activeSession here — keep showing the previous content
    // until the new data arrives, so the right panel doesn't flash.

    try {
      const response = await fetch(`/api/chat/sessions/${id}`, {
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok || controller.signal.aborted || requestControllerRef.current !== controller) {
        return;
      }

      const detail = (await response.json()) as ChatSessionDetail;

      if (controller.signal.aborted || requestControllerRef.current !== controller) {
        return;
      }

      setActiveSession(detail);
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
      }
    }
  }

  function handleSessionChange(id: string) {
    setSidebarOpen(false);
    if (id === "new") {
      requestControllerRef.current?.abort();
      requestControllerRef.current = null;
      setActiveSessionId(null);
      setActiveSession(null);
      updateSessionUrl(null);
      return;
    }

    if (id === activeSessionIdRef.current) {
      return;
    }

    updateSessionUrl(id);
    void loadSession(id);
  }

  function refreshHistory() {
    setHistoryRefreshKey((current) => current + 1);
  }

  function handleSessionCreated(id: string) {
    setActiveSessionId(id);
    refreshHistory();
    updateSessionUrl(id);
  }

  const sessionParam = searchParams.get("session");

  useEffect(() => {
    if (sessionParam === activeSessionIdRef.current) {
      return;
    }

    if (!sessionParam) {
      requestControllerRef.current?.abort();
      requestControllerRef.current = null;
      setActiveSessionId(null);
      setActiveSession(null);
      return;
    }

    void loadSession(sessionParam);
  }, [sessionParam]);

  return (
    <div className="flex h-full min-h-0 flex-1 gap-0 overflow-hidden">
      <aside className="hidden min-h-0 w-72 shrink-0 border-r border-border/70 bg-background md:flex md:flex-col overflow-hidden">
        <ChatHistoryList
          activeSessionId={activeSessionId}
          onNewChat={() => handleSessionChange("new")}
          onSessionSelect={handleSessionChange}
          refreshKey={historyRefreshKey}
        />
      </aside>

      {/* Mobile sidebar drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-72 bg-background shadow-xl flex flex-col overflow-hidden">
            <ChatHistoryList
              activeSessionId={activeSessionId}
              onNewChat={() => handleSessionChange("new")}
              onSessionSelect={handleSessionChange}
              refreshKey={historyRefreshKey}
            />
          </aside>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
        {/* Mobile top bar */}
        <div className="flex items-center border-b border-border/70 px-2 py-2 md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
            aria-label="打开历史记录"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <span className="flex-1 text-center text-sm font-medium">聊天</span>
          <button
            type="button"
            onClick={() => handleSessionChange("new")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
            aria-label="新建对话"
          >
            <PlusIcon className="h-5 w-5" />
          </button>
        </div>
        <ChatPlayground
          keys={keys}
          initialSession={activeSession}
          sessionId={activeSessionId}
          onSessionCreated={handleSessionCreated}
          onSessionUpdated={refreshHistory}
        />
      </div>
    </div>
  );
}
