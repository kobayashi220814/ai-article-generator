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

  if (targetUrl.hostname !== "images.unsplash.com") {
    return NextResponse.json({ error: "Only unsplash images allowed" }, { status: 403 })
  }

  const response = await fetch(url)
  if (!response.ok) {
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 })
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
