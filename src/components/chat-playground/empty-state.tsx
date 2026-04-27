import Link from "next/link";
import { MessageCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyKeysState() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <section className="rounded-[2rem] border border-dashed border-border/70 bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-3">
          <div className="rounded-2xl bg-muted p-3 text-muted-foreground">
            <MessageCircleIcon className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-semibold">还没有可用的聊天 key</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            这个聊天页只展示已测试通过、并且识别出可用模型的 key。先去 Key 管理导入并测试 key，再回来聊天。
          </p>
          <Button
            nativeButton={false}
            render={<Link href="/dashboard/keys" />}
            className="mt-2"
          >
            前往 Key 管理
          </Button>
        </div>
      </section>
    </div>
  );
}
