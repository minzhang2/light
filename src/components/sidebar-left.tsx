"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  AudioLinesIcon,
  KeyRoundIcon,
  LifeBuoyIcon,
  MailIcon,
  RefreshCcwIcon,
  TerminalIcon,
} from "lucide-react"

// This is sample data.
const data = {
  teams: [
    {
      name: "Acme Inc",
      logo: (
        <TerminalIcon
        />
      ),
      plan: "Enterprise",
    },
    {
      name: "Acme Corp.",
      logo: (
        <AudioLinesIcon
        />
      ),
      plan: "Startup",
    },
    {
      name: "Evil Corp.",
      logo: (
        <TerminalIcon
        />
      ),
      plan: "Free",
    },
  ],
  navSecondary: [
    {
      title: "刷新页面",
      url: "/dashboard",
      icon: (
        <RefreshCcwIcon
        />
      ),
    },
    {
      title: "帮助",
      url: "/dashboard/keys",
      icon: (
        <LifeBuoyIcon
        />
      ),
    },
  ],
}

export function SidebarLeft({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const navMain = [
    {
      title: "Key 管理",
      url: "/dashboard/keys",
      icon: (
        <KeyRoundIcon
        />
      ),
      isActive: pathname.startsWith("/dashboard/keys"),
    },
    {
      title: "临时邮箱",
      url: "/dashboard/mail",
      icon: (
        <MailIcon
        />
      ),
      isActive: pathname.startsWith("/dashboard/mail"),
    },
  ]

  return (
    <Sidebar className="border-r-0" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
        <NavMain items={navMain} />
      </SidebarHeader>
      <SidebarContent>
        <NavSecondary
          items={data.navSecondary.map((item) => ({
            ...item,
            isActive: pathname.startsWith(item.url),
          }))}
          className="mt-auto"
        />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
