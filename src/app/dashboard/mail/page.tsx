"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

const API_BASE = "/api/mail";

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

  // 页面加载时从 DB 读取历史邮箱
  useEffect(() => {
    fetch("/api/mail/mailboxes")
      .then((r) => r.json())
      .then((json) => {
        if (Array.isArray(json.mailboxes) && json.mailboxes.length > 0) {
          const fromDb: Mailbox[] = json.mailboxes.map(
            (m: { id: number; email: string; createdAt: string; remainingRequestsToday: number }) => ({
              id: m.id,
              email: m.email,
              created_at: Math.floor(new Date(m.createdAt).getTime() / 1000),
              remaining_requests_today: m.remainingRequestsToday,
            }),
          );
          setMailboxes(fromDb);
          setSpecificMailboxId(String(fromDb[0].id));
        }
      })
      .catch(() => {/* 未登录或网络错误，静默忽略 */});
  }, []);

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
        setMailboxes((prev) => [mb, ...prev.filter((x) => x.id !== mb.id)]);
        setSpecificMailboxId(String(mb.id));
        addLog("success", `分配成功: ${mb.email} (ID: ${mb.id}), 今日剩余: ${mb.remaining_requests_today}`);
        // 写入 DB（fire-and-forget）
        fetch("/api/mail/mailboxes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: mb.id,
            email: mb.email,
            remaining_requests_today: mb.remaining_requests_today,
          }),
        })
          .then(async (r) => {
            if (!r.ok) {
              const t = await r.text();
              console.error("[mailbox] save to db failed:", r.status, t);
            }
          })
          .catch((e) => console.error("[mailbox] save to db failed:", e));
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
    setEmailsLoading(true);
    addLog("info", `查询 ${mailbox.email} 的邮件…`);
    try {
      const url = new URL(`${API_BASE}/unified-emails/user/emails`, window.location.origin);
      url.searchParams.set("type", "system");
      url.searchParams.set("mailbox_id", String(mailbox.id));
      url.searchParams.set("page", "1");
      url.searchParams.set("page_size", "20");
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.code === 0 && json.data?.emails) {
        const list = json.data.emails as Email[];
        if (list.length === 0) {
          addLog("info", `${mailbox.email}: 暂无邮件`);
        } else {
          const codes = list.filter((e) => e.verification_code).map((e) => e.verification_code);
          addLog(
            "success",
            `${mailbox.email}: 获取到 ${list.length} 封邮件` +
              (codes.length ? `，验证码: ${codes.join(", ")}` : ""),
          );
          for (const email of list) {
            addLog(
              "info",
              `[${email.mailbox_email}] ${email.subject} | 来自: ${email.from_addr}${
                email.verification_code ? ` | 验证码: ${email.verification_code}` : ""
              }`,
            );
          }
        }
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
      const url = new URL(`${API_BASE}/unified-emails/user/emails`, window.location.origin);
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
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        {/* 控制栏 */}
        <div className="rounded-xl border border-border/70 bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm">
                <span className="max-w-48 truncate text-slate-500">
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
            <Button onClick={allocateMailbox} disabled={loading}>
              {loading ? "分配中…" : "生成新邮箱"}
            </Button>
            <div className="h-6 w-px bg-slate-200" />
            <Input
              className="w-32 font-mono text-sm"
              value={specificMailboxId}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSpecificMailboxId(e.target.value)
              }
              placeholder="邮箱 ID"
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
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm">{mb.email}</span>
                    <span className="text-xs text-slate-400">ID: {mb.id}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchEmails(mb)}
                    disabled={emailsLoading}
                  >
                    {emailsLoading ? "查询中…" : "查询邮件"}
                  </Button>
                </div>
              ))}
            </div>
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
