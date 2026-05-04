import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { gzipJson } from "@/lib/gzip-response"

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
  const { content, seo } = body

  const article = await prisma.article.update({
    where: { id },
    data: {
      ...(content !== undefined && { content }),
      ...(seo !== undefined && { seo }),
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
