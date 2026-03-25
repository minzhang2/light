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
  useSidebar,
} from "@/components/ui/sidebar"
import {
  ChevronsUpDownIcon,
  BadgeCheckIcon,
  BellIcon,
  LogOutIcon,
  BadgePlusIcon,
  ShieldCheckIcon,
} from "lucide-react"
import { signOut } from "next-auth/react"

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
                <BadgeCheckIcon
                />
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
              <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
                <LogOutIcon
                />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
