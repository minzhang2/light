"use client"

import type { ReactNode } from "react"

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
        <div className="px-2 py-1 text-sm font-medium text-sidebar-foreground">
          light
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
