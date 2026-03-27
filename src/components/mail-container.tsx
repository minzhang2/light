"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  InboxIcon,
  Loader2Icon,
  MenuIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const TOKENS = [
  {
    label: "1018644425@qq.com",
    value: "sk_live_x4xSa-zqPeMVif3PvzdDP5usvqrMyqyu",
  },
  {
    label: "yuansi.zm@gmail.com",
    value: "sk_live_eiMa_99H-sdcgvx1yBlp1y498RPAedm0",
  },
] as const;

const API_BASE = "/api/mail";

interface Mailbox {
  id: number;
  email: string;
  created_at: number;
}

interface Email {
  id: number;
  subject?: string;
  from_addr?: string;
  from?: string;
  mailbox_id?: number;
  mailbox_email?: string;
  verification_code?: string;
  [key: string]: unknown;
}

interface LogEntry {
  time: string;
  type: "info" | "success" | "error";
  message: string;
}

type JsonRecord = Record<string, unknown>;

function MailboxSidebar({
  activeMailboxId,
  emailsLoadingIds,
  isAllocating,
  mailboxes,
  onAllocateMailbox,
  onFetchEmails,
  onSelectMailbox,
  onTokenChange,
  token,
}: {
  activeMailboxId: number | null;
  emailsLoadingIds: number[];
  isAllocating: boolean;
  mailboxes: Mailbox[];
  onAllocateMailbox: () => void;
  onFetchEmails: (mailbox: Mailbox) => void;
  onSelectMailbox: (mailbox: Mailbox) => void;
  onTokenChange: (value: string) => void;
  token: string;
}) {
  const selectedTokenLabel =
    TOKENS.find((item) => item.value === token)?.label ?? "请选择用户";

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/70 px-4 py-4">
        <div className="space-y-3">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">选择用户</p>
            <div className="flex items-center gap-2">
              <Select value={token} onValueChange={onTokenChange}>
                <SelectTrigger className="min-w-0 flex-1">
                  <span className="truncate">{selectedTokenLabel}</span>
                </SelectTrigger>
                <SelectContent>
                  {TOKENS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                className="shrink-0 gap-2"
                onClick={onAllocateMailbox}
                disabled={isAllocating}
              >
                {isAllocating ? (
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                ) : (
                  <PlusIcon className="h-4 w-4" />
                )}
                生成邮箱
              </Button>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium">邮箱列表</p>
            <p className="mt-1 text-xs text-muted-foreground">
              选择一个邮箱查看最近收件记录。
            </p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {mailboxes.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            暂无已分配邮箱
          </p>
        ) : (
          mailboxes.map((mailbox) => {
            const isActive = mailbox.id === activeMailboxId;
            const isLoading = emailsLoadingIds.includes(mailbox.id);

            return (
              <div
                key={mailbox.id}
                className={cn(
                  "my-2 flex items-start gap-2 rounded-xl border p-2.5 transition-colors",
                  isActive
                    ? "border-border bg-accent/60"
                    : "border-transparent hover:border-border/70 hover:bg-accent/30",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectMailbox(mailbox)}
                  className="flex min-w-0 flex-1 items-start gap-3 text-left"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border",
                      isActive
                        ? "border-border bg-background text-foreground"
                        : "border-border/70 bg-muted/40 text-muted-foreground",
                    )}
                  >
                    <InboxIcon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {mailbox.email}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">ID {mailbox.id}</span>
                  </span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  aria-label={`查询 ${mailbox.email} 的邮件`}
                  title="查询邮件"
                  onClick={() => onFetchEmails(mailbox)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <SearchIcon className="size-4" />
                  )}
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function now() {
  return new Date().toLocaleTimeString("zh-CN", { hour12: false });
}

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as JsonRecord;
}

function isSuccessResponse(response: Response, json: unknown) {
  if (!response.ok) {
    return false;
  }

  const record = asRecord(json);
  if (!record) {
    return false;
  }

  if (typeof record.code === "number") {
    return record.code === 0;
  }

  if (typeof record.success === "boolean") {
    return record.success;
  }

  return true;
}

function getMessage(json: unknown, fallback: string) {
  const record = asRecord(json);
  if (!record) {
    return fallback;
  }

  if (typeof record.message === "string") {
    return record.message;
  }

  if (typeof record.msg === "string") {
    return record.msg;
  }

  if (typeof record.detail === "string") {
    return record.detail;
  }

  const error = asRecord(record.error);
  if (typeof error?.message === "string") {
    return error.message;
  }

  return fallback;
}

function compactJson(value: unknown, maxLength = 200) {
  try {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    if (!text) {
      return "";
    }

    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  } catch {
    return "";
  }
}

function getApiEcho(response: Response, json: unknown) {
  const record = asRecord(json);
  const pieces: string[] = [`HTTP ${response.status}`];

  if (record) {
    const codeValue = record.code ?? record.error_code;
    if (typeof codeValue === "number" || typeof codeValue === "string") {
      pieces.push(`code=${String(codeValue)}`);
    }
  }

  const message = getMessage(json, "");
  if (message) {
    pieces.push(message);
  } else {
    const raw = compactJson(json);
    if (raw) {
      pieces.push(raw);
    }
  }

  return pieces.join(" | ");
}

function getPayload(json: unknown) {
  const root = asRecord(json);
  if (!root) {
    return null;
  }

  return asRecord(root.data) ?? root;
}

function normalizeMailbox(value: unknown): Mailbox | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const id = Number(record.id);
  const emailValue = record.email_address ?? record.email;
  if (!Number.isFinite(id) || typeof emailValue !== "string" || !emailValue.trim()) {
    return null;
  }

  const createdAt = Number(record.created_at);

  return {
    id,
    email: emailValue,
    created_at: Number.isFinite(createdAt)
      ? createdAt
      : Math.floor(Date.now() / 1000),
  };
}

function extractEmailList(json: unknown): Email[] {
  const root = asRecord(json);
  if (!root) {
    return [];
  }

  const data = asRecord(root.data);

  if (Array.isArray(data?.items)) {
    return data.items as Email[];
  }

  if (Array.isArray(data?.emails)) {
    return data.emails as Email[];
  }

  if (Array.isArray(root.items)) {
    return root.items as Email[];
  }

  if (Array.isArray(root.emails)) {
    return root.emails as Email[];
  }

  return [];
}

async function readApiJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

function isNotFoundResponse(response: Response, json: unknown) {
  if (response.status === 404) {
    return true;
  }

  const detail = asRecord(json)?.detail;
  return typeof detail === "string" && detail.toLowerCase().includes("not found");
}

function findMailboxById(mailboxId: number | null, mailboxes: Mailbox[]) {
  if (mailboxId === null) {
    return null;
  }

  return mailboxes.find((mailbox) => mailbox.id === mailboxId) ?? null;
}

export function MailContainer() {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [activeMailboxId, setActiveMailboxId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailsLoadingIds, setEmailsLoadingIds] = useState<number[]>([]);
  const [token, setToken] = useState<string>(TOKENS[0].value);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const logRef = useRef<HTMLDivElement>(null);
  const activeMailbox = findMailboxById(activeMailboxId, mailboxes);

  const addLog = useCallback((type: LogEntry["type"], message: string) => {
    setLogs((prev) => [...prev, { time: now(), type, message }]);
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
  }, [logs]);

  useEffect(() => {
    let cancelled = false;

    async function loadMailboxes() {
      try {
        const response = await fetch("/api/mail/mailboxes");
        const json = (await response.json()) as {
          mailboxes?: Array<{
            id: number;
            email: string;
            createdAt: string;
          }>;
        };

        if (cancelled || !Array.isArray(json.mailboxes) || json.mailboxes.length === 0) {
          return;
        }

        const fromDb: Mailbox[] = json.mailboxes.map((mailbox) => ({
          id: mailbox.id,
          email: mailbox.email,
          created_at: Math.floor(new Date(mailbox.createdAt).getTime() / 1000),
        }));

        setMailboxes(fromDb);
        setActiveMailboxId((current) => current ?? fromDb[0].id);
      } catch {
        // 未登录或网络错误时静默忽略，保持页面可用。
      }
    }

    void loadMailboxes();

    return () => {
      cancelled = true;
    };
  }, []);

  async function allocateMailbox() {
    setLoading(true);
    addLog("info", "正在分配新邮箱…");

    try {
      let createdMailbox: Mailbox | null = null;
      let errorMessage = "未知错误";
      let successEcho = "";

      const response = await fetch(`${API_BASE}/mailboxes/allocate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await readApiJson(response);

      if (isSuccessResponse(response, json)) {
        successEcho = getApiEcho(response, json);
        const payload = getPayload(json);
        createdMailbox = normalizeMailbox(payload?.item ?? payload);

        if (!createdMailbox) {
          errorMessage = `响应中缺少邮箱信息 | ${successEcho}`;
        }
      } else {
        errorMessage = getApiEcho(response, json);
      }

      if (!createdMailbox) {
        addLog("error", `分配失败: ${errorMessage}`);
        return;
      }

      setMailboxes((prev) => [
        createdMailbox!,
        ...prev.filter((mailbox) => mailbox.id !== createdMailbox!.id),
      ]);
      setActiveMailboxId(createdMailbox.id);
      setSidebarOpen(false);

      addLog(
        "success",
        `分配成功: ${createdMailbox.email} (ID: ${createdMailbox.id}) | ${successEcho}`,
      );

      void fetch("/api/mail/mailboxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: createdMailbox.id,
          email: createdMailbox.email,
        }),
      })
        .then(async (saveResponse) => {
          if (!saveResponse.ok) {
            const text = await saveResponse.text();
            console.error("[mailbox] save to db failed:", saveResponse.status, text);
          }
        })
        .catch((error) => console.error("[mailbox] save to db failed:", error));
    } catch (error) {
      addLog("error", `请求异常: ${error}`);
    } finally {
      setLoading(false);
    }
  }

  async function fetchEmails(mailbox: Mailbox) {
    setEmailsLoadingIds((prev) =>
      prev.includes(mailbox.id) ? prev : [...prev, mailbox.id],
    );
    addLog("info", `查询 ${mailbox.email} 的邮件…`);

    try {
      const endpointBuilders = [
        () => {
          const url = new URL(`${API_BASE}/emails`, window.location.origin);
          url.searchParams.set("mailbox_type", "system");
          url.searchParams.set("mailbox_id", String(mailbox.id));
          url.searchParams.set("page", "1");
          url.searchParams.set("page_size", "20");
          return url.toString();
        },
        () => {
          const url = new URL(
            `${API_BASE}/unified-emails/user/emails`,
            window.location.origin,
          );
          url.searchParams.set("type", "system");
          url.searchParams.set("mailbox_id", String(mailbox.id));
          url.searchParams.set("page", "1");
          url.searchParams.set("page_size", "20");
          return url.toString();
        },
      ];

      let emailList: Email[] | null = null;
      let errorMessage = "未知错误";
      let successEcho = "";

      for (const buildUrl of endpointBuilders) {
        const response = await fetch(buildUrl(), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await readApiJson(response);

        if (isSuccessResponse(response, json)) {
          successEcho = getApiEcho(response, json);
          emailList = extractEmailList(json);
          break;
        }

        errorMessage = getApiEcho(response, json);
        if (!isNotFoundResponse(response, json)) {
          break;
        }
      }

      if (!emailList) {
        addLog("error", `获取邮件失败: ${errorMessage}`);
        return;
      }

      if (emailList.length === 0) {
        addLog("info", `${mailbox.email}: 暂无邮件`);
        return;
      }

      const codes = emailList
        .map((email) => email.verification_code)
        .filter((value): value is string => Boolean(value));

      addLog(
        "success",
        `${mailbox.email}: 获取到 ${emailList.length} 封邮件${
          codes.length ? `，验证码: ${codes.join(", ")}` : ""
        } | ${successEcho}`,
      );

      for (const email of emailList) {
        const mailboxEmail =
          typeof email.mailbox_email === "string" ? email.mailbox_email : mailbox.email;
        const subject = typeof email.subject === "string" ? email.subject : "(无主题)";
        const fromAddr =
          typeof email.from_addr === "string"
            ? email.from_addr
            : typeof email.from === "string"
              ? email.from
              : "未知";

        addLog(
          "info",
          `[${mailboxEmail}] ${subject} | 来自: ${fromAddr}${
            email.verification_code ? ` | 验证码: ${email.verification_code}` : ""
          }`,
        );
      }
    } catch (error) {
      addLog("error", `请求异常: ${error}`);
    } finally {
      setEmailsLoadingIds((prev) => prev.filter((id) => id !== mailbox.id));
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 gap-0 overflow-hidden">
      <aside className="hidden min-h-0 w-80 shrink-0 border-r border-border/70 bg-background md:flex md:flex-col overflow-hidden">
        <MailboxSidebar
          activeMailboxId={activeMailbox?.id ?? null}
          emailsLoadingIds={emailsLoadingIds}
          isAllocating={loading}
          mailboxes={mailboxes}
          onAllocateMailbox={() => void allocateMailbox()}
          onFetchEmails={(mailbox) => void fetchEmails(mailbox)}
          onSelectMailbox={(mailbox) => setActiveMailboxId(mailbox.id)}
          onTokenChange={setToken}
          token={token}
        />
      </aside>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-80 max-w-[85vw] flex-col overflow-hidden bg-background shadow-xl">
            <MailboxSidebar
              activeMailboxId={activeMailbox?.id ?? null}
              emailsLoadingIds={emailsLoadingIds}
              isAllocating={loading}
              mailboxes={mailboxes}
              onAllocateMailbox={() => void allocateMailbox()}
              onFetchEmails={(mailbox) => void fetchEmails(mailbox)}
              onSelectMailbox={(mailbox) => {
                setActiveMailboxId(mailbox.id);
                setSidebarOpen(false);
              }}
              onTokenChange={setToken}
              token={token}
            />
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/[0.18]">
        <div className="flex items-center border-b border-border/70 px-2 py-2 md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
            aria-label="打开邮箱列表"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <span className="flex-1 text-center text-sm font-medium">临时邮箱</span>
          <button
            type="button"
            onClick={() => void allocateMailbox()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            aria-label="生成新邮箱"
            disabled={loading}
          >
            {loading ? (
              <Loader2Icon className="h-5 w-5 animate-spin" />
            ) : (
              <PlusIcon className="h-5 w-5" />
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col px-5 py-5 md:px-8 md:py-8">
            <section className="flex min-h-full flex-1 flex-col">
              <div className="sticky top-0 z-10 flex items-start justify-between bg-muted/[0.18] px-2 py-3 backdrop-blur">
                <div>
                  <h3 className="text-base font-semibold tracking-tight">操作日志</h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-0.5 text-xs text-muted-foreground"
                  onClick={() => setLogs([])}
                >
                  清空
                </Button>
              </div>

              <div
                ref={logRef}
                className="flex-1 overflow-y-auto px-2 pb-6 pt-4"
              >
                {logs.length === 0 ? (
                  <div className="flex min-h-[18rem] items-center justify-center rounded-3xl bg-background/55 px-6 py-10">
                    <p className="max-w-md text-center text-sm leading-7 text-muted-foreground">
                      暂无日志，生成邮箱或执行查询后会在这里显示结果。
                    </p>
                  </div>
                ) : (
                  <div className="rounded-3xl bg-background/70 px-5 py-5 font-mono text-xs leading-7 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
                    {logs.map((log, index) => (
                      <div
                        key={`${log.time}-${index}`}
                        className="border-b border-border/50 py-2 last:border-b-0 last:pb-0 first:pt-0"
                      >
                        <span className="text-muted-foreground">[{log.time}]</span>{" "}
                        <span
                          className={
                            log.type === "error"
                              ? "text-destructive"
                              : log.type === "success"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-foreground"
                          }
                        >
                          {log.message}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
