import { useState } from "react";
import {
  ClipboardIcon,
  Loader2Icon,
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
import { cn } from "@/lib/utils";
import type { MailAccount, Mailbox } from "./types";

interface MailboxSidebarProps {
  accounts: MailAccount[];
  activeMailboxId: number | null;
  deletingIds: number[];
  emailsLoadingIds: number[];
  isInitialLoading: boolean;
  mailboxes: Mailbox[];
  onDeleteMailbox: (mailbox: Mailbox) => void;
  onFetchEmails: (mailbox: Mailbox) => void;
  onSelectMailbox: (mailbox: Mailbox) => void;
  onAccountChange: (index: number) => void;
  accountIndex: number;
  onCopyMailbox: (email: string) => void;
}

export function MailboxSidebar({
  accounts,
  activeMailboxId,
  deletingIds,
  emailsLoadingIds,
  isInitialLoading,
  mailboxes,
  onDeleteMailbox,
  onFetchEmails,
  onSelectMailbox,
  onAccountChange,
  accountIndex,
  onCopyMailbox,
}: MailboxSidebarProps) {
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
        {isInitialLoading ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            加载中...
          </p>
        ) : mailboxes.length === 0 ? (
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
