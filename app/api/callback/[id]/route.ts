import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const secret = request.headers.get("x-callback-secret")
  if (secret !== process.env.CALLBACK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()

  // n8n returns: [{ title: "[\"t1\",\"t2\",\"t3\"]", data: "<html>" }]
  const item = Array.isArray(body) ? body[0] : body
  const titles: string[] = JSON.parse(item.title)
  const htmlContent: string = item.data

  // Store raw HTML; client converts to BlockNote blocks on first load
  await prisma.article.update({
    where: { id },
    data: {
      status: "done",
      titles,
      content: { type: "html", raw: htmlContent } as object,
    },
  })

  return NextResponse.json({ ok: true })
}
