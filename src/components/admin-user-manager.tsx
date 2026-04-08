"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldCheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { formatInAppTimeZone } from "@/lib/date-time";
import { compareManagedUsers } from "@/features/admin-users/sort";
import type { ManagedUserListItem } from "@/features/admin-users/types";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function formatDateTime(value: string) {
  return formatInAppTimeZone(value, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatOptionalDateTime(value: string | null) {
  if (!value) {
    return "暂无";
  }
  return formatDateTime(value);
}

function getActivityBadge(lastActiveAt: string | null, now: number | null) {
  if (!lastActiveAt) {
    return {
      label: "暂无活跃记录",
      className: "bg-muted text-muted-foreground",
    };
  }

  if (now === null) {
    return {
      label: "活跃状态加载中",
      className: "bg-muted text-muted-foreground",
    };
  }

  const diff = Math.max(0, now - new Date(lastActiveAt).getTime());

  if (diff <= DAY_IN_MS) {
    return {
      label: "24 小时内活跃",
      className: "bg-emerald-500/10 text-emerald-600",
    };
  }

  if (diff <= DAY_IN_MS * 7) {
    return {
      label: "7 天内活跃",
      className: "bg-amber-500/10 text-amber-700",
    };
  }

  return {
    label: "超过 7 天未活跃",
    className: "bg-muted text-muted-foreground",
  };
}

export function AdminUserManager({
  initialUsers,
  currentAdminEmail,
}: {
  initialUsers: ManagedUserListItem[];
  currentAdminEmail: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [targetEmail, setTargetEmail] = useState("");
  const [updatingUserEmail, setUpdatingUserEmail] = useState<string | null>(null);
  const [referenceNow, setReferenceNow] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setReferenceNow(Date.now());
  }, []);

  const stats = useMemo(() => {
    const adminCount = users.filter((user) => user.role === "admin").length;
    const activeIn24Hours =
      referenceNow === null
        ? null
        : users.filter((user) => {
            if (!user.activity.lastActiveAt) {
              return false;
            }
            return referenceNow - new Date(user.activity.lastActiveAt).getTime() <= DAY_IN_MS;
          }).length;
    const activeIn7Days =
      referenceNow === null
        ? null
        : users.filter((user) => {
            if (!user.activity.lastActiveAt) {
              return false;
            }
            return referenceNow - new Date(user.activity.lastActiveAt).getTime() <= DAY_IN_MS * 7;
          }).length;

    return {
      total: users.length,
      admins: adminCount,
      users: users.length - adminCount,
      activeIn24Hours,
      activeIn7Days,
    };
  }, [referenceNow, users]);

  async function handleRoleUpdate(email: string, role: "admin" | "user") {
    setUpdatingUserEmail(email);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = (await response.json().catch(() => null)) as
        | { message?: string; user?: ManagedUserListItem }
        | null;
      if (!response.ok || !data?.user) {
        throw new Error(data?.message ?? "角色更新失败");
      }
      setUsers((current) => {
        const next = current.some((item) => item.id === data.user!.id)
          ? current.map((item) => (item.id === data.user!.id ? data.user! : item))
          : [data.user!, ...current];
        return [...next].sort(compareManagedUsers);
      });
      setTargetEmail("");
      toast({
        tone: "success",
        message: data.message ?? (role === "admin" ? "已授予管理员" : "已设为普通用户"),
      });
    } catch (error) {
      toast({ tone: "error", message: error instanceof Error ? error.message : "角色更新失败" });
    } finally {
      setUpdatingUserEmail(null);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Input
          className="flex-1"
          value={targetEmail}
          onChange={(event) => setTargetEmail(event.target.value)}
          placeholder="输入邮箱，授予管理员权限"
        />
        <Button
          type="button"
          onClick={() => handleRoleUpdate(targetEmail, "admin")}
          disabled={updatingUserEmail !== null}
        >
          <ShieldCheckIcon className="h-4 w-4" />
          设为管理员
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        共 {stats.total} 人，{stats.admins} 个管理员，{stats.users} 个普通用户，近 24 小时活跃{" "}
        {stats.activeIn24Hours ?? "--"} 人，近 7 天活跃 {stats.activeIn7Days ?? "--"} 人
      </p>

      {users.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          还没有用户。
        </div>
      ) : (
        <div className="divide-y divide-border rounded-2xl border border-border/70 bg-card shadow-sm">
          {users.map((user) => {
            const isCurrentUser = user.email === currentAdminEmail.toLowerCase();
            const isEnvAdmin = user.roleSource === "environment";
            const isUpdating = updatingUserEmail === user.email;
            const activityBadge = getActivityBadge(user.activity.lastActiveAt, referenceNow);

            return (
              <div key={user.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">
                      {user.name || user.email}
                    </span>
                    {user.role === "admin" ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                        管理员{isEnvAdmin ? "（环境变量）" : ""}
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        普通用户
                      </span>
                    )}
                    {isCurrentUser && (
                      <span className="text-[11px] text-muted-foreground">（你）</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[user.name ? user.email : null, `注册于 ${formatDateTime(user.createdAt)}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className={`rounded-full px-2 py-0.5 ${activityBadge.className}`}>
                      {activityBadge.label}
                    </span>
                    <span>最近活跃：{formatOptionalDateTime(user.activity.lastActiveAt)}</span>
                    <span>
                      聊天：{user.activity.chatSessionCount} 会话 / {user.activity.chatMessageCount} 条消息
                    </span>
                    <span>临时邮箱：{user.activity.mailboxCount} 个</span>
                    {user.activity.lastMailboxAt ? (
                      <span>最近邮箱操作：{formatDateTime(user.activity.lastMailboxAt)}</span>
                    ) : null}
                    <span>最近登录：{formatOptionalDateTime(user.lastLoginAt ?? null)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                  {user.role !== "admin" && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleRoleUpdate(user.email, "admin")}
                      disabled={isUpdating}
                    >
                      升为管理员
                    </Button>
                  )}
                  {user.role === "admin" && !isEnvAdmin && !isCurrentUser && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRoleUpdate(user.email, "user")}
                      disabled={isUpdating}
                    >
                      降为普通用户
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
