import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { gzipJson } from "@/lib/gzip-response"

function extractFirstLine(blocks: unknown): string {
  if (!Array.isArray(blocks)) return ""
  for (const block of blocks) {
    const b = block as { content?: unknown[] }
    if (!Array.isArray(b.content)) continue
    const text = b.content
      .filter((item): item is { type: string; text: string } => typeof item === "object" && item !== null && (item as { type: string }).type === "text")
      .map((item) => item.text)
      .join("")
      .trim()
    if (text) return text.slice(0, 60)
  }
  return ""
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const article = await prisma.article.findUnique({ where: { id } })
  if (!article) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return gzipJson(article)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const { content, seo, titles } = body

  const existing = await prisma.article.findUnique({ where: { id }, select: { source: true } })

  const article = await prisma.article.update({
    where: { id },
    data: {
      ...(content !== undefined && { content }),
      ...(seo !== undefined && { seo }),
      ...(titles !== undefined && { titles }),
      // manual 文章以內文第一行作為 keyword，供側邊欄列表顯示
      ...(content !== undefined && existing?.source === "manual" && {
        keyword: extractFirstLine(content),
      }),
    },
  })
  return NextResponse.json(article)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await prisma.article.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
