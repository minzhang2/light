"use client"

import { useRouter } from "next/navigation"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  ChevronsUpDownIcon,
  BellIcon,
  BadgePlusIcon,
  ShieldCheckIcon,
  UserRoundIcon,
} from "lucide-react"
import {
  SignOutDropdownMenuItem,
  SignOutSidebarMenuItem,
} from "@/components/auth/sign-out-button"

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar?: string
    canAccessAdminConsole?: boolean
    canAccessInvites?: boolean
  }
}) {
  const router = useRouter()
  const { isMobile } = useSidebar()
  const avatarFallback = user.name.slice(0, 1).toUpperCase()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
            }
          >
            <Avatar>
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback>{avatarFallback}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs">{user.email}</span>
            </div>
            <ChevronsUpDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="start"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar>
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback>{avatarFallback}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs">{user.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push("/dashboard/account")}>
                <UserRoundIcon />
                账户中心
              </DropdownMenuItem>
              {user.canAccessAdminConsole ? (
                <DropdownMenuItem onClick={() => router.push("/dashboard/admin")}>
                  <ShieldCheckIcon />
                  管理后台
                </DropdownMenuItem>
              ) : null}
              {user.canAccessInvites ? (
                <DropdownMenuItem onClick={() => router.push("/dashboard/invites")}>
                  <BadgePlusIcon />
                  邀请码
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem>
                <BellIcon
                />
                通知设置
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <SignOutDropdownMenuItem />
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export function NavUserPanel({
  user,
}: {
  user: {
    name: string
    email: string
    avatar?: string
    canAccessAdminConsole?: boolean
    canAccessInvites?: boolean
  }
}) {
  const router = useRouter()
  const avatarFallback = user.name.slice(0, 1).toUpperCase()

  return (
    <div>
      <div className="flex items-center gap-3 px-3 py-3">
        <Avatar>
          <AvatarImage src={user.avatar} alt={user.name} />
          <AvatarFallback>{avatarFallback}</AvatarFallback>
        </Avatar>
        <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
          <span className="truncate font-medium">{user.name}</span>
          <span className="truncate text-xs text-muted-foreground">{user.email}</span>
        </div>
      </div>

      <SidebarSeparator className="mx-0" />

      <SidebarMenu className="px-2 py-2">
        <SidebarMenuItem>
          <SidebarMenuButton onClick={() => router.push("/dashboard/account")} size="lg">
            <UserRoundIcon />
            <span>账户中心</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        {user.canAccessAdminConsole ? (
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => router.push("/dashboard/admin")} size="lg">
              <ShieldCheckIcon />
              <span>管理后台</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : null}
        {user.canAccessInvites ? (
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => router.push("/dashboard/invites")} size="lg">
              <BadgePlusIcon />
              <span>邀请码</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : null}
        <SidebarMenuItem>
          <SidebarMenuButton size="lg">
            <BellIcon />
            <span>通知设置</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>

      <SidebarSeparator className="mx-0" />

      <SidebarMenu className="px-2 py-2">
        <SignOutSidebarMenuItem />
      </SidebarMenu>
    </div>
  )
}
