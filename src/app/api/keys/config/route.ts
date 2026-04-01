import { NextResponse } from "next/server";

import { getGlobalConfig, setGlobalConfig } from "@/features/managed-keys/service";
import { getApiErrorMessage } from "@/lib/api-error";
import { getSessionOrNull } from "@/lib/auth/require-session";

export async function GET() {
  const session = await getSessionOrNull();

  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  try {
    const config = await getGlobalConfig();
    return NextResponse.json({ config });
  } catch (error) {
    const message = getApiErrorMessage(error, "获取配置失败，请稍后重试。");
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getSessionOrNull();

  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as {
      preferredModels?: unknown;
      exhaustiveModelTesting?: unknown;
    };
    const config = await setGlobalConfig({
      preferredModels:
        Array.isArray(payload.preferredModels) &&
        payload.preferredModels.every((m) => typeof m === "string")
          ? (payload.preferredModels as string[])
          : undefined,
      exhaustiveModelTesting:
        typeof payload.exhaustiveModelTesting === "boolean"
          ? payload.exhaustiveModelTesting
          : undefined,
    });

    return NextResponse.json({ config });
  } catch (error) {
    const message = getApiErrorMessage(error, "保存配置失败，请稍后重试。");
    return NextResponse.json({ message }, { status: 400 });
  }
}
