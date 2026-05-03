import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")
  if (!url) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 })
  }

  let targetUrl: URL
  try {
    targetUrl = new URL(url)
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 })
  }

  if (targetUrl.hostname.toLowerCase() !== "images.unsplash.com") {
    return NextResponse.json({ error: "Only unsplash images allowed" }, { status: 403 })
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)
  let response
  try {
    response = await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) {
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 })
  }

  const contentLength = parseInt(response.headers.get("content-length") ?? "0", 10)
  if (contentLength > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "Image too large" }, { status: 413 })
  }

  const contentType = response.headers.get("content-type") ?? "image/jpeg"
  const buffer = await response.arrayBuffer()

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  })
}
