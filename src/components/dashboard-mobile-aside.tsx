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

  return (
    <Button onClick={context.toggle} size="icon-sm" type="button" variant="ghost">
      <PanelRightIcon />
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
