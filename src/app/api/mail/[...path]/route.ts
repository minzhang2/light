import { NextRequest, NextResponse } from "next/server"
import { getApiErrorMessage } from "@/lib/api-error"
import { getSessionOrNull } from "@/lib/auth/require-session"
import { getMailAccountByIndex } from "@/lib/mail-accounts"

const OPEN_UPSTREAM = "https://zjkdongao.cn/open/v1"

function resolvePath(path: string[]) {
  // Frontend uses /mailboxes/allocate to avoid clashing with local /api/mail/mailboxes DB route.
  // Open API merged this into POST /mailboxes.
  if (path.length === 2 && path[0] === "mailboxes" && path[1] === "allocate") {
    return ["mailboxes"]
  }
  return path
}

async function callUpstream(
  req: NextRequest,
  path: string[],
  body: string | null,
  authHeader: string | null,
) {
  const resolvedPath = resolvePath(path)
  const upstreamUrl = new URL(`${OPEN_UPSTREAM}/${resolvedPath.join("/")}`)
  req.nextUrl.searchParams.forEach((v, k) => upstreamUrl.searchParams.set(k, v))

  const headers: Record<string, string> = {}
  if (authHeader) headers["Authorization"] = authHeader
  headers["Content-Type"] = "application/json"

  const init: RequestInit = { method: req.method, headers }
  if (body && req.method !== "GET" && req.method !== "HEAD") {
    init.body = body
  }

  return fetch(upstreamUrl.toString(), init)
}

async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const session = await getSessionOrNull()
    if (!session?.user) {
      return NextResponse.json({ message: "请先登录。" }, { status: 401 })
    }

    const { path } = await params
    const requestBody =
      req.method === "GET" || req.method === "HEAD"
        ? null
        : await req.text()

    const accountIndexHeader = req.headers.get("x-account-index")
    const accountIndex = accountIndexHeader !== null ? Number(accountIndexHeader) : 0
    const account = getMailAccountByIndex(accountIndex)
    const authHeader = account ? `Bearer ${account.key}` : null

    console.log("[mail proxy] request", {
      method: req.method,
      path,
      searchParams: Object.fromEntries(req.nextUrl.searchParams),
      body: requestBody,
      accountIndex,
    })

    const res = await callUpstream(req, path, requestBody, authHeader)
    const data = await res.text()
    console.log("[mail proxy] response", { status: res.status, body: data })

    return new NextResponse(data, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
    })
  } catch (error) {
    const message = getApiErrorMessage(error, "upstream unavailable")
    return NextResponse.json({ message }, { status: 502 })
  }
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
