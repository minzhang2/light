import { SidebarLeft } from "@/components/sidebar-left";
import { DashboardMobileAsideProvider } from "@/components/dashboard-mobile-aside";
import { SidebarRight } from "@/components/sidebar-right";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { isEnvironmentAdminEmail } from "@/lib/auth/admin";
import { requireSession } from "@/lib/auth/require-session";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireSession();
  const canAccessAdminConsole = isEnvironmentAdminEmail(session.user.email);
  const canAccessInvites = session.user.role === "admin";
  const user = {
    name: session.user.name ?? "User",
    email: session.user.email ?? "m@example.com",
    avatar: session.user.image ?? "",
    canAccessAdminConsole,
    canAccessInvites,
  };

  return (
    <SidebarProvider>
      <SidebarLeft />
      <DashboardMobileAsideProvider user={user}>
        <SidebarInset>
          {children}
        </SidebarInset>
        <SidebarRight />
      </DashboardMobileAsideProvider>
    </SidebarProvider>
  );
}
