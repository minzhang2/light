import { NextRequest, NextResponse } from "next/server"
import { getApiErrorMessage } from "@/lib/api-error"
import { getSessionOrNull } from "@/lib/auth/require-session"

const OPEN_UPSTREAM = "https://zjkdongao.cn/open/v1"
const LEGACY_UPSTREAM = "https://zjkdongao.cn/mail-api/v1"
const UPSTREAMS = [OPEN_UPSTREAM, LEGACY_UPSTREAM] as const

function resolvePath(path: string[], upstreamBase: string) {
  // Frontend uses /mailboxes/allocate to avoid clashing with local /api/mail/mailboxes DB route.
  // New open API merged this into POST /mailboxes, so rewrite only for open upstream.
  if (
    upstreamBase === OPEN_UPSTREAM &&
    path.length === 2 &&
    path[0] === "mailboxes" &&
    path[1] === "allocate"
  ) {
    return ["mailboxes"]
  }

  return path
}

async function callUpstream(
  req: NextRequest,
  path: string[],
  body: string | null,
  upstreamBase: string,
) {
  const resolvedPath = resolvePath(path, upstreamBase)
  const upstreamUrl = new URL(`${upstreamBase}/${resolvedPath.join("/")}`)
  req.nextUrl.searchParams.forEach((v, k) => upstreamUrl.searchParams.set(k, v))

  const headers: Record<string, string> = {}
  const auth = req.headers.get("authorization")
  if (auth) headers["Authorization"] = auth
  headers["Content-Type"] = "application/json"

  const init: RequestInit = {
    method: req.method,
    headers,
  }

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

    let lastResponse: Response | null = null

    for (const upstream of UPSTREAMS) {
      const res = await callUpstream(req, path, requestBody, upstream)
      lastResponse = res

      if (res.status !== 404) {
        const data = await res.text()
        return new NextResponse(data, {
          status: res.status,
          headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
        })
      }
    }

    if (!lastResponse) {
      return NextResponse.json({ message: "upstream unavailable" }, { status: 502 })
    }

    const data = await lastResponse.text()

    return new NextResponse(data, {
      status: lastResponse.status,
      headers: { "Content-Type": lastResponse.headers.get("content-type") ?? "application/json" },
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
