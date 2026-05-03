# Cover Image Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓使用者在 SEO 面板點擊「產生封面」後，透過 AI 搜尋 Unsplash 圖片，在 Modal 中選圖、拖曳定位、編輯文字，最後下載 1280×720 JPG 封面。

**Architecture:** 三條新 API routes 負責 Unsplash 搜圖、DALL-E 3 生成與圖片 proxy；前端以 `lib/cover-canvas.ts` 封裝 Canvas 渲染邏輯；`CoverModal` 組件負責整個 Modal UI；`SeoPanel` 新增觸發按鈕。

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS, openai SDK, Canvas API, FontFace API

---

## 檔案結構

| 動作 | 路徑 | 職責 |
|---|---|---|
| 新增 | `app/api/image-proxy/route.ts` | 代理 Unsplash 圖片，解決 canvas CORS |
| 新增 | `app/api/articles/[id]/cover-search/route.ts` | AI 萃取搜尋詞 + Unsplash 搜圖 |
| 新增 | `app/api/articles/[id]/cover-generate/route.ts` | DALL-E 3 生成封面底圖 |
| 新增 | `lib/cover-canvas.ts` | Canvas 渲染純函式（字體載入、繪圖、offset 限制） |
| 新增 | `components/CoverModal.tsx` | 整個 Modal UI（縮圖、Canvas、文字編輯、下載） |
| 修改 | `components/SeoPanel.tsx` | 新增「產生封面」按鈕，開啟 CoverModal |
| 修改 | `next.config.ts` | 允許 Unsplash images.unsplash.com 圖片 domain |
| 修改 | `package.json` | 新增 `openai` 依賴 |

---

## Task 1：安裝依賴與設定 next.config

**Files:**
- Modify: `package.json`
- Modify: `next.config.ts`

- [ ] **Step 1: 安裝 openai 套件**

```bash
npm install openai
```

Expected output: `added N packages`

- [ ] **Step 2: 更新 next.config.ts 允許 Unsplash 圖片 domain**

將 `next.config.ts` 改成：

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 3: 確認 TypeScript 編譯正常**

```bash
npx tsc --noEmit
```

