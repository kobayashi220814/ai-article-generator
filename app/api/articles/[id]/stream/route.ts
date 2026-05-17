import { prisma } from "@/lib/prisma"

const TIMEOUT_MS = 30 * 60 * 1000

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      const poll = async () => {
        try {
          const article = await prisma.article.findUnique({
            where: { id },
            select: { status: true, errorMsg: true, createdAt: true },
          })

          if (!article) {
            send({ status: "error", message: "Article not found" })
            controller.close()
            return
          }

          const pending = article.status === "pending" || article.status === "generating"
          if (pending && Date.now() - article.createdAt.getTime() > TIMEOUT_MS) {
            await prisma.article.update({
              where: { id },
              data: { status: "error", errorMsg: "生成逾時（超過 30 分鐘）" },
            })
            send({ status: "error", message: "生成逾時（超過 30 分鐘）" })
            controller.close()
            return
          }

          send({ status: article.status, message: article.errorMsg })

          if (article.status === "done" || article.status === "error") {
            controller.close()
            return
          }

          setTimeout(poll, 1000)
        } catch {
          send({ status: "error", message: "Server error" })
          controller.close()
        }
      }

      await poll()
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
