import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params
  const body = await request.json()

  // n8n returns: [{ "data": "<html>" }]
  const item = Array.isArray(body) ? body[0] : body
  const htmlContent: string = item.data

  await prisma.ctaJob.update({
    where: { id: jobId },
    data: { status: "done", result: htmlContent },
  })

  return NextResponse.json({ ok: true })
}
