"use client"

import Link from "next/link"

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
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
  const { isMobile, setOpenMobile } = useSidebar()

  function handleItemClick() {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <section key={section.title}>
          <h3 className="px-3 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/40">
            {section.title}
          </h3>
          <SidebarMenu className="mt-1.5 gap-0.5">
            {section.items.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  className="h-9 rounded-lg px-3 text-[13px] font-medium text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground [&_svg]:size-4 [&_svg]:text-sidebar-foreground/50 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground [&[data-active=true]_svg]:text-sidebar-foreground/80"
                  isActive={item.isActive}
                  render={<Link href={item.url} />}
                  onClick={handleItemClick}
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
