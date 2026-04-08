"use client";

import { useMemo, useState } from "react";
import { ClipboardIcon, PlusIcon, Trash2Icon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { formatInAppTimeZone } from "@/lib/date-time";
import type { InviteCodeListItem } from "@/features/invite-codes/types";

function formatDateTime(value: string | null) {
  if (!value) return null;
  return formatInAppTimeZone(value, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function InviteCodeManager({
  initialInviteCodes,
}: {
  initialInviteCodes: InviteCodeListItem[];
}) {
  const [inviteCodes, setInviteCodes] = useState(initialInviteCodes);
  const [note, setNote] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const stats = useMemo(() => {
    const usedCount = inviteCodes.filter((item) => item.usedAt).length;
    return { total: inviteCodes.length, used: usedCount, unused: inviteCodes.length - usedCount };
  }, [inviteCodes]);

  const deleteTarget = deleteTargetId
    ? inviteCodes.find((item) => item.id === deleteTargetId) ?? null
    : null;

  async function copyToClipboard(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast({ tone: "success", message: "已复制" });
    } catch {
      toast({ tone: "error", message: "复制失败" });
    }
  }

  async function handleCreate() {
    setIsCreating(true);
    try {
      const response = await fetch("/api/invite-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() }),
      });
      const data = (await response.json().catch(() => null)) as
        | { message?: string; inviteCode?: InviteCodeListItem }
        | null;
      if (!response.ok || !data?.inviteCode) {
        throw new Error(data?.message ?? "生成失败");
      }
      setInviteCodes((current) => [data.inviteCode!, ...current]);
      setNote("");
      toast({ tone: "success", message: `${data.inviteCode.code} 已生成并复制` });
      await navigator.clipboard.writeText(data.inviteCode.code).catch(() => null);
    } catch (error) {
      toast({ tone: "error", message: error instanceof Error ? error.message : "生成失败" });
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingIds((current) => ({ ...current, [id]: true }));
    try {
      const response = await fetch(`/api/invite-codes/${id}`, { method: "DELETE" });
      const data = (await response.json().catch(() => null)) as
        | { message?: string; inviteCodes?: InviteCodeListItem[] }
        | null;
      if (!response.ok || !data?.inviteCodes) {
        throw new Error(data?.message ?? "删除失败");
      }
      setInviteCodes(data.inviteCodes);
      setDeleteTargetId((current) => (current === id ? null : current));
      toast({ tone: "success", message: "已删除" });
    } catch (error) {
      toast({ tone: "error", message: error instanceof Error ? error.message : "删除失败" });
    } finally {
      setDeletingIds((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Input
          className="flex-1"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="备注（可选）"
        />
        <Button type="button" onClick={handleCreate} disabled={isCreating}>
          <PlusIcon className="h-4 w-4" />
          {isCreating ? "生成中..." : "生成邀请码"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        共 {stats.total} 个，{stats.unused} 个未使用，{stats.used} 个已使用
      </p>

      {inviteCodes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          还没有邀请码，先生成一个。
        </div>
      ) : (
        <div className="divide-y divide-border rounded-2xl border border-border/70 bg-card shadow-sm">
          {inviteCodes.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold tracking-widest">
                    {item.code}
                  </span>
                  {item.usedAt ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      已使用
                    </span>
                  ) : (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                      可用
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[
                    item.note,
                    formatDateTime(item.createdAt)
                      ? `创建于 ${formatDateTime(item.createdAt)}`
                      : null,
                    item.usedByEmail ? `使用者 ${item.usedByEmail}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  onClick={() => copyToClipboard(item.code)}
                >
                  <ClipboardIcon className="h-3.5 w-3.5" />
                </Button>
                {!item.usedAt && (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="destructive"
                    onClick={() => setDeleteTargetId(item.id)}
                    disabled={Boolean(deletingIds[item.id])}
                  >
                    <Trash2Icon className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog
        open={Boolean(deleteTargetId)}
        onOpenChange={(open) => {
          if (!open && deleteTargetId && !deletingIds[deleteTargetId]) {
            setDeleteTargetId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除？</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? (
                <>
                  将删除 <span className="font-medium text-foreground">{deleteTarget.code}</span>
                  ，不可撤销。
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
              onClick={() => setDeleteTargetId(null)}
              disabled={Boolean(deleteTargetId && deletingIds[deleteTargetId])}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (deleteTargetId) void handleDelete(deleteTargetId);
              }}
              disabled={Boolean(deleteTargetId && deletingIds[deleteTargetId])}
            >
              {deleteTargetId && deletingIds[deleteTargetId] ? "删除中..." : "确认删除"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
