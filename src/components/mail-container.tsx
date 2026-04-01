"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AtSignIcon,
  ClipboardIcon,
  Loader2Icon,
  MailPlusIcon,
  MenuIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const DOMAINS = [
  { label: "seekpj.fun", value: "9" },
] as const;

type DomainValue = (typeof DOMAINS)[number]["value"];

interface MailAccount {
  index: number;
  label: string;
}

const API_BASE = "/api/mail";

interface Mailbox {
  id: number;
  email: string;
  created_at: number;
  mailbox_type: string;
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
  accounts,
  activeMailboxId,
  deletingIds,
  emailsLoadingIds,
  mailboxes,
  onDeleteMailbox,
  onFetchEmails,
  onSelectMailbox,
  onAccountChange,
  accountIndex,
  onCopyMailbox,
}: {
  accounts: MailAccount[];
  activeMailboxId: number | null;
  deletingIds: number[];
  emailsLoadingIds: number[];
  mailboxes: Mailbox[];
  onDeleteMailbox: (mailbox: Mailbox) => void;
  onFetchEmails: (mailbox: Mailbox) => void;
  onSelectMailbox: (mailbox: Mailbox) => void;
  onAccountChange: (index: number) => void;
  accountIndex: number;
  onCopyMailbox: (email: string) => void;
}) {
  const selectedLabel =
    accounts.find((a) => a.index === accountIndex)?.label ?? "请选择用户";
  const [pendingDelete, setPendingDelete] = useState<Mailbox | null>(null);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/70 px-3 py-3">
        <Select
          value={String(accountIndex)}
          onValueChange={(value) => {
            if (value !== "") onAccountChange(Number(value));
          }}
        >
          <SelectTrigger className="w-full">
            <span className="truncate">{selectedLabel}</span>
          </SelectTrigger>
          <SelectContent>
            {accounts.map((item) => (
              <SelectItem key={item.index} value={String(item.index)}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-1">
        {mailboxes.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            暂无邮箱
          </p>
        ) : (
          mailboxes.map((mailbox) => {
            const isActive = mailbox.id === activeMailboxId;
            const isLoading = emailsLoadingIds.includes(mailbox.id);

            return (
              <div
                key={mailbox.id}
                className={cn(
                  "my-0.5 flex items-center gap-1 rounded-lg px-2 py-1.5 transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50",
                )}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectMailbox(mailbox)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelectMailbox(mailbox); }}
                  className="min-w-0 flex-1 truncate text-left text-sm cursor-pointer"
                >
                  {mailbox.email}
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 shrink-0"
                          aria-label={`复制 ${mailbox.email}`}
                          onClick={() => onCopyMailbox(mailbox.email)}
                        />
                      }
                    >
                      <ClipboardIcon className="size-3.5" />
                    </TooltipTrigger>
                    <TooltipContent>复制邮箱</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 shrink-0"
                          aria-label={`查询 ${mailbox.email} 的邮件`}
                          onClick={() => onFetchEmails(mailbox)}
                          disabled={isLoading}
                        />
                      }
                    >
                      {isLoading ? (
                        <Loader2Icon className="size-3.5 animate-spin" />
                      ) : (
                        <RefreshCwIcon className="size-3.5" />
                      )}
                    </TooltipTrigger>
                    <TooltipContent>刷新邮件</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 shrink-0"
                          aria-label={`删除 ${mailbox.email}`}
                          onClick={() => setPendingDelete(mailbox)}
                          disabled={deletingIds.includes(mailbox.id)}
                        />
                      }
                    >
                      {deletingIds.includes(mailbox.id) ? (
                        <Loader2Icon className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2Icon className="size-3.5" />
                      )}
                    </TooltipTrigger>
                    <TooltipContent>删除邮箱</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            );
          })
        )}
      </div>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除邮箱 <span className="font-medium text-foreground">{pendingDelete?.email}</span> 吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>取消</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingDelete) {
                  onDeleteMailbox(pendingDelete);
                  setPendingDelete(null);
                }
              }}
            >
              删除
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

  const mailboxType = typeof record.mailbox_type === "string" ? record.mailbox_type : "system";

  return {
    id,
    email: emailValue,
    created_at: Number.isFinite(createdAt)
      ? createdAt
      : Math.floor(Date.now() / 1000),
    mailbox_type: mailboxType,
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
  const { toast } = useToast();
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [activeMailboxId, setActiveMailboxId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailsLoadingIds, setEmailsLoadingIds] = useState<number[]>([]);
  const [deletingIds, setDeletingIds] = useState<number[]>([]);
  const [accountIndex, setAccountIndex] = useState<number>(0);
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [domain, setDomain] = useState<DomainValue>("9");

  const logRef = useRef<HTMLDivElement>(null);
  const activeMailbox = findMailboxById(activeMailboxId, mailboxes);

  const addLog = useCallback((type: LogEntry["type"], message: string) => {
    setLogs((prev) => [{ time: now(), type, message }, ...prev]);
  }, []);

  const handleCopyMailbox = useCallback(async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      toast({ tone: "success", message: "邮箱已复制" });
    } catch {
      toast({ tone: "error", message: "复制邮箱失败" });
    }
  }, [toast]);

  useEffect(() => {
    fetch("/api/mail/accounts")
      .then((r) => r.json())
      .then((data: { accounts?: MailAccount[] }) => {
        if (Array.isArray(data.accounts)) setAccounts(data.accounts);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setMailboxes([]);
    setActiveMailboxId(null);

    async function loadMailboxes() {
      try {
        const url = new URL("/api/mail/mailboxes", window.location.origin);
        url.searchParams.set("accountIndex", String(accountIndex));
        const response = await fetch(url.toString());
        const json = (await response.json()) as {
          mailboxes?: Array<{
            id: number;
            email: string;
            createdAt: string;
            mailboxType?: string;
          }>;
        };

        if (cancelled || !Array.isArray(json.mailboxes) || json.mailboxes.length === 0) {
          return;
        }

        const fromDb: Mailbox[] = json.mailboxes.map((mailbox) => ({
          id: mailbox.id,
          email: mailbox.email,
          created_at: Math.floor(new Date(mailbox.createdAt).getTime() / 1000),
          mailbox_type: mailbox.mailboxType ?? "system",
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
  }, [accountIndex]);

  async function allocateMailbox(useCustomOptions = false) {
    setLoading(true);
    addLog("info", "正在分配新邮箱…");

    try {
      let createdMailbox: Mailbox | null = null;
      let errorMessage = "未知错误";
      let successEcho = "";

      const body: Record<string, unknown> = {
        mailbox_type: useCustomOptions && domain ? "hosted" : "system",
      };
      if (useCustomOptions && domain) body.domain_id = Number(domain);
      if (useCustomOptions && customName.trim()) body.local_part = customName.trim();

      addLog("info", `请求参数: ${JSON.stringify(body)}`);

      const response = await fetch(`${API_BASE}/mailboxes/allocate`, {
        method: "POST",
        headers: { "X-Account-Index": String(accountIndex), "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
          accountIndex,
          mailboxType: createdMailbox.mailbox_type,
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
          url.searchParams.set("mailbox_type", mailbox.mailbox_type);
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
          url.searchParams.set("type", mailbox.mailbox_type);
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
          headers: { "X-Account-Index": String(accountIndex) },
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

  async function deleteMailbox(mailbox: Mailbox) {
    setDeletingIds((prev) => [...prev, mailbox.id]);
    try {
      const response = await fetch(`/api/mail/mailboxes?id=${mailbox.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const json = await readApiJson(response);
        const msg = asRecord(json)?.message;
        addLog("error", `删除失败: ${typeof msg === "string" ? msg : response.statusText}`);
        return;
      }
      setMailboxes((prev) => prev.filter((m) => m.id !== mailbox.id));
      if (activeMailboxId === mailbox.id) {
        setActiveMailboxId(null);
      }
      addLog("info", `已删除: ${mailbox.email}`);
    } catch (error) {
      addLog("error", `删除请求异常: ${error}`);
    } finally {
      setDeletingIds((prev) => prev.filter((id) => id !== mailbox.id));
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 gap-0 overflow-hidden">
      <aside className="hidden min-h-0 w-80 shrink-0 border-r border-border/70 bg-background md:flex md:flex-col overflow-hidden">
        <MailboxSidebar
          activeMailboxId={activeMailbox?.id ?? null}
          deletingIds={deletingIds}
          emailsLoadingIds={emailsLoadingIds}
          mailboxes={mailboxes}
          onDeleteMailbox={(mailbox) => void deleteMailbox(mailbox)}
          onFetchEmails={(mailbox) => void fetchEmails(mailbox)}
          onSelectMailbox={(mailbox) => setActiveMailboxId(mailbox.id)}
          onAccountChange={setAccountIndex}
          accountIndex={accountIndex}
          accounts={accounts}
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
              deletingIds={deletingIds}
              emailsLoadingIds={emailsLoadingIds}
              mailboxes={mailboxes}
              onDeleteMailbox={(mailbox) => void deleteMailbox(mailbox)}
              onFetchEmails={(mailbox) => void fetchEmails(mailbox)}
              onSelectMailbox={(mailbox) => {
                setActiveMailboxId(mailbox.id);
                setSidebarOpen(false);
              }}
              onAccountChange={setAccountIndex}
              accountIndex={accountIndex}
              accounts={accounts}
            />
          </aside>
        </div>
      ) : null}

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/[0.18]">
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
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
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

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="mx-auto flex w-full min-h-0 max-w-4xl flex-1 flex-col">
            <section className="relative flex min-h-0 flex-1 flex-col">
              <div
                ref={logRef}
                className="min-h-0 flex-1 overflow-y-auto"
              >
                {logs.length === 0 ? (
                  <div className="flex h-full items-center justify-center px-6">
                    <p className="text-sm text-muted-foreground">
                      生成邮箱或查询邮件后，结果将显示在这里
                    </p>
                  </div>
                ) : (
                  <div className="px-5 py-5 font-mono text-xs leading-7">
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

        <div className="absolute bottom-6 right-6 flex flex-col gap-3">
          <TooltipProvider>
          {logs.length > 0 && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full border bg-background shadow-lg transition hover:bg-accent"
                    onClick={() => setLogs([])}
                  />
                }
              >
                <Trash2Icon className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent side="left">清空日志</TooltipContent>
            </Tooltip>
          )}
          {activeMailbox && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full border bg-background shadow-lg transition hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                    onClick={() => void fetchEmails(activeMailbox)}
                    disabled={emailsLoadingIds.includes(activeMailbox.id)}
                  />
                }
              >
                {emailsLoadingIds.includes(activeMailbox.id) ? (
                  <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <RefreshCwIcon className="h-4 w-4 text-muted-foreground" />
                )}
              </TooltipTrigger>
              <TooltipContent side="left">刷新邮件</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <Popover>
              <TooltipTrigger
                render={
                  <PopoverTrigger
                    render={
                      <button
                        type="button"
                        className="flex h-10 w-10 items-center justify-center rounded-full border bg-background shadow-lg transition hover:bg-accent"
                      />
                    }
                  />
                }
              >
                <AtSignIcon className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent side="left">自定义生成邮箱</TooltipContent>
              <PopoverContent side="top" align="end" className="w-64 gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">邮箱前缀（留空则随机）</span>
                <Input
                  placeholder="随机前缀"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">域名</span>
                <Select
                  value={domain}
                  onValueChange={(value) => setDomain(value as DomainValue)}
                >
                  <SelectTrigger className="w-full">
                    <span className="truncate">
                      {DOMAINS.find((d) => d.value === domain)?.label ?? "随机域名"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {DOMAINS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={() => void allocateMailbox(true)}
                disabled={loading}
              >
                {loading ? (
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                ) : (
                  "生成邮箱"
                )}
              </Button>
            </PopoverContent>
            </Popover>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full border bg-background shadow-lg transition hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => void allocateMailbox()}
                  disabled={loading}
                />
              }
            >
              {loading ? (
                <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <MailPlusIcon className="h-4 w-4 text-muted-foreground" />
              )}
            </TooltipTrigger>
            <TooltipContent side="left">随机生成邮箱</TooltipContent>
          </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
