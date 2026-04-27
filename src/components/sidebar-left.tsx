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
  FileTextIcon,
  KeyRoundIcon,
  MailIcon,
  MessageCircleIcon,
} from "lucide-react"
const navSecondary: { title: string; url: string; icon: React.ReactNode; badge?: React.ReactNode }[] = []

export function SidebarLeft({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const navMainSections = [
    {
      title: "工作区",
      items: [
        {
          title: "聊天",
          url: "/dashboard/chat",
          icon: <MessageCircleIcon />,
          isActive: pathname.startsWith("/dashboard/chat"),
        },
        {
          title: "笔记",
          url: "/dashboard/notes",
          icon: <FileTextIcon />,
          isActive: pathname.startsWith("/dashboard/notes"),
        },
        {
          title: "Key 管理",
          url: "/dashboard/keys",
          icon: <KeyRoundIcon />,
          isActive: pathname.startsWith("/dashboard/keys"),
        },
      ],
    },
    {
      title: "工具箱",
      items: [
        {
          title: "临时邮箱",
          url: "/dashboard/mail",
          icon: <MailIcon />,
          isActive: pathname.startsWith("/dashboard/mail"),
        },
      ],
    },
  ]

  return (
    <Sidebar className="border-r-0" {...props}>
      <SidebarHeader className="px-4 pt-4 pb-0">
        <TeamSwitcher name="light" />
      </SidebarHeader>
      <SidebarContent className="px-4 pt-6 pb-4">
        <NavMain sections={navMainSections} />
        <NavSecondary
          items={navSecondary.map((item) => ({
            ...item,
            isActive: pathname.startsWith(item.url),
          }))}
          className="mt-5"
        />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
