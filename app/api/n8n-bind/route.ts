import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  const { article_id, execution_id } = await request.json()
  if (!article_id || !execution_id) {
    return NextResponse.json({ error: "article_id and execution_id required" }, { status: 400 })
  }

  await prisma.article.update({
    where: { id: article_id },
    data: { n8nExecutionId: String(execution_id) },
  })

  return NextResponse.json({ ok: true })
}