Expected: 無錯誤輸出

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json next.config.ts
git commit -m "feat: install openai, allow unsplash image domain"
```

---

## Task 2：Image Proxy API Route

**Files:**
- Create: `app/api/image-proxy/route.ts`

- [ ] **Step 1: 建立 route 檔案**

```ts
// app/api/image-proxy/route.ts
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")
  if (!url) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 })
  }

  let targetUrl: URL
  try {
    targetUrl = new URL(url)
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 })
  }

  if (targetUrl.hostname !== "images.unsplash.com") {
    return NextResponse.json({ error: "Only unsplash images allowed" }, { status: 403 })
  }

  const response = await fetch(url)
  if (!response.ok) {
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 })
  }

  const contentType = response.headers.get("content-type") ?? "image/jpeg"
  const buffer = await response.arrayBuffer()

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  })
}
```

- [ ] **Step 2: 手動驗證 proxy route 可用**

啟動 dev server：`npm run dev`

在瀏覽器開啟：
```
http://localhost:3000/api/image-proxy?url=https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=400
```

Expected: 瀏覽器直接顯示圖片

- [ ] **Step 3: Commit**

```bash
git add app/api/image-proxy/route.ts
git commit -m "feat: add image-proxy route for canvas CORS"
```

---

## Task 3：Cover Search API Route

**Files:**
- Create: `app/api/articles/[id]/cover-search/route.ts`

- [ ] **Step 1: 建立 route 檔案**

```ts
// app/api/articles/[id]/cover-search/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

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
  url.searchParams.set("per_page", "10")
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
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: `Given this Chinese article keyword and title, return a JSON array of 2-3 English search terms suitable for finding relevant stock photos on Unsplash. Terms should be concrete, visual, and descriptive (avoid abstract terms). Return ONLY the JSON array, no other text.

Keyword: ${keyword}
Title: ${title}

Example output: ["bank money cash", "financial crisis"]`,
      },
    ],
    response_format: { type: "json_object" },
  })

  let searchTerms: string[] = []
  try {
    const raw = JSON.parse(completion.choices[0].message.content ?? "{}")
    // gpt-4o-mini returns { terms: [...] } or similar; grab the first array value
    const firstArray = Object.values(raw).find((v) => Array.isArray(v)) as string[] | undefined
    searchTerms = firstArray ?? []
  } catch {
    searchTerms = [keyword]
  }

  if (searchTerms.length === 0) searchTerms = [keyword]

  // 搜圖，< 3 張時換第二個詞重試
  let photos = await searchUnsplash(searchTerms[0])
  if (photos.length < 3 && searchTerms[1]) {
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
```

- [ ] **Step 2: 手動驗證 cover-search**

確保 dev server 正在運行，用一篇已有 `selected_title` 的文章 id 測試：

```bash
curl -X POST http://localhost:3000/api/articles/<ARTICLE_ID>/cover-search
```

Expected: JSON 包含 `search_terms` array 和至少 1 張圖片的 `images` array

- [ ] **Step 3: Commit**

```bash
git add app/api/articles/[id]/cover-search/route.ts
git commit -m "feat: add cover-search route (AI search terms + Unsplash)"
```

---

## Task 4：Cover Generate API Route（DALL-E 3 Fallback）

**Files:**
- Create: `app/api/articles/[id]/cover-generate/route.ts`

- [ ] **Step 1: 建立 route 檔案**

```ts
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

  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt,
    size: "1792x1024",
    quality: "standard",
    n: 1,
  })

  const imageUrl = response.data[0]?.url
  if (!imageUrl) {
    return NextResponse.json({ error: "No image returned" }, { status: 500 })
  }

  return NextResponse.json({ image_url: imageUrl })
}
```

- [ ] **Step 2: 手動驗證 cover-generate**

```bash
curl -X POST http://localhost:3000/api/articles/<ARTICLE_ID>/cover-generate
```

Expected: JSON 包含 `image_url` 字串（DALL-E 3 產生的圖片 URL）

- [ ] **Step 3: Commit**

```bash
git add app/api/articles/[id]/cover-generate/route.ts
git commit -m "feat: add cover-generate route (DALL-E 3)"
```

---

## Task 5：Canvas 渲染工具函式

**Files:**
- Create: `lib/cover-canvas.ts`

- [ ] **Step 1: 建立 cover-canvas.ts**

```ts
// lib/cover-canvas.ts

export const CANVAS_W = 1280
export const CANVAS_H = 720
const FONT_SIZE = 64
const LINE_HEIGHT = 80
const PADDING_LEFT = 60
const PADDING_BOTTOM = 60
const OVERLAY_COLOR = "rgba(0, 0, 0, 0.6)"
const COLOR_LINE1 = "#FF6A13"
const COLOR_REST = "#FFFFFF"

let fontLoaded = false

export async function loadCoverFont(): Promise<void> {
  if (fontLoaded) return
  const font = new FontFace(
    "Noto Sans TC",
    "url(https://fonts.gstatic.com/s/notosanstc/v35/nKKF-GM_FYFRJvXzVXaAPe97P1KHynpCyAE.woff2)"
  )
  await font.load()
  document.fonts.add(font)
  fontLoaded = true
}

export interface CoverImage {
  element: HTMLImageElement
  scaledW: number
  scaledH: number
  minOffsetX: number
  maxOffsetX: number
  minOffsetY: number
  maxOffsetY: number
}

export function prepareCoverImage(img: HTMLImageElement): CoverImage {
  const scale = Math.max(CANVAS_W / img.naturalWidth, CANVAS_H / img.naturalHeight)
  const scaledW = img.naturalWidth * scale
  const scaledH = img.naturalHeight * scale
  return {
    element: img,
    scaledW,
    scaledH,
    minOffsetX: CANVAS_W - scaledW,
    maxOffsetX: 0,
    minOffsetY: CANVAS_H - scaledH,
    maxOffsetY: 0,
  }
}

export function clampOffset(
  coverImage: CoverImage,
  offsetX: number,
  offsetY: number
): { x: number; y: number } {
  return {
    x: Math.min(coverImage.maxOffsetX, Math.max(coverImage.minOffsetX, offsetX)),
    y: Math.min(coverImage.maxOffsetY, Math.max(coverImage.minOffsetY, offsetY)),
  }
}

export function defaultOffset(coverImage: CoverImage): { x: number; y: number } {
  return {
    x: (CANVAS_W - coverImage.scaledW) / 2,
    y: (CANVAS_H - coverImage.scaledH) / 2,
  }
}

