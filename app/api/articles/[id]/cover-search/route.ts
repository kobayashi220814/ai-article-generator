// app/api/articles/[id]/cover-search/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const UNSPLASH_PER_PAGE = 10
const MIN_IMAGES_THRESHOLD = 3

interface UnsplashPhoto {
  id: string
  urls: { thumb: string; regular: string }
  alt_description: string | null
}

interface UnsplashResponse {
  results: UnsplashPhoto[]
}

async function searchUnsplash(query: string): Promise<UnsplashPhoto[]> {
  const url = new URL("https://api.unsplash.com/search/photos")
  url.searchParams.set("query", query)
  url.searchParams.set("per_page", UNSPLASH_PER_PAGE.toString())
  url.searchParams.set("orientation", "landscape")

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` },
  })
  if (!res.ok) return []
  const data: UnsplashResponse = await res.json()
  return data.results ?? []
}

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

  // 用 gpt-4o-mini 萃取 2~3 個英文搜尋詞
  let searchTerms: string[] = []
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "user",
          content: `Given this Chinese article keyword and title, return a JSON object with key "terms" containing an array of 2-3 English search terms suitable for finding relevant stock photos on Unsplash. Terms should be concrete, visual, and descriptive (avoid abstract terms). Return ONLY the JSON object, no other text.

Keyword: ${keyword}
Title: ${title}

Example output: {"terms": ["bank money cash", "financial crisis"]}`,
        },
      ],
      response_format: { type: "json_object" },
    })
    const content = completion.choices[0]?.message.content ?? "{}"
    const raw = JSON.parse(content)
    searchTerms = Array.isArray(raw.terms) ? raw.terms : []
  } catch {
    // OpenAI 失敗時 fallback 用 keyword 搜尋
  }
  if (searchTerms.length === 0) searchTerms = [keyword]

  // 搜圖，< MIN_IMAGES_THRESHOLD 張時換第二個詞重試
  let photos = await searchUnsplash(searchTerms[0])
  if (photos.length < MIN_IMAGES_THRESHOLD && searchTerms[1]) {
    const more = await searchUnsplash(searchTerms[1])
    photos = more.length > photos.length ? more : photos
  }

  const images = photos.map((p) => ({
    id: p.id,
    thumb_url: p.urls.thumb,
    full_url: p.urls.regular,
    alt: p.alt_description ?? "",
  }))

  return NextResponse.json({ search_terms: searchTerms, images })
}
