import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { triggerGeneration } from "@/lib/generation"

export async function GET() {
  const articles = await prisma.article.findMany({
    select: { id: true, keyword: true, source: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(articles)
}

export async function POST(request: Request) {
  const body = await request.json()

  // 空白文章：不需關鍵字、不走 n8n，直接建立 done 狀態供使用者撰寫
  if (body.source === "manual") {
    const article = await prisma.article.create({
      data: { keyword: "", source: "manual", status: "done" },
    })
    return NextResponse.json({ id: article.id }, { status: 201 })
  }

  // AI 文章：輸入關鍵字觸發 n8n 生成
  const { keyword } = body
  if (!keyword?.trim()) {
    return NextResponse.json({ error: "keyword is required" }, { status: 400 })
  }

  const article = await prisma.article.create({
    data: { keyword: keyword.trim(), source: "ai", status: "pending" },
  })

  triggerGeneration(article.id, article.keyword)

  return NextResponse.json({ id: article.id }, { status: 201 })
}
