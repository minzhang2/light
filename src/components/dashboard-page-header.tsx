import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function DashboardPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 flex min-h-14 shrink-0 items-center gap-3 border-b border-border/70 bg-background/92 backdrop-blur">
      <div className="flex flex-1 items-center gap-2 px-3 py-2">
        <SidebarTrigger />
        <Separator
          orientation="vertical"
          className="mr-2"
        />
        <div className="min-w-0 flex-1">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage className="line-clamp-1 text-sm font-medium">
                  {title}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          {description ? (
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </header>
  );
}
