import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { triggerGeneration } from "@/lib/generation"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const article = await prisma.article.findUnique({ where: { id } })
  if (!article) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.article.update({
    where: { id },
    data: { status: "pending", errorMsg: null },
  })

  triggerGeneration(id, article.keyword)

  return NextResponse.json({ ok: true })
}
