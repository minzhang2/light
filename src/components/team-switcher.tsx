"use client"

import Link from "next/link"

import { useSidebar } from "@/components/ui/sidebar"

export function TeamSwitcher({
  name,
}: {
  name: string
}) {
  const { isMobile, setOpenMobile } = useSidebar()
  const appInitial = name.slice(0, 1).toUpperCase()

  return (
    <Link
      href="/dashboard"
      onClick={() => {
        if (isMobile) {
          setOpenMobile(false)
        }
      }}
      className="flex items-center gap-2.5 rounded-2xl px-1 py-1 transition-colors hover:text-sidebar-foreground/80"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-sm font-semibold text-white">
        {appInitial}
      </span>
      <span className="truncate text-lg font-semibold text-sidebar-foreground">
        {name}
      </span>
    </Link>
  )
}
