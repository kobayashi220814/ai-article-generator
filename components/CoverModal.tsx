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
