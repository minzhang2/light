"use client"

import * as React from "react"
import { ChineseDatePicker } from "@/components/chinese-date-picker"
import { useDashboardMobileAside } from "@/components/dashboard-mobile-aside"
import { NavUser, NavUserPanel } from "@/components/nav-user"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader as SheetHeaderPrimitive,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  SidebarContent,
  SidebarHeader,
} from "@/components/ui/sidebar"

const RIGHT_SIDEBAR_WIDTH = "16rem"
const RIGHT_SIDEBAR_WIDTH_MOBILE = "min(24rem, calc(100vw - 1rem))"

function SidebarCalendarSection() {
  return (
    <div className="px-3 py-3">
      <ChineseDatePicker />
    </div>
  )
}

export function SidebarRight({
  ...props
}: React.ComponentProps<"div">) {
  const { user, open, openMobile, setOpenMobile, isMobile } =
    useDashboardMobileAside()

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent
          data-mobile="true"
          className="w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
          style={
            {
              "--sidebar-width": RIGHT_SIDEBAR_WIDTH_MOBILE,
            } as React.CSSProperties
          }
          side="right"
        >
          <SheetHeaderPrimitive className="sr-only">
            <SheetTitle>Sidebar</SheetTitle>
            <SheetDescription>Displays the mobile sidebar.</SheetDescription>
          </SheetHeaderPrimitive>
          <div className="flex h-full w-full flex-col">
            <SidebarHeader className="p-0">
              <NavUserPanel user={user} />
            </SidebarHeader>
            <SidebarContent className="gap-0">
              <SidebarCalendarSection />
            </SidebarContent>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <div
      className="group peer hidden text-sidebar-foreground md:block"
      data-collapsible={open ? "" : "offcanvas"}
      data-side="right"
      data-slot="sidebar"
      data-state={open ? "expanded" : "collapsed"}
      style={
        {
          "--sidebar-width": RIGHT_SIDEBAR_WIDTH,
        } as React.CSSProperties
      }
    >
      <div
        data-slot="sidebar-gap"
        className="relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear group-data-[collapsible=offcanvas]:w-0 group-data-[side=right]:rotate-180"
      />
      <div
        data-side="right"
        data-slot="sidebar-container"
        className={cn(
          "fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear data-[side=right]:right-0 data-[side=right]:group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)] md:flex",
          "border-l",
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
          className="flex size-full flex-col bg-sidebar"
        >
          <SidebarHeader className="h-16 border-b border-sidebar-border">
            <NavUser user={user} />
          </SidebarHeader>
          <SidebarContent className="gap-0">
            <SidebarCalendarSection />
          </SidebarContent>
        </div>
      </div>
    </div>
  )
}
