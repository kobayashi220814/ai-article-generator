import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  const body = await request.json()
  const executionId = String(body.execution_id ?? "")
  const errorMessage = String(body.error_message ?? "n8n 工作流執行失敗")

  if (!executionId) {
    return NextResponse.json({ error: "execution_id required" }, { status: 400 })
  }

  const article = await prisma.article.findUnique({ where: { n8nExecutionId: executionId } })
  if (!article) {
    return NextResponse.json({ error: "Article not found for execution_id" }, { status: 404 })
  }

  await prisma.article.update({
    where: { id: article.id },
    data: { status: "error", errorMsg: errorMessage },
  })

  return NextResponse.json({ ok: true, article_id: article.id })
}
