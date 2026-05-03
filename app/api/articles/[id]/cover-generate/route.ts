// app/api/articles/[id]/cover-generate/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const article = await prisma.article.findUnique({ where: { id } })
  if (!article) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const seo = article.seo as { selected_title?: string } | null
  const keyword = article.keyword
  const title = seo?.selected_title ?? keyword

  const prompt = `A high-quality, realistic stock photo suitable as a blog article cover image. Topic: "${keyword}" (${title}). Wide landscape format, professional photography style, no text or logos, cinematic lighting.`

  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      size: "1792x1024",
      quality: "standard",
      n: 1,
    })

    const imageUrl = response.data?.[0]?.url
    if (!imageUrl) {
      return NextResponse.json({ error: "No image returned from DALL-E" }, { status: 500 })
    }

    return NextResponse.json({ image_url: imageUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image generation failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
