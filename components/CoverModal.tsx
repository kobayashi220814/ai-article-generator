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

export interface UnsplashImage {
  id: string
  thumb_url: string
  full_url: string
  alt: string
}

export interface CoverState {
  images: UnsplashImage[]
  searchTerms: string[]
  selectedId: string | null
}

interface Props {
  articleId: string
  text: string
  onTextChange: (text: string) => void
  persistedState: CoverState | null
  onStateChange: (state: CoverState) => void
  onClose: () => void
}

export default function CoverModal({ articleId, text, onTextChange, persistedState, onStateChange, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [images, setImages] = useState<UnsplashImage[]>(persistedState?.images ?? [])
  const [searchTerms, setSearchTerms] = useState<string[]>(persistedState?.searchTerms ?? [])
  const [selectedId, setSelectedId] = useState<string | null>(persistedState?.selectedId ?? null)
  const [coverImage, setCoverImage] = useState<CoverImage | null>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isSearching, setIsSearching] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; startOffsetX: number; startOffsetY: number } | null>(null)

  const showAiButton = images.length < 3

  // 同步狀態回 parent（供下次開啟時恢復）
  useEffect(() => {
    onStateChange({ images, searchTerms, selectedId })
  }, [images, searchTerms, selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  // 預載字體
  useEffect(() => {
    loadCoverFont().catch(console.error)
  }, [])

  // 恢復上次選取的圖片
  useEffect(() => {
    if (!persistedState?.selectedId || !persistedState.images.length) return
    const img = persistedState.images.find((i) => i.id === persistedState.selectedId)
    if (img) handleSelectImage(img)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 搜圖
  const searchImages = useCallback(async () => {
    setIsSearching(true)
    setError(null)
    try {
      const res = await fetch(`/api/articles/${articleId}/cover-search`, { method: "POST" })
      const data = await res.json()
      setSearchTerms(data.search_terms ?? [])
      setImages(data.images ?? [])
    } catch {
      setError("搜尋圖片失敗，請重試")
    } finally {
      setIsSearching(false)
    }
  }, [articleId])

  useEffect(() => {
    if (persistedState && persistedState.images.length > 0) return
    searchImages()
  }, [searchImages]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // 重繪 canvas（先確保對應文字的字體 subset 已載入）
  useEffect(() => {
    if (!canvasRef.current || !coverImage) return
    const canvas = canvasRef.current
    document.fonts.load(`700 64px "Noto Sans TC"`, text).then(() => {
      renderCover(canvas, coverImage, offset.x, offset.y, text)
    })
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
        id: `ai-generated-${Date.now()}`,
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
        const filename = text.replace(/\s*[\r\n]+\s*/g, " ").trim() || "cover"
        a.download = `${filename}.jpg`
        a.click()
        URL.revokeObjectURL(url)
      },
      "image/jpeg",
      0.92
    )
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)" }}>
      <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 25px 60px rgba(0,0,0,0.3)", width: "100%", maxWidth: 1024, margin: "0 16px", display: "flex", flexDirection: "column", maxHeight: "90vh", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid #f3f4f6" }}>
          <h2 className="text-base font-semibold text-gray-800">產生封面圖</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer">✕</button>
        </div>

        {/* Body */}
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>

          {/* 左欄：預覽 + 文字 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: 24, flex: 1, minWidth: 0 }}>

            {/* Canvas 16:9 容器 */}
            <div style={{ position: "relative", width: "100%", paddingBottom: "56.25%", background: "#111827", borderRadius: 12, overflow: "hidden", border: "1px solid #e5e7eb" }}>
              {!coverImage && (
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <span style={{ fontSize: 32, opacity: 0.3 }}>🖼️</span>
                  <p className="text-sm text-gray-500">從右側選擇一張圖片</p>
                </div>
              )}
              <canvas
                ref={canvasRef}
                width={1280}
                height={720}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", cursor: coverImage ? "grab" : "default", display: "block" }}
                onMouseDown={handleMouseDown}
              />
            </div>

            {/* 文字編輯 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">封面標題</span>
              <textarea
                value={text}
                onChange={(e) => onTextChange(e.target.value)}
                rows={3}
                placeholder={"第一行文字（橘色）\n第二行文字（白色）"}
                style={{ width: "100%", padding: "12px 14px", fontSize: 14, color: "#374151", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, resize: "none", lineHeight: 1.6, outline: "none", fontFamily: "inherit" }}
                onFocus={(e) => { e.target.style.borderColor = "#60a5fa"; e.target.style.boxShadow = "0 0 0 3px rgba(96,165,250,0.15)" }}
                onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; e.target.style.boxShadow = "none" }}
              />
            </div>

          </div>

          {/* 右欄：圖片庫 */}
          <div style={{ width: 224, flexShrink: 0, borderLeft: "1px solid #f3f4f6", display: "flex", flexDirection: "column", background: "rgba(249,250,251,0.6)" }}>

            <div style={{ padding: "20px 16px 12px", flexShrink: 0, borderBottom: "1px solid #f3f4f6" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">圖片庫</span>
                <button onClick={searchImages} disabled={isSearching} className="text-xs font-medium text-blue-500 hover:text-blue-600 disabled:opacity-40 cursor-pointer transition-colors">
                  {isSearching ? "搜尋中…" : "重新搜尋"}
                </button>
              </div>
              {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {isSearching ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="w-full aspect-video bg-gray-200 rounded-lg animate-pulse" />
                ))
              ) : (
                <>
                  {images.map((img) => (
                    <button
                      key={img.id}
                      onClick={() => handleSelectImage(img)}
                      className={`relative w-full flex-shrink-0 aspect-video rounded-lg overflow-hidden cursor-pointer transition-all ${
                        selectedId === img.id ? "ring-2 ring-blue-500 ring-offset-1" : "ring-1 ring-transparent hover:ring-gray-300 hover:ring-offset-1"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.thumb_url} alt={img.alt} className="w-full h-full object-cover" />
                      {selectedId === img.id && <div className="absolute inset-0 bg-blue-500/10" />}
                    </button>
                  ))}
                  {showAiButton && (
                    <button onClick={handleAiGenerate} disabled={isGenerating} className="w-full flex-shrink-0 aspect-video rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1.5 hover:border-blue-400 hover:bg-blue-50/60 disabled:opacity-50 cursor-pointer transition-all">
                      <span className="text-xl">{isGenerating ? "⏳" : "✨"}</span>
                      <span className="text-xs text-gray-500 font-medium">{isGenerating ? "AI 生成中…" : "讓 AI 生成"}</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0, padding: "16px 24px", borderTop: "1px solid #f3f4f6", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={handleDownload} disabled={!coverImage} className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-sm active:scale-[0.98]">
            下載 JPG
          </button>
        </div>

      </div>
    </div>
  )
}
