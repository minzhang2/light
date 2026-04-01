"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type SwitchProps = Omit<React.ComponentProps<"button">, "onChange"> & {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

function Switch({
  checked = false,
  onCheckedChange,
  className,
  disabled,
  type = "button",
  ...props
}: SwitchProps) {
  return (
    <button
      type={type}
      role="switch"
      aria-checked={checked}
      data-checked={checked ? "true" : "false"}
      disabled={disabled}
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent bg-muted px-0.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[checked=true]:bg-primary",
        className,
      )}
      onClick={() => {
        if (disabled) return;
        onCheckedChange?.(!checked);
      }}
      {...props}
    >
      <span
        className={cn(
          "block size-5 rounded-full bg-background shadow-sm transition-transform data-[checked=true]:translate-x-5",
        )}
        data-checked={checked ? "true" : "false"}
      />
    </button>
  );
}

export { Switch };
