import { NextRequest, NextResponse } from "next/server"

const UPSTREAM = "https://zjkdongao.cn/mail-api/v1"

async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const upstreamUrl = new URL(`${UPSTREAM}/${path.join("/")}`)

  // Forward query params
  req.nextUrl.searchParams.forEach((v, k) => upstreamUrl.searchParams.set(k, v))

  const headers: Record<string, string> = {}
  const auth = req.headers.get("authorization")
  if (auth) headers["Authorization"] = auth
  headers["Content-Type"] = "application/json"

  const init: RequestInit = {
    method: req.method,
    headers,
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    const body = await req.text()
    if (body) init.body = body
  }

  const res = await fetch(upstreamUrl.toString(), init)
  const data = await res.text()

  return new NextResponse(data, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  })
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
