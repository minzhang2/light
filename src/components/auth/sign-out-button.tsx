"use client";

import { useState } from "react";
import type { VariantProps } from "class-variance-authority";
import { signOut } from "next-auth/react";
import { LogOutIcon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type SignOutButtonProps = VariantProps<typeof buttonVariants> & {
  className?: string;
};

export function SignOutButton({
  className,
  variant = "default",
  size = "default",
}: SignOutButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        className={className}
        onClick={() => setOpen(true)}
        size={size}
        type="button"
        variant={variant}
      >
        退出登录
      </Button>
      <SignOutConfirmDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function SignOutDropdownMenuItem({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <DropdownMenuItem
      onClick={onClick}
      variant="destructive"
    >
      <LogOutIcon />
      退出登录
    </DropdownMenuItem>
  );
}

export function SignOutSidebarMenuItem({
  onClick,
}: {
  onClick?: () => void;
} = {}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          className={cn(
            "text-destructive hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive/20 active:bg-destructive/10 active:text-destructive",
            "[&_svg]:text-destructive",
          )}
          onClick={() => {
            onClick?.();
            setOpen(true);
          }}
          size="lg"
        >
          <LogOutIcon />
          <span>退出登录</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SignOutConfirmDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function SignOutConfirmDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认退出登录？</AlertDialogTitle>
          <AlertDialogDescription>
            退出后将返回登录页，如需继续使用需要重新登录。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void signOut({ callbackUrl: "/login" })}
          >
            确认退出
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
