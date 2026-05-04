import { prisma } from "@/lib/prisma"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      const poll = async () => {
        try {
          const job = await prisma.ctaJob.findUnique({ where: { id: jobId } })

          if (!job) {
            send({ status: "error", message: "Job not found" })
            controller.close()
            return
          }

          if (job.status === "done") {
            send({ status: "done", result: job.result })
            controller.close()
            return
          }

          if (job.status === "error") {
            send({ status: "error", message: "n8n processing failed" })
            controller.close()
            return
          }

          setTimeout(poll, 3000)
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
