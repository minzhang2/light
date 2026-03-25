"use client";

import { useCallback, useRef, useState } from "react";

import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ChevronDownIcon } from "lucide-react";

const TOKENS = [
  {
    label: "1018644425@qq.com (uid 219)",
    value:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoyMTksImV4cCI6MTc3NjQyMDIxNX0.rx5K7uwvKxOveNxmTOdIP0qh-aXSXpnmJuXWLfMOV-I",
  },
  {
    label: "yuansi.zm@gmail.com (uid 185)",
    value:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxODUsImV4cCI6MTc3NjkxMTIxNH0.NcgQAfCIr3sQ1YtWT2_7DB2uiBiTrjeWddViasJCv4s",
  },
];

const API_BASE = "https://zjkdongao.cn/mail-api/v1";

interface Mailbox {
  id: number;
  email: string;
  created_at: number;
  remaining_requests_today: number;
}

interface Email {
  id: number;
  subject: string;
  from_addr: string;
  mailbox_id: number;
  mailbox_email: string;
  verification_code?: string;
  [key: string]: unknown;
}

interface LogEntry {
  time: string;
  type: "info" | "success" | "error";
  message: string;
}

function now() {
  return new Date().toLocaleTimeString("zh-CN", { hour12: false });
}

export default function MailPage() {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [selectedMailbox, setSelectedMailbox] = useState<Mailbox | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(false);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [token, setToken] = useState(TOKENS[0].value);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // 收取特定邮箱验证码
  const [specificMailboxId, setSpecificMailboxId] = useState("");
  const [specificLoading, setSpecificLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const logRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((type: LogEntry["type"], message: string) => {
    setLogs((prev) => [...prev, { time: now(), type, message }]);
    setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 50);
  }, []);

  async function allocateMailbox() {
    setLoading(true);
    addLog("info", "正在分配新邮箱…");
    try {
      const res = await fetch(`${API_BASE}/mailboxes/allocate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.code === 0 && json.data) {
        const mb: Mailbox = json.data;
        setMailboxes((prev) => [mb, ...prev]);
        setSelectedMailbox(mb);
        setSpecificMailboxId(String(mb.id));
        addLog("success", `分配成功: ${mb.email} (ID: ${mb.id}), 今日剩余: ${mb.remaining_requests_today}`);
      } else {
        addLog("error", `分配失败: ${json.message}`);
      }
    } catch (e) {
      addLog("error", `请求异常: ${e}`);
    } finally {
      setLoading(false);
    }
  }

  async function fetchEmails(mailbox: Mailbox) {
    setSelectedMailbox(mailbox);
    setEmailsLoading(true);
    setEmails([]);
    addLog("info", `查询 ${mailbox.email} 的邮件…`);
    try {
      const url = new URL(`${API_BASE}/unified-emails/user/emails`);
      url.searchParams.set("type", "system");
      url.searchParams.set("mailbox_id", String(mailbox.id));
      url.searchParams.set("page", "1");
      url.searchParams.set("page_size", "20");
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.code === 0 && json.data?.emails) {
        setEmails(json.data.emails);
        const codes = (json.data.emails as Email[])
          .filter((e) => e.verification_code)
          .map((e) => e.verification_code);
        addLog(
          "success",
          `获取到 ${json.data.emails.length} 封邮件` +
            (codes.length ? `，验证码: ${codes.join(", ")}` : ""),
        );
      } else {
        addLog("error", `获取邮件失败: ${json.message}`);
      }
    } catch (e) {
      addLog("error", `请求异常: ${e}`);
    } finally {
      setEmailsLoading(false);
    }
  }

  // 查询特定邮箱ID的验证码
  async function fetchSpecificMailbox() {
    const raw = specificMailboxId.trim();
    if (!raw) return;
    // 支持输入邮箱地址，从已分配列表中查找对应 ID
    let mbId = raw;
    if (!/^\d+$/.test(raw)) {
      const found = mailboxes.find((mb) => mb.email === raw);
      if (found) {
        mbId = String(found.id);
      } else {
        addLog("error", `"${raw}" 不是数字 ID，且不在本次已分配列表中。API 仅支持数字 ID 查询。`);
        return;
      }
    }
    setSpecificLoading(true);
    addLog("info", `查询邮箱 ID ${mbId} 的验证码…`);
    try {
      const url = new URL(`${API_BASE}/unified-emails/user/emails`);
      url.searchParams.set("type", "system");
      url.searchParams.set("mailbox_id", mbId);
      url.searchParams.set("page", "1");
      url.searchParams.set("page_size", "20");
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.code === 0 && json.data?.emails) {
        const list = json.data.emails as Email[];
        if (list.length === 0) {
          addLog("info", `邮箱 ID ${mbId}: 暂无邮件`);
        } else {
          for (const em of list) {
            addLog(
              "success",
              `[${em.mailbox_email}] ${em.subject} | 来自: ${em.from_addr}${em.verification_code ? ` | 验证码: ${em.verification_code}` : ""}`,
            );
          }
        }
      } else {
        addLog("error", `查询失败: ${json.message}`);
      }
    } catch (e) {
      addLog("error", `请求异常: ${e}`);
    } finally {
      setSpecificLoading(false);
    }
  }

  // 轮询特定邮箱
  function togglePolling() {
    if (polling) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = null;
      setPolling(false);
      addLog("info", "已停止轮询");
    } else {
      if (!specificMailboxId.trim()) return;
      setPolling(true);
      addLog("info", `开始每 5 秒轮询邮箱 ID ${specificMailboxId.trim()}…`);
      fetchSpecificMailbox();
      pollingRef.current = setInterval(fetchSpecificMailbox, 5000);
    }
  }

  return (
    <>
      <DashboardPageHeader
        title="临时邮箱"
        description="分配临时邮箱并获取验证码"
      />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        {/* Token 切换 */}
        <div className="flex items-center gap-3">
          <label className="shrink-0 text-sm font-medium text-slate-700">
            Bearer Token
          </label>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
            >
              <span className="truncate">
                {TOKENS.find((t) => t.value === token)?.label ?? "自定义 Token"}
              </span>
              <ChevronDownIcon className="size-4 shrink-0 text-slate-400" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuRadioGroup
                value={token}
                onValueChange={(v) => setToken(v as string)}
              >
                {TOKENS.map((t) => (
                  <DropdownMenuRadioItem key={t.label} value={t.value}>
                    {t.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* 操作区 */}
        <div className="flex items-center gap-3">
          <Button onClick={allocateMailbox} disabled={loading}>
            {loading ? "分配中…" : "生成新邮箱"}
          </Button>
          <div className="h-6 w-px bg-slate-200" />
          <Input
            className="w-28 font-mono text-sm"
            value={specificMailboxId}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSpecificMailboxId(e.target.value)
            }
            placeholder="数字 ID"
          />
          <Button
            variant="outline"
            onClick={fetchSpecificMailbox}
            disabled={specificLoading || !specificMailboxId.trim()}
          >
            {specificLoading ? "查询中…" : "收取验证码"}
          </Button>
          <Button
            variant={polling ? "destructive" : "outline"}
            onClick={togglePolling}
            disabled={!specificMailboxId.trim()}
          >
            {polling ? "停止轮询" : "自动轮询"}
          </Button>
        </div>

        {/* Mailbox list */}
        {mailboxes.length > 0 && (
          <div className="rounded-xl border border-border/70 bg-white shadow-sm">
            <div className="border-b px-4 py-3 text-sm font-medium text-slate-700">
              已分配邮箱 ({mailboxes.length})
            </div>
            <div className="divide-y">
              {mailboxes.map((mb) => (
                <div
                  key={mb.id}
                  className={`flex items-center justify-between px-4 py-3 ${
                    selectedMailbox?.id === mb.id ? "bg-sky-50" : ""
                  }`}
                >
                  <div>
                    <span className="font-mono text-sm">{mb.email}</span>
                    <span className="ml-3 text-xs text-slate-400">
                      ID: {mb.id}
                    </span>
                    <span className="ml-3 text-xs text-slate-400">
                      今日剩余: {mb.remaining_requests_today}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSpecificMailboxId(String(mb.id));
                      }}
                    >
                      填入ID
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchEmails(mb)}
                      disabled={emailsLoading && selectedMailbox?.id === mb.id}
                    >
                      {emailsLoading && selectedMailbox?.id === mb.id
                        ? "查询中…"
                        : "查询邮件"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Emails */}
        {selectedMailbox && (
          <div className="rounded-xl border border-border/70 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="text-sm font-medium text-slate-700">
                {selectedMailbox.email} 的邮件
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchEmails(selectedMailbox)}
                disabled={emailsLoading}
              >
                刷新
              </Button>
            </div>
            {emailsLoading ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                加载中…
              </div>
            ) : emails.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                暂无邮件，等待验证码后点击刷新
              </div>
            ) : (
              <div className="divide-y">
                {emails.map((em) => (
                  <div key={em.id} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-800">
                        {em.subject}
                      </span>
                      {em.verification_code && (
                        <button
                          className="rounded bg-sky-100 px-3 py-1 font-mono text-lg font-bold text-sky-700 transition hover:bg-sky-200"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              em.verification_code!,
                            );
                            addLog("info", `已复制验证码: ${em.verification_code}`);
                          }}
                          title="点击复制"
                        >
                          {em.verification_code}
                        </button>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {em.from_addr}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 日志面板 */}
        <div className="rounded-xl border border-border/70 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <span className="text-xs font-medium text-slate-700">日志</span>
            <button
              className="text-xs text-slate-400 hover:text-slate-600"
              onClick={() => setLogs([])}
            >
              清空
            </button>
          </div>
          <div
            ref={logRef}
            className="h-56 overflow-y-auto px-4 py-2 font-mono text-xs leading-5"
          >
            {logs.length === 0 ? (
              <span className="text-slate-400">暂无日志</span>
            ) : (
              logs.map((log, i) => (
                <div key={i}>
                  <span className="text-slate-400">[{log.time}]</span>{" "}
                  <span
                    className={
                      log.type === "error"
                        ? "text-red-500"
                        : log.type === "success"
                          ? "text-green-600"
                          : "text-slate-700"
                    }
                  >
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