export function renderCover(
  canvas: HTMLCanvasElement,
  coverImage: CoverImage,
  offsetX: number,
  offsetY: number,
  text: string
): void {
  const ctx = canvas.getContext("2d")
  if (!ctx) return

  canvas.width = CANVAS_W
  canvas.height = CANVAS_H

  // 1. 底圖
  ctx.drawImage(coverImage.element, offsetX, offsetY, coverImage.scaledW, coverImage.scaledH)

  // 2. 遮罩
  ctx.fillStyle = OVERLAY_COLOR
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // 3. 文字
  const lines = text.split("\n").filter((l) => l.length > 0)
  if (lines.length === 0) return

  ctx.font = `bold ${FONT_SIZE}px 'Noto Sans TC', sans-serif`
  ctx.textBaseline = "alphabetic"

  const totalTextHeight = lines.length * LINE_HEIGHT
  const startY = CANVAS_H - PADDING_BOTTOM - totalTextHeight + LINE_HEIGHT

  lines.forEach((line, i) => {
    ctx.fillStyle = i === 0 ? COLOR_LINE1 : COLOR_REST
    ctx.fillText(line, PADDING_LEFT, startY + i * LINE_HEIGHT)
  })
}
```

- [ ] **Step 2: 確認 TypeScript 編譯**

```bash
npx tsc --noEmit
```

Expected: 無錯誤

- [ ] **Step 3: Commit**

```bash
git add lib/cover-canvas.ts
git commit -m "feat: add cover-canvas utility (font, render, offset)"
```

---

## Task 6：CoverModal 組件 — 骨架、搜圖、縮圖列

**Files:**
- Create: `components/CoverModal.tsx`

- [ ] **Step 1: 建立 CoverModal 骨架**

```tsx
// components/CoverModal.tsx
"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  loadCoverFont,
  prepareCoverImage,
  clampOffset,
  defaultOffset,
  renderCover,
  CoverImage,
} from "@/lib/cover-canvas"

interface UnsplashImage {
  id: string
  thumb_url: string
  full_url: string
  alt: string
}

interface Props {
  articleId: string
  initialText: string
  onClose: () => void
}

