export const maxDuration = 300

export async function POST(request: Request) {
  const body = await request.json()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      // 每 15 秒送 SSE comment 讓 nginx 不觸發 proxy_read_timeout
      const keepalive = setInterval(() => {
        try { controller.enqueue(encoder.encode(": ping\n\n")) } catch { /* closed */ }
      }, 15000)

      try {
        const res = await fetch("https://n8n.pressplay.cc/webhook/cta", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const text = await res.text()
        send({ ok: true, raw: text })
      } catch (err) {
        send({ ok: false, error: String(err) })
      } finally {
        clearInterval(keepalive)
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
