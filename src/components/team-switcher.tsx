"use client"

import type { ReactNode } from "react"
import Link from "next/link"

import { SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar"

export function TeamSwitcher({
  teams: _teams,
}: {
  teams: {
    name: string
    logo: ReactNode
    plan: string
  }[]
}) {
  void _teams

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Link
          href="/dashboard"
          className="block px-2 py-1 text-sm font-medium text-sidebar-foreground hover:text-sidebar-foreground/80 transition-colors"
        >
          light
        </Link>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
