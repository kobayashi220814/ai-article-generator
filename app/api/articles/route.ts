import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { triggerGeneration } from "@/lib/generation"

export async function GET() {
  const articles = await prisma.article.findMany({
    select: { id: true, keyword: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(articles)
}

export async function POST(request: Request) {
  const { keyword } = await request.json()
  if (!keyword?.trim()) {
    return NextResponse.json({ error: "keyword is required" }, { status: 400 })
  }

  const article = await prisma.article.create({
    data: { keyword: keyword.trim(), status: "pending" },
  })

  triggerGeneration(article.id, article.keyword)

  return NextResponse.json({ id: article.id }, { status: 201 })
}
