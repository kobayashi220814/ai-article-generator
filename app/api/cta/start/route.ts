import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  const { url, content } = await request.json()

  const job = await prisma.ctaJob.create({ data: {} })

  const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/cta/callback/${job.id}`

  await fetch("https://n8n.pressplay.cc/webhook/cta", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, content, callback_url: callbackUrl }),
  }).catch(() => {
    // fire & forget，不等回應
  })

  return NextResponse.json({ jobId: job.id })
}
