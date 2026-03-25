"use client";

import { useMemo, useState } from "react";
import { ShieldCheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { compareManagedUsers } from "@/features/admin-users/sort";
import type { ManagedUserListItem } from "@/features/admin-users/types";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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
  const { toast } = useToast();

  const stats = useMemo(() => {
    const adminCount = users.filter((user) => user.role === "admin").length;
    return { total: users.length, admins: adminCount, users: users.length - adminCount };
  }, [users]);

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
        共 {stats.total} 人，{stats.admins} 个管理员，{stats.users} 个普通用户
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

            return (
              <div key={user.id} className="flex items-center gap-3 px-4 py-3">
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
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
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
