"use client"

import Link from "next/link"

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
  sections,
}: {
  sections: {
    title: string
    items: {
      title: string
      url: string
      icon: React.ReactNode
      isActive?: boolean
    }[]
  }[]
}) {
  return (
    <div className="space-y-7">
      {sections.map((section) => (
        <section key={section.title}>
          <h3 className="px-2 text-xs font-semibold tracking-wide text-sidebar-foreground/55">
            {section.title}
          </h3>
          <SidebarMenu className="mt-2 gap-1.5">
            {section.items.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  className="h-10 rounded-2xl px-3 text-sm font-medium text-sidebar-foreground/95 [&_svg]:size-4 [&_svg]:text-sidebar-foreground/65 data-[active=true]:bg-sidebar-accent/90"
                  isActive={item.isActive}
                  render={<Link href={item.url} />}
                  size="default"
                >
                  {item.icon}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </section>
      ))}
    </div>
  )
}
