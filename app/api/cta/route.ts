import { NextResponse } from "next/server"

export const maxDuration = 300 // 5 分鐘，對應 n8n 生成時間

export async function POST(request: Request) {
  const body = await request.json()

  const res = await fetch("https://n8n.pressplay.cc/webhook/cta", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  if (!text.trim()) return new NextResponse(null, { status: 204 })
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  })
}
