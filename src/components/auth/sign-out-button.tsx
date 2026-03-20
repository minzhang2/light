"use client";

import type { VariantProps } from "class-variance-authority";
import { signOut } from "next-auth/react";

import { Button, buttonVariants } from "@/components/ui/button";

type SignOutButtonProps = VariantProps<typeof buttonVariants> & {
  className?: string;
};

export function SignOutButton({
  className,
  variant = "default",
  size = "default",
}: SignOutButtonProps) {
  return (
    <Button
      className={className}
      onClick={() => signOut({ callbackUrl: "/login" })}
      size={size}
      type="button"
      variant={variant}
    >
      退出登录
    </Button>
  );
}
