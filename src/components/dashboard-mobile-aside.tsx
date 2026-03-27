"use client";

import * as React from "react";
import { PanelRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

type DashboardAsideUser = {
  name: string;
  email: string;
  avatar?: string;
  canAccessAdminConsole?: boolean;
  canAccessInvites?: boolean;
};

type DashboardMobileAsideContextValue = {
  user: DashboardAsideUser;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  openMobile: boolean;
  setOpenMobile: React.Dispatch<React.SetStateAction<boolean>>;
  isMobile: boolean;
  toggle: () => void;
};

const DashboardMobileAsideContext =
  React.createContext<DashboardMobileAsideContextValue | null>(null);

export function DashboardMobileAsideProvider({
  user,
  children,
}: {
  user: DashboardAsideUser;
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(true);
  const [openMobile, setOpenMobile] = React.useState(false);

  const toggle = React.useCallback(() => {
    if (isMobile) {
      setOpenMobile((value) => !value);
      return;
    }

    setOpen((value) => !value);
  }, [isMobile]);

  return (
    <DashboardMobileAsideContext.Provider
      value={{
        user,
        open,
        setOpen,
        openMobile,
        setOpenMobile,
        isMobile,
        toggle,
      }}
    >
      {children}
    </DashboardMobileAsideContext.Provider>
  );
}

export function DashboardMobileAsideTrigger() {
  const context = React.useContext(DashboardMobileAsideContext);

  if (!context) return null;

  const userInitial = context.user.name.slice(0, 1).toUpperCase() || "U";

  return (
    <Button
      onClick={context.toggle}
      size="sm"
      type="button"
      variant="ghost"
      className="h-9 rounded-2xl bg-transparent px-1.5 hover:bg-muted/90"
    >
      <span className="flex size-7 items-center justify-center rounded-xl bg-zinc-900 text-xs font-semibold text-white">
        {userInitial}
      </span>
      <PanelRightIcon className="size-3.5 text-muted-foreground" />
      <span className="sr-only">切换右侧边栏</span>
    </Button>
  );
}

export function useDashboardMobileAside() {
  const context = React.useContext(DashboardMobileAsideContext);

  if (!context) {
    throw new Error(
      "useDashboardMobileAside must be used within DashboardMobileAsideProvider.",
    );
  }

  return context;
}
