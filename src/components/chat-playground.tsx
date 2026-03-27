"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowUpIcon,
  CheckIcon,
  ClipboardIcon,
  MessageCircleIcon,
  RefreshCwIcon,
  SquareIcon,
  Trash2Icon,
} from "lucide-react";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ChatKeyOption, ChatMessageInput, ChatSessionDetail } from "@/features/chat/types";
import { cn } from "@/lib/utils";

type ChatMessage = ChatMessageInput & {
  id: string;
  keyName?: string;
  model?: string;
  failed?: boolean;
};

const STORAGE_KEY_ID = "chat:selected-key-id";
const STORAGE_MODEL = "chat:selected-model";

function MessageActionButton({
  onClick,
  icon,
  label,
  disabled = false,
  destructive = false,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center transition-colors disabled:pointer-events-none disabled:opacity-50",
        destructive
          ? "text-destructive hover:text-destructive/80"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
    </button>
  );

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function MessageActions({
  children,
  align,
}: {
  children: React.ReactNode;
  align: "start" | "end";
}) {
  return <div className={cn("flex gap-1.5", align === "end" ? "justify-end" : "justify-start")}>{children}</div>;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <MessageActionButton
      onClick={handleCopy}
      label={copied ? "已复制" : "复制"}
      icon={copied ? <CheckIcon className="h-[14px] w-[14px]" /> : <ClipboardIcon className="h-[14px] w-[14px]" />}
    />
  );
}

function getMessagesForRequest(messages: ChatMessageInput[]) {
  return messages.map((item) => ({
    role: item.role,
    content: item.content,
  }));
}

function KeySupportBadges({
  keyOption,
  className,
}: {
  keyOption: ChatKeyOption;
  className?: string;
}) {
  const showClaude =
    typeof keyOption.supportsClaude === "boolean"
      ? keyOption.supportsClaude
      : keyOption.group === "claude";
  const showCodex =
    typeof keyOption.supportsCodex === "boolean"
      ? keyOption.supportsCodex
      : keyOption.group === "codex";

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {showClaude ? (
        <span className="rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
          Claude
        </span>
      ) : null}
      {showCodex ? (
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
          Codex
        </span>
      ) : null}
    </span>
  );
}

function getRetryableUserMessageIds(messages: ChatMessage[]) {
  const ids: string[] = [];

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.role !== "user") {
      continue;
    }

    const nextMessage = messages[index + 1];
    if (!nextMessage || nextMessage.role !== "assistant") {
      ids.push(message.id);
    }
  }

  return ids;
}

function makeMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function findKey(keys: ChatKeyOption[], keyId: string | null) {
  if (!keyId) {
    return null;
  }

  return keys.find((item) => item.id === keyId) ?? null;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function getInitialKeyId(keys: ChatKeyOption[], initialSession?: ChatSessionDetail | null) {
  return findKey(keys, initialSession?.keyId ?? null)?.id ?? keys[0]?.id ?? null;
}

function getInitialModel(
  keys: ChatKeyOption[],
  keyId: string | null,
  initialSession?: ChatSessionDetail | null,
) {
  const key = findKey(keys, keyId);

  if (initialSession?.model && key?.models.includes(initialSession.model)) {
    return initialSession.model;
  }

  return key?.defaultModel ?? keys[0]?.defaultModel ?? "";
}

export function ChatPlayground({
  keys,
  initialSession,
  sessionId: externalSessionId,
  onSessionCreated,
  onSessionUpdated,
}: {
  keys: ChatKeyOption[];
  initialSession?: ChatSessionDetail | null;
  sessionId?: string | null;
  onSessionCreated?: (sessionId: string) => void;
  onSessionUpdated?: () => void;
}) {
  const defaultKeyId = getInitialKeyId(keys, initialSession);
  const defaultModel = getInitialModel(keys, defaultKeyId, initialSession);

  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(defaultKeyId);
  const [selectedModel, setSelectedModel] = useState(defaultModel);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    (initialSession?.messages ?? []).map((m) => ({ ...m })),
  );
  const [isInitialViewportReady, setIsInitialViewportReady] = useState(
    () => (initialSession?.messages.length ?? 0) === 0,
  );
  const [isSending, setIsSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(externalSessionId ?? null);
  const [deleteTargetMessageId, setDeleteTargetMessageId] = useState<string | null>(null);
  const [isDeletingMessage, setIsDeletingMessage] = useState(false);
  const pendingCreatedSessionIdRef = useRef<string | null>(null);
  const { toast } = useToast();
  const messagesRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<string | null>(externalSessionId ?? null);
  const messagesStateRef = useRef<ChatMessage[]>((initialSession?.messages ?? []).map((m) => ({ ...m })));

  const selectedKey = findKey(keys, selectedKeyId);
  const retryableMessageIds = getRetryableUserMessageIds(messages);
  const deleteTargetMessage = deleteTargetMessageId
    ? messages.find((message) => message.id === deleteTargetMessageId) ?? null
    : null;

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    messagesStateRef.current = messages;
  }, [messages]);

  // Sync when external session changes (user clicks a history item)
  // or when initialSession is loaded for the current session
  const prevInitialSessionRef = useRef(initialSession);
  const prevExternalSessionIdRef = useRef(externalSessionId);
  useEffect(() => {
    const sessionIdChanged = externalSessionId !== prevExternalSessionIdRef.current;
    const initialSessionChanged = initialSession !== prevInitialSessionRef.current;
    prevExternalSessionIdRef.current = externalSessionId;
    prevInitialSessionRef.current = initialSession;

    if (!sessionIdChanged && !initialSessionChanged) {
      return;
    }

    // Session ID changed — update the internal session id.
    if (sessionIdChanged) {
      // If this is the session we just created locally via ensureSession(),
      // simply accept the new id without aborting the in-flight chat request.
      const isPendingCreated =
        externalSessionId !== null &&
        externalSessionId === pendingCreatedSessionIdRef.current;

      if (isPendingCreated) {
        setSessionId(externalSessionId);
        // Don't clear pendingCreatedSessionIdRef yet — it will be cleared
        // once the initialSession data arrives for this session.
        return;
      }

      // A genuinely different session was selected — abort any in-flight
      // request and DON'T clear messages yet so the old content stays
      // visible until the new initialSession arrives (avoids a flash).
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setIsSending(false);
      setSessionId(externalSessionId ?? null);

      // "New chat" — clear right away since there's no data to wait for.
      if (externalSessionId === null) {
        const nextKeyId = getInitialKeyId(keys);
        const nextModel = getInitialModel(keys, nextKeyId);
        setMessages([]);
        setSelectedKeyId(nextKeyId);
        setSelectedModel(nextModel);
        pendingCreatedSessionIdRef.current = null;
        return;
      }

      // If the initialSession already carries data for this new session,
      // apply it immediately (happens when navigating back/forward).
      if (initialSession) {
        const nextKeyId = getInitialKeyId(keys, initialSession);
        const nextModel = getInitialModel(keys, nextKeyId, initialSession);
        setMessages(initialSession.messages.map((m) => ({ ...m })));
        setSelectedKeyId(nextKeyId);
        setSelectedModel(nextModel);
        pendingCreatedSessionIdRef.current = null;
      }
      // Otherwise keep showing the old messages — they'll be replaced
      // once initialSession arrives (the branch below).
      return;
    }

    // Session ID did NOT change, but initialSession data arrived (async load finished).
    if (initialSessionChanged && initialSession) {
      // Skip if this is the pending session the user just created locally —
      // we already have messages in state that the server hasn't persisted yet.
      if (
        externalSessionId !== null &&
        externalSessionId === pendingCreatedSessionIdRef.current &&
        initialSession.messages.length === 0 &&
        messagesStateRef.current.length > 0
      ) {
        return;
      }

      const nextKeyId = getInitialKeyId(keys, initialSession);
      const nextModel = getInitialModel(keys, nextKeyId, initialSession);
      setMessages(initialSession.messages.map((m) => ({ ...m })));
      setSelectedKeyId(nextKeyId);
      setSelectedModel(nextModel);
      pendingCreatedSessionIdRef.current = null;
    }
  }, [externalSessionId, initialSession, keys]);

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!selectedKey) {
      setSelectedModel("");
      return;
    }

    if (!selectedKey.models.includes(selectedModel)) {
      setSelectedModel(selectedKey.defaultModel);
    }
  }, [selectedKey, selectedModel]);

  useLayoutEffect(() => {
    const container = messagesRef.current;

    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;

    if (!isInitialViewportReady) {
      setIsInitialViewportReady(true);
    }
  }, [messages, isSending, isInitialViewportReady]);

  async function ensureSession(
    firstMessage: string,
    signal?: AbortSignal,
  ): Promise<string | null> {
    if (sessionId) {
      return sessionId;
    }

    const title = firstMessage.slice(0, 60).trim() || "新会话";
    const res = await fetch("/api/chat/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        keyId: selectedKeyId,
        model: selectedModel,
      }),
      signal,
    });

    if (!res.ok) {
      return null;
    }

    const newSession = (await res.json().catch(() => null)) as { id?: string } | null;
    const newId = newSession?.id ?? null;
    if (newId) {
      pendingCreatedSessionIdRef.current = newId;
      setSessionId(newId);
      onSessionCreated?.(newId);
    }
    return newId;
  }

  async function handleSend() {
    if (isSending) {
      return;
    }

    const content = input.trim();

    if (!selectedKey) {
      toast({ tone: "error", message: "当前没有可用的 key，请先到 Key 管理页测试 key。" });
      return;
    }

    if (!selectedModel) {
      toast({ tone: "error", message: "请先选择模型。" });
      return;
    }

    if (!content) {
      return;
    }

    const nextUserMessage: ChatMessage = {
      id: makeMessageId(),
      role: "user",
      content,
    };
    const nextMessages = [...messages, nextUserMessage];

    setMessages(nextMessages);
    setInput("");
    setIsSending(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const activeSessionId = await ensureSession(content, controller.signal);

      if (controller.signal.aborted || abortControllerRef.current !== controller) {
        return;
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          keyId: selectedKey.id,
          model: selectedModel,
          messages: getMessagesForRequest(nextMessages),
          sessionId: activeSessionId,
        }),
        signal: controller.signal,
      });

      if (controller.signal.aborted || abortControllerRef.current !== controller) {
        return;
      }

      const payload = (await response.json().catch(() => null)) as
        | {
            message?: string;
            result?: {
              content: string;
              keyName: string;
              model: string;
            };
          }
        | null;

      if (!response.ok || !payload?.result) {
        throw new Error(payload?.message ?? "聊天请求失败。");
      }
      const result = payload.result;

      if (controller.signal.aborted || abortControllerRef.current !== controller) {
        return;
      }

      setMessages((current) => [
        ...current,
        {
          id: makeMessageId(),
          role: "assistant",
          content: result.content,
          keyName: result.keyName,
          model: result.model,
        },
      ]);
      onSessionUpdated?.();
    } catch (error) {
      if (isAbortError(error) || controller.signal.aborted) {
        return;
      }

      toast({
        tone: "error",
        message: error instanceof Error ? error.message : "聊天请求失败。",
        duration: 3600,
      });
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }

      setIsSending(false);
    }
  }

  async function handleRetry(messageId: string) {
    if (isSending) {
      return;
    }

    if (!selectedKey) {
      toast({ tone: "error", message: "当前没有可用的 key，请先到 Key 管理页测试 key。" });
      return;
    }

    if (!selectedModel) {
      toast({ tone: "error", message: "请先选择模型。" });
      return;
    }

    const messageIndex = messages.findIndex((item) => item.id === messageId);
    const targetMessage = messageIndex >= 0 ? messages[messageIndex] : null;

    if (!targetMessage || targetMessage.role !== "user") {
      return;
    }

    const nextMessages = [
      ...messages.slice(0, messageIndex),
      ...messages.slice(messageIndex + 1),
      targetMessage,
    ];
    setMessages(nextMessages);
    setIsSending(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const activeSessionId = await ensureSession(nextMessages[nextMessages.length - 1]?.content ?? "", controller.signal);

      if (controller.signal.aborted || abortControllerRef.current !== controller) {
        return;
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyId: selectedKey.id,
          model: selectedModel,
          messages: getMessagesForRequest(nextMessages),
          sessionId: activeSessionId,
        }),
        signal: controller.signal,
      });

      if (controller.signal.aborted || abortControllerRef.current !== controller) {
        return;
      }

      const payload = (await response.json().catch(() => null)) as
        | { message?: string; result?: { content: string; keyName: string; model: string } }
        | null;

      if (!response.ok || !payload?.result) {
        throw new Error(payload?.message ?? "聊天请求失败。");
      }
      const result = payload.result;

      if (controller.signal.aborted || abortControllerRef.current !== controller) {
        return;
      }

      setMessages((current) => [
        ...current,
        {
          id: makeMessageId(),
          role: "assistant",
          content: result.content,
          keyName: result.keyName,
          model: result.model,
        },
      ]);
      onSessionUpdated?.();
    } catch (error) {
      if (isAbortError(error) || controller.signal.aborted) {
        return;
      }

      toast({
        tone: "error",
        message: error instanceof Error ? error.message : "聊天请求失败。",
        duration: 3600,
      });
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }

      setIsSending(false);
    }
  }

  async function syncSessionMessages(nextMessages: ChatMessage[]) {
    if (!sessionIdRef.current) {
      return;
    }

    const response = await fetch(`/api/chat/sessions/${sessionIdRef.current}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: getMessagesForRequest(nextMessages) }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(payload?.message ?? "更新消息失败。");
    }
  }

  async function handleDeleteMessage(messageId: string) {
    if (isSending || isDeletingMessage) {
      return;
    }

    const nextMessages = messages.filter((message) => message.id !== messageId);

    if (nextMessages.length === messages.length) {
      setDeleteTargetMessageId(null);
      return;
    }

    const previousMessages = messages;

    setDeleteTargetMessageId(null);
    setIsDeletingMessage(true);
    setMessages(nextMessages);

    try {
      await syncSessionMessages(nextMessages);
    } catch (error) {
      setMessages(previousMessages);
      toast({
        tone: "error",
        message: error instanceof Error ? error.message : "删除消息失败。",
      });
    } finally {
      setIsDeletingMessage(false);
    }
  }

  function handleCancelSend() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsSending(false);
    onSessionUpdated?.();
  }

  if (keys.length === 0) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <section className="rounded-[2rem] border border-dashed border-border/70 bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex max-w-xl flex-col items-center gap-3">
            <div className="rounded-2xl bg-muted p-3 text-muted-foreground">
              <MessageCircleIcon className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-semibold">还没有可用的聊天 key</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              这个聊天页只展示已测试通过、并且识别出可用模型的 key。先去 Key 管理页导入并测试 key，再回来聊天。
            </p>
            <Button
              nativeButton={false}
              render={<Link href="/dashboard/keys" />}
              className="mt-2"
            >
              前往 Key 管理
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div
        ref={messagesRef}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto px-4 pt-5 md:px-8 md:pt-8",
          !isInitialViewportReady && messages.length > 0 && "invisible",
        )}
      >
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 pb-6">
          {messages.length === 0 ? (
            <div className="flex min-h-full flex-1 items-center justify-center py-12">
              <div className="max-w-xl text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-muted text-muted-foreground">
                  <MessageCircleIcon className="h-6 w-6" />
                </div>
                <h2 className="text-2xl font-medium tracking-tight">开始聊天</h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  在底部选择 key 和模型后发送消息，滚动会只保留在左侧历史列表和当前消息区。
                </p>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div className={cn("flex max-w-[80%] flex-col gap-1.5", message.role === "user" && "items-end")}>
                  <div
                    className={cn(
                      "rounded-2xl px-3 py-1.5 text-sm leading-6 break-words whitespace-pre-wrap",
                      message.role === "user"
                        ? "rounded-tr-sm bg-primary text-primary-foreground"
                        : "rounded-tl-sm border border-border/70 bg-muted/40 text-foreground",
                    )}
                  >
                    {message.content}
                  </div>
                  <MessageActions align={message.role === "user" ? "end" : "start"}>
                    {retryableMessageIds.includes(message.id) ? (
                      <MessageActionButton
                        onClick={() => void handleRetry(message.id)}
                        label="重发"
                        icon={<RefreshCwIcon className="h-[14px] w-[14px]" />}
                      />
                    ) : null}
                    <CopyButton text={message.content} />
                    {!isSending ? (
                      <MessageActionButton
                        onClick={() => setDeleteTargetMessageId(message.id)}
                        label="删除"
                        disabled={isDeletingMessage}
                        destructive
                        icon={<Trash2Icon className="h-[14px] w-[14px]" />}
                      />
                    ) : null}
                  </MessageActions>
                </div>
              </div>
            ))
          )}

          {isSending ? (
            <div className="flex justify-start">
              <div className="flex max-w-[80%] flex-col gap-1.5">
                <div className="rounded-[1.75rem] rounded-tl-md border border-border/70 bg-muted/40 px-5 py-3 text-sm leading-7 text-muted-foreground">
                  正在生成回复...
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 px-3 pb-4 pt-3 md:px-8 md:pb-8 md:pt-4">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl border border-border/60 bg-background shadow-sm transition-colors focus-within:border-ring/60 focus-within:ring-3 focus-within:ring-ring/15">
            <Textarea
              id="chat-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  if (!isSending) {
                    void handleSend();
                  }
                }
              }}
              placeholder="输入消息，Enter 发送，Shift + Enter 换行"
              className="min-h-16 resize-none border-0 bg-transparent px-5 pt-4 pb-2 text-base shadow-none focus-visible:border-transparent focus-visible:ring-0 md:text-sm dark:bg-transparent"
            />
            <div className="flex items-center gap-1.5 overflow-hidden px-4 pb-2">
              <div className="min-w-0 shrink">
                <Select
                  value={selectedKeyId ?? undefined}
                  onValueChange={(value) => {
                    setSelectedKeyId(value);
                    if (value) {
                      localStorage.setItem(STORAGE_KEY_ID, value);
                    } else {
                      localStorage.removeItem(STORAGE_KEY_ID);
                    }
                  }}
                >
                  <SelectTrigger
                    id="chat-key"
                    className="h-8 w-auto min-w-0 gap-1 rounded-full border-0 bg-transparent px-2 text-xs font-medium text-muted-foreground shadow-none hover:text-foreground focus-visible:border-transparent focus-visible:ring-0 data-[popup-open=true]:border-transparent data-[popup-open=true]:ring-0"
                  >
                    <span className="inline-flex min-w-0 items-center gap-1">
                      {selectedKey ? (
                        <>
                          <span className="max-w-[72px] truncate md:max-w-40">{selectedKey.name}</span>
                          <KeySupportBadges keyOption={selectedKey} className="hidden md:inline-flex" />
                        </>
                      ) : (
                        <span className="max-w-[72px] truncate md:max-w-40">选择 Key</span>
                      )}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="w-auto min-w-[var(--anchor-width)] max-w-[calc(100vw-2rem)]">
                    {keys.map((item) => (
                      <SelectItem key={item.id} value={item.id} className="whitespace-nowrap">
                        <span className="inline-flex items-center gap-2">
                          <span>{item.name}</span>
                          <KeySupportBadges keyOption={item} />
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0 shrink">
                <Select
                  value={selectedModel || undefined}
                  onValueChange={(value) => {
                    setSelectedModel(value ?? "");
                    if (value) {
                      localStorage.setItem(STORAGE_MODEL, value);
                    }
                  }}
                >
                  <SelectTrigger
                    id="chat-model"
                    className="h-8 w-auto min-w-0 gap-1 rounded-full border-0 bg-transparent px-2 text-xs font-medium text-muted-foreground shadow-none hover:text-foreground focus-visible:border-transparent focus-visible:ring-0 data-[popup-open=true]:border-transparent data-[popup-open=true]:ring-0"
                  >
                    <span className="max-w-[72px] truncate md:max-w-48">{selectedModel || "选择模型"}</span>
                  </SelectTrigger>
                  <SelectContent className="w-auto min-w-[var(--anchor-width)] max-w-[calc(100vw-2rem)]">
                    {(selectedKey?.models ?? []).map((item) => (
                      <SelectItem key={item} value={item} className="whitespace-nowrap">
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="ml-auto flex shrink-0 items-center">
                <Button
                  type="button"
                  onClick={isSending ? handleCancelSend : handleSend}
                  disabled={!isSending && !input.trim()}
                  aria-busy={isSending}
                  className={cn(
                    "size-10 rounded-full text-white shadow-none focus-visible:ring-neutral-200 disabled:text-white disabled:opacity-100",
                    isSending
                      ? "bg-primary focus-visible:border-primary disabled:bg-primary"
                      : "bg-primary focus-visible:border-primary disabled:bg-neutral-300",
                  )}
                  aria-label={isSending ? "取消发送" : "发送消息"}
                >
                  {isSending ? (
                    <SquareIcon className="size-5 fill-current stroke-current" />
                  ) : (
                    <ArrowUpIcon className="size-5 stroke-[2.5]" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog
        open={Boolean(deleteTargetMessageId)}
        onOpenChange={(open) => {
          if (!open && !isDeletingMessage) {
            setDeleteTargetMessageId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除这条消息？</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTargetMessage ? (
                <>
                  将删除
                  <span className="mx-1 font-medium text-foreground">
                    {deleteTargetMessage.role === "user" ? "用户消息" : "助手消息"}
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
              onClick={() => setDeleteTargetMessageId(null)}
              disabled={isDeletingMessage}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (deleteTargetMessageId) {
                  void handleDeleteMessage(deleteTargetMessageId);
                }
              }}
              disabled={isDeletingMessage}
            >
              {isDeletingMessage ? "删除中..." : "确认删除"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
