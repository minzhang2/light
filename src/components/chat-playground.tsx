"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  BotIcon,
  MessageCircleIcon,
  RefreshCcwIcon,
  SendHorizonalIcon,
  UserIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import type { ChatKeyOption, ChatMessageInput } from "@/features/chat/types";
import { cn } from "@/lib/utils";

type ChatMessage = ChatMessageInput & {
  id: string;
  keyName?: string;
  model?: string;
};

function makeMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function findKey(keys: ChatKeyOption[], keyId: string | null) {
  if (!keyId) {
    return null;
  }

  return keys.find((item) => item.id === keyId) ?? null;
}

export function ChatPlayground({
  keys,
}: {
  keys: ChatKeyOption[];
}) {
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(keys[0]?.id ?? null);
  const [selectedModel, setSelectedModel] = useState(keys[0]?.defaultModel ?? "");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();
  const messagesRef = useRef<HTMLDivElement>(null);

  const selectedKey = findKey(keys, selectedKeyId);

  useEffect(() => {
    if (!selectedKey) {
      setSelectedModel("");
      return;
    }

    if (!selectedKey.models.includes(selectedModel)) {
      setSelectedModel(selectedKey.defaultModel);
    }
  }, [selectedKey, selectedModel]);

  useEffect(() => {
    const container = messagesRef.current;

    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [messages, isSending]);

  async function handleSend() {
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

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          keyId: selectedKey.id,
          model: selectedModel,
          messages: nextMessages.map((item) => ({
            role: item.role,
            content: item.content,
          })),
        }),
      });

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
    } catch (error) {
      toast({
        tone: "error",
        message: error instanceof Error ? error.message : "聊天请求失败。",
        duration: 3600,
      });
    } finally {
      setIsSending(false);
    }
  }

  function handleReset() {
    setMessages([]);
    setInput("");
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
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="rounded-[1.75rem] border border-border/70 bg-card p-5 shadow-sm">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="chat-key">聊天 Key</FieldLabel>
              <FieldContent>
                <Select value={selectedKeyId ?? undefined} onValueChange={setSelectedKeyId}>
                  <SelectTrigger id="chat-key">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {keys.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} · {item.group}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  只显示已通过可用性检测的 key。
                </FieldDescription>
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="chat-model">模型</FieldLabel>
              <FieldContent>
                <Select
                  value={selectedModel || undefined}
                  onValueChange={(value) => setSelectedModel(value ?? "")}
                >
                  <SelectTrigger id="chat-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(selectedKey?.models ?? []).map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  切换 key 时，会自动切到该 key 的可用模型。
                </FieldDescription>
              </FieldContent>
            </Field>

            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
              <p>当前 Key：{selectedKey?.name ?? "未选择"}</p>
              <p className="mt-2">协议：{selectedKey?.protocol ?? "未知"}</p>
              <p className="mt-2">可选模型数：{selectedKey?.models.length ?? 0}</p>
            </div>

            <Button type="button" variant="outline" onClick={handleReset}>
              <RefreshCcwIcon className="h-4 w-4" />
              新会话
            </Button>
          </FieldGroup>
        </div>

        <div className="flex min-h-[70vh] flex-col overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-sm">
          <div
            ref={messagesRef}
            className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 md:p-6"
          >
            {messages.length === 0 ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="max-w-md text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                    <MessageCircleIcon className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-semibold">开始聊天</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    默认会使用当前选中的 key 和模型发起请求。你也可以随时切换到同一 key 下的其他可用模型。
                  </p>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <article
                  key={message.id}
                  className={cn(
                    "max-w-[88%] rounded-2xl border px-4 py-3",
                    message.role === "user"
                      ? "ml-auto border-primary/20 bg-primary/8"
                      : "border-border/70 bg-muted/35",
                  )}
                >
                  <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                    {message.role === "user" ? (
                      <>
                        <UserIcon className="h-3.5 w-3.5" />
                        你
                      </>
                    ) : (
                      <>
                        <BotIcon className="h-3.5 w-3.5" />
                        {message.keyName ?? "助手"}
                        {message.model ? ` · ${message.model}` : ""}
                      </>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                    {message.content}
                  </div>
                </article>
              ))
            )}

            {isSending ? (
              <article className="max-w-[88%] rounded-2xl border border-border/70 bg-muted/35 px-4 py-3">
                <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <BotIcon className="h-3.5 w-3.5" />
                  {selectedKey?.name ?? "助手"} · {selectedModel || "处理中"}
                </div>
                <div className="text-sm text-muted-foreground">正在生成回复...</div>
              </article>
            ) : null}
          </div>

          <div className="border-t border-border/70 p-4 md:p-5">
            <Field>
              <FieldLabel htmlFor="chat-input">输入消息</FieldLabel>
              <FieldContent>
                <Textarea
                  id="chat-input"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      if (!isSending) {
                        void handleSend();
                      }
                    }
                  }}
                  placeholder="输入消息，Enter 发送，Shift + Enter 换行"
                  disabled={isSending}
                  className="min-h-32 resize-y"
                />
                <div className="flex items-center justify-between gap-3">
                  <FieldDescription>
                    会使用当前选择的 key 和模型发起真实请求。
                  </FieldDescription>
                  <Button type="button" onClick={handleSend} disabled={isSending || !input.trim()}>
                    <SendHorizonalIcon className="h-4 w-4" />
                    {isSending ? "发送中..." : "发送"}
                  </Button>
                </div>
              </FieldContent>
            </Field>
          </div>
        </div>
      </section>
    </div>
  );
}