export default function CoverModal({ articleId, initialText, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [images, setImages] = useState<UnsplashImage[]>([])
  const [searchTerms, setSearchTerms] = useState<string[]>([])
  const [showAiButton, setShowAiButton] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [coverImage, setCoverImage] = useState<CoverImage | null>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [text, setText] = useState(initialText)
  const [isSearching, setIsSearching] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; startOffsetX: number; startOffsetY: number } | null>(null)

  // 預載字體
  useEffect(() => {
    loadCoverFont().catch(console.error)
  }, [])

  // 搜圖
  const searchImages = useCallback(async () => {
    setIsSearching(true)
    setError(null)
    try {
      const res = await fetch(`/api/articles/${articleId}/cover-search`, { method: "POST" })
      const data = await res.json()
      setSearchTerms(data.search_terms ?? [])
      setImages(data.images ?? [])
      setShowAiButton((data.images ?? []).length < 3)
    } catch {
      setError("搜尋圖片失敗，請重試")
    } finally {
      setIsSearching(false)
    }
  }, [articleId])

  useEffect(() => {
    searchImages()
  }, [searchImages])

  // 選取縮圖 → 載入圖片 → 初始化 Canvas
  const handleSelectImage = useCallback(async (img: UnsplashImage) => {
    setSelectedId(img.id)
    const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(img.full_url)}`
    const el = new Image()
    el.crossOrigin = "anonymous"
    el.src = proxyUrl
    el.onload = () => {
      const ci = prepareCoverImage(el)
      const def = defaultOffset(ci)
      setCoverImage(ci)
      setOffset(def)
    }
    el.onerror = () => setError("圖片載入失敗")
  }, [])

  // 重繪 canvas
  useEffect(() => {
    if (!canvasRef.current || !coverImage) return
    renderCover(canvasRef.current, coverImage, offset.x, offset.y, text)
  }, [coverImage, offset, text])

  // DALL-E 3 生成
  const handleAiGenerate = async () => {
    setIsGenerating(true)
    setError(null)
    try {
      const res = await fetch(`/api/articles/${articleId}/cover-generate`, { method: "POST" })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const aiImg: UnsplashImage = {
        id: "ai-generated",
        thumb_url: data.image_url,
        full_url: data.image_url,
        alt: "AI 生成",
      }
      setImages((prev) => [...prev, aiImg])
      handleSelectImage(aiImg)
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI 生成失敗")
    } finally {
      setIsGenerating(false)
    }
  }

  // 拖曳處理（canvas 座標需依顯示比例縮放）
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!coverImage) return
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: offset.x,
      startOffsetY: offset.y,
    }
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current || !coverImage || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const scaleX = 1280 / rect.width
    const scaleY = 720 / rect.height
    const deltaX = (e.clientX - dragRef.current.startX) * scaleX
    const deltaY = (e.clientY - dragRef.current.startY) * scaleY
    const clamped = clampOffset(
      coverImage,
      dragRef.current.startOffsetX + deltaX,
      dragRef.current.startOffsetY + deltaY
    )
    setOffset(clamped)
  }, [coverImage])

  const handleMouseUp = useCallback(() => {
    dragRef.current = null
  }, [])

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  // 下載
  const handleDownload = () => {
    if (!canvasRef.current) return
    canvasRef.current.toBlob(
      (blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "cover.jpg"
        a.click()
        URL.revokeObjectURL(url)
      },
      "image/jpeg",
      0.92
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">產生封面</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-4 p-5">
          {/* Canvas 預覽 */}
          <div className="relative bg-slate-900 rounded-xl overflow-hidden" style={{ aspectRatio: "16/9" }}>
            {!coverImage && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-slate-500 text-sm">選擇下方圖片以預覽封面</p>
              </div>
            )}
            <canvas
              ref={canvasRef}
              className="w-full h-full"
              style={{ cursor: coverImage ? "grab" : "default" }}
              onMouseDown={handleMouseDown}
            />
            {coverImage && (
              <div className="absolute top-2 right-2 bg-black/50 rounded px-2 py-1">
                <span className="text-[11px] text-slate-300">拖曳調整位置</span>
              </div>
            )}
          </div>

          {/* 文字編輯 */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">封面文字</p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder={"第一行橘色\n第二行之後白色"}
              className="w-full px-3 py-2.5 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none placeholder:text-slate-300 leading-relaxed font-mono"
            />
            <p className="text-[10px] text-slate-400 mt-1">第一行顯示橘色，換行後顯示白色</p>
          </div>

          {/* 搜尋詞 + 縮圖列 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">搜尋詞</p>
              {searchTerms.length > 0 && (
                <span className="text-xs text-slate-500">{searchTerms.join(", ")}</span>
              )}
              <button
                onClick={searchImages}
                disabled={isSearching}
                className="ml-auto text-[11px] text-blue-500 hover:text-blue-700 disabled:opacity-40 cursor-pointer"
              >
                {isSearching ? "搜尋中..." : "重新搜尋"}
              </button>
            </div>

            {error && (
              <p className="text-xs text-red-500 mb-2">{error}</p>
            )}

            <div className="flex gap-2 overflow-x-auto pb-1">
              {isSearching ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="w-40 flex-shrink-0 aspect-video bg-slate-100 rounded-lg animate-pulse" />
                ))
              ) : (
                <>
                  {images.map((img) => (
                    <button
                      key={img.id}
                      onClick={() => handleSelectImage(img)}
                      className={`w-40 flex-shrink-0 aspect-video rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                        selectedId === img.id ? "border-blue-500 scale-105" : "border-transparent hover:border-slate-300"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.thumb_url} alt={img.alt} className="w-full h-full object-cover" />
                    </button>
                  ))}
                  {showAiButton && (
                    <button
                      onClick={handleAiGenerate}
                      disabled={isGenerating}
                      className="w-40 flex-shrink-0 aspect-video rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-1 hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50 cursor-pointer transition-all"
                    >
                      <span className="text-lg">{isGenerating ? "⏳" : "✨"}</span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {isGenerating ? "生成中..." : "讓 AI 生成"}
                      </span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 flex justify-end">
          <button
            onClick={handleDownload}
            disabled={!coverImage}
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm shadow-blue-200 active:scale-[0.98]"
          >
            下載 JPG
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 確認 TypeScript 編譯**

```bash
npx tsc --noEmit
```

Expected: 無錯誤

- [ ] **Step 3: Commit**

```bash
git add components/CoverModal.tsx
git commit -m "feat: add CoverModal component"
```

---

## Task 7：串接 SeoPanel — 新增「產生封面」按鈕

**Files:**
- Modify: `components/SeoPanel.tsx`

- [ ] **Step 1: 在 SeoPanel 頂部加入 import**

在 [components/SeoPanel.tsx](components/SeoPanel.tsx) 的 import 區塊加入：

```tsx
import dynamic from "next/dynamic"
const CoverModal = dynamic(() => import("./CoverModal"), { ssr: false })
```

以及在現有 `useState` import 中加入 `useState` 已存在，確認即可。

- [ ] **Step 2: 在 SeoPanel 組件內加入 modal 狀態**

在 `SeoPanel` 函式開頭的 state 宣告處加入：

```tsx
const [coverModalOpen, setCoverModalOpen] = useState(false)
```

- [ ] **Step 3: 在 Slug 區塊後、closing `</div>` 前新增按鈕與 Modal**

找到 SeoPanel.tsx 中 Slug 輸入框的結尾（`</div>` 後），在 `</div>` (整個 `p-4 space-y-5` 區塊) 結束前加入：

```tsx
{/* Divider */}
<div className="border-t border-slate-100" />

{/* 產生封面 */}
<div>
  <button
    onClick={() => setCoverModalOpen(true)}
    disabled={!selectedTitle.trim()}
    title={!selectedTitle.trim() ? "請先填寫文章標題" : undefined}
    className="w-full py-2.5 bg-slate-800 text-white text-xs font-semibold rounded-xl hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98] transition-all"
  >
    產生封面
  </button>
</div>
```

並在 `SeoPanel` return 的最外層 `<div>` 結尾前（`</div>` 前）加入 Modal：

```tsx
{coverModalOpen && article && (
  <CoverModal
    articleId={article.id}
    initialText={selectedTitle}
    onClose={() => setCoverModalOpen(false)}
  />
)}
```

- [ ] **Step 4: 確認 TypeScript 編譯**

```bash
npx tsc --noEmit
```

Expected: 無錯誤

- [ ] **Step 5: 手動測試完整流程**

1. `npm run dev` 啟動開發伺服器
2. 開啟一篇已生成完成（status: done）的文章
3. 在 SEO 面板選擇一個標題，確認「產生封面」按鈕變為可點擊
4. 點擊「產生封面」，確認 Modal 開啟並自動搜圖
5. 點選一張縮圖，確認 Canvas 渲染出封面（底圖 + 暗色遮罩 + 橘色第一行 + 白色後續行）
6. 在 textarea 修改文字與換行，確認 Canvas 即時更新
7. 在 Canvas 上按住滑鼠拖曳，確認底圖位置移動且不超出邊界
8. 點擊「下載 JPG」，確認下載 cover.jpg（1280×720）
9. 若 Unsplash 結果 < 3 張，確認出現「讓 AI 生成」按鈕

- [ ] **Step 6: Commit**

```bash
git add components/SeoPanel.tsx
git commit -m "feat: wire CoverModal into SeoPanel with 產生封面 button"
```

---

## Self-Review Checklist（已確認）

- **Spec coverage**
  - ✅ `cover-search` route：AI 萃取搜尋詞 + Unsplash 搜圖 + < 3 張換詞重試
  - ✅ `image-proxy` route：解決 canvas CORS
  - ✅ `cover-generate` route：DALL-E 3 fallback
  - ✅ `cover-canvas.ts`：font load、render、offset clamp
  - ✅ Modal UI：上大預覽 + 下橫向縮圖列
  - ✅ 文字 textarea：預設 selected_title，手動換行，第一行橘色
  - ✅ 拖曳定位，clamp offset 不超出邊界
  - ✅ < 3 張顯示「讓 AI 生成」按鈕
  - ✅ 0 張只顯示 AI 生成按鈕（`showAiButton` 在 0 張時也為 true）
  - ✅ `selected_title` 為空時按鈕 disabled
  - ✅ 下載 JPG，`canvas.toBlob` + `image/jpeg` quality 0.92

- **Type consistency**：`CoverImage`、`UnsplashImage`、`renderCover`、`prepareCoverImage`、`clampOffset`、`defaultOffset` 在 Task 5 定義，Task 6 使用，名稱一致
