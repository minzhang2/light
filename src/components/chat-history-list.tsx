"use client";

import { useEffect, useState } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import type { ChatSessionListItem } from "@/features/chat/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function groupSessions(sessions: ChatSessionListItem[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const groups: { label: string; items: ChatSessionListItem[] }[] = [
    { label: "今天", items: [] },
    { label: "昨天", items: [] },
    { label: "最近 7 天", items: [] },
    { label: "更早", items: [] },
  ];

  for (const s of sessions) {
    const d = new Date(s.updatedAt);
    if (d >= today) {
      groups[0].items.push(s);
    } else if (d >= yesterday) {
      groups[1].items.push(s);
    } else if (d >= sevenDaysAgo) {
      groups[2].items.push(s);
    } else {
      groups[3].items.push(s);
    }
  }

  return groups.filter((g) => g.items.length > 0);
}

export function ChatHistoryList({
  activeSessionId,
  onNewChat,
  onSessionSelect,
  refreshKey = 0,
}: {
  activeSessionId: string | null;
  onNewChat: () => void;
  onSessionSelect: (id: string) => void;
  refreshKey?: number;
}) {
  const [sessions, setSessions] = useState<ChatSessionListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchSessions() {
      setLoading(true);
      try {
        const res = await fetch("/api/chat/sessions", { cache: "no-store" });
        if (!res.ok || cancelled) {
          return;
        }

        const data = (await res.json()) as ChatSessionListItem[];
        if (!cancelled) {
          setSessions(data);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchSessions();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`/api/chat/sessions/${id}`, { method: "DELETE" });
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (id === activeSessionId) {
      onNewChat();
    }
  }

  const groups = groupSessions(sessions);

  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={onNewChat}
        >
          <PlusIcon className="h-4 w-4" />
          新建对话
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {loading && (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">加载中...</p>
        )}
        {!loading && sessions.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">暂无历史对话</p>
        )}
        {groups.map((group) => (
          <div key={group.label} className="mb-3">
            <p className="px-2 py-1 text-xs font-medium text-muted-foreground">{group.label}</p>
            {group.items.map((s) => (
              <button
                key={s.id}
                onClick={() => onSessionSelect(s.id)}
                className={cn(
                  "group flex w-full items-center gap-2 rounded-md my-1 px-2 py-1.5 text-left text-sm hover:bg-accent",
                  s.id === activeSessionId && "bg-accent font-medium",
                )}
              >
                <span className="flex-1 truncate">{s.title}</span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => void handleDelete(s.id, e)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      void handleDelete(s.id, e as unknown as React.MouseEvent);
                    }
                  }}
                  className="flex shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive md:hidden md:group-hover:flex"
                >
                  <Trash2Icon className="h-3.5 w-3.5" />
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
