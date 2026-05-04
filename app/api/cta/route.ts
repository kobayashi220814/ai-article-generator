import { NextResponse } from "next/server"

export const maxDuration = 300

export async function POST(request: Request) {
  const body = await request.json()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      // 每 20 秒送空白，防止 nginx proxy_read_timeout 觸發
      const keepalive = setInterval(() => {
        try { controller.enqueue(encoder.encode(" ")) } catch { /* stream already closed */ }
      }, 20000)

      try {
        const res = await fetch("https://n8n.pressplay.cc/webhook/cta", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const text = await res.text()
        if (text.trim()) controller.enqueue(encoder.encode(text))
      } finally {
        clearInterval(keepalive)
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/json",
      "X-Accel-Buffering": "no", // 停用 nginx response buffering
    },
  })
}
