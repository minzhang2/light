"use client"

import * as React from "react"

import { ChineseDatePicker } from "@/components/chinese-date-picker"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/ui/sidebar"

export function SidebarRight({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: {
    name: string
    email: string
    avatar?: string
    canAccessAdminConsole?: boolean
    canAccessInvites?: boolean
  }
}) {
  return (
    <Sidebar
      collapsible="none"
      className="sticky top-0 hidden h-svh border-l lg:flex"
      {...props}
    >
      <SidebarHeader className="h-16 border-b border-sidebar-border">
        <NavUser user={user} />
      </SidebarHeader>
      <SidebarContent>
        <ChineseDatePicker />
      </SidebarContent>
    </Sidebar>
  )
}
