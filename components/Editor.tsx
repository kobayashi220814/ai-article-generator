"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Article } from "@/lib/types"
import dynamic from "next/dynamic"
const BlockEditor = dynamic(() => import("./BlockEditor"), { ssr: false })
import { SpinnerIcon, AlertIcon, SparklesIcon, RefreshIcon } from "./Icons"

interface Props {
  article: Article | null
  isNew: boolean
  onGenerate: (keyword: string) => void
  onRetry: () => void
  onArticleUpdate: (article: Article) => void
}

const TIMEOUT_MS = 30 * 60 * 1000

export default function Editor({ article, isNew, onGenerate, onRetry, onArticleUpdate }: Props) {
  const [keyword, setKeyword] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isTimedOut, setIsTimedOut] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearSSETimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  const startSSE = useCallback(
    (id: string) => {
      if (eventSourceRef.current) eventSourceRef.current.close()
      clearSSETimeout()
      setIsTimedOut(false)

      const es = new EventSource(`/api/articles/${id}/stream`)
      eventSourceRef.current = es

      timeoutRef.current = setTimeout(() => {
        es.close()
        setIsGenerating(false)
        setIsTimedOut(true)
      }, TIMEOUT_MS)

      es.onmessage = async (e) => {
        const data = JSON.parse(e.data)
        if (data.status === "done" || data.status === "error") {
          clearSSETimeout()
          es.close()
          setIsGenerating(false)
          const res = await fetch(`/api/articles/${id}`)
          const updated = await res.json()
          onArticleUpdate(updated)
        }
      }

      es.onerror = () => {
        clearSSETimeout()
        es.close()
        setIsGenerating(false)
      }
    },
    [onArticleUpdate]
  )

  useEffect(() => {
    if (!article) {
      setIsGenerating(false)
      eventSourceRef.current?.close()
      eventSourceRef.current = null
      return
    }
    if (article.status === "done" || article.status === "error") {
      setIsGenerating(false)
      eventSourceRef.current?.close()
      eventSourceRef.current = null
      return
    }
    if (article.status === "pending" || article.status === "generating") {
      setIsGenerating(true)
      startSSE(article.id)
    }
    return () => { eventSourceRef.current?.close() }
  }, [article?.id, article?.status, startSSE])

  useEffect(() => {
    if (isNew && inputRef.current) inputRef.current.focus()
  }, [isNew])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!keyword.trim()) return
    setIsGenerating(true)
    onGenerate(keyword.trim())
    setKeyword("")
  }

  const handleRetry = () => {
    setIsTimedOut(false)
    setIsGenerating(true)
    onRetry()
    if (article) startSSE(article.id)
  }

  /* ── Empty / New state ── */
  if (isNew || !article) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
              <SparklesIcon size={26} className="text-blue-500" />
            </div>
          </div>

          <h1 className="text-xl font-semibold text-slate-800 mb-1.5 text-center tracking-tight">
            生成 SEO 優化文章
          </h1>
          <p className="text-sm text-slate-500 text-center mb-8 leading-relaxed">
            輸入一個關鍵字，AI 將自動撰寫完整文章<br />
            並提供 3 個 SEO 標題供選擇
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="輸入關鍵字，例如：第一次買房指南"
                className="w-full px-4 py-3 pr-12 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 focus:bg-white placeholder:text-slate-400"
              />
            </div>
            <button
              type="submit"
              disabled={!keyword.trim()}
              className="w-full py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm shadow-blue-200 active:scale-[0.98]"
            >
              開始生成文章
            </button>
          </form>

          <p className="text-xs text-slate-400 text-center mt-4">
            使用 Mock 模式約需 10 秒；正式 AI 約 10~15 分鐘
          </p>
        </div>
      </div>
    )
  }

  /* ── Error state ── */
  if (article.status === "error") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm text-center">
          <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertIcon size={22} className="text-red-500" />
          </div>
          <h2 className="text-base font-semibold text-slate-800 mb-1.5">生成失敗</h2>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            {article.errorMsg ?? "發生未知錯誤，請重試"}
          </p>
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 cursor-pointer active:scale-[0.98] shadow-sm shadow-blue-200"
          >
            <RefreshIcon size={15} />
            重新生成
          </button>
        </div>
      </div>
    )
  }

  /* ── Generating / Loading state ── */
  if (isGenerating || article.status === "pending" || article.status === "generating") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm text-center">
          {/* Animated dots */}
          <div className="flex justify-center items-center gap-1.5 mb-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-blue-400"
                style={{
                  animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
          <h2 className="text-base font-semibold text-slate-800 mb-1.5">
            正在生成文章
          </h2>
          <p className="text-sm text-slate-500 mb-1">
            關鍵字：<span className="font-medium text-slate-700">「{article.keyword}」</span>
          </p>
          <p className="text-xs text-slate-400 mt-3 leading-relaxed">
            AI 正在撰寫高品質 SEO 文章<br />
            Mock 模式約需 10 秒，請稍候⋯
          </p>
        </div>
        <style>{`
          @keyframes bounce {
            0%, 80%, 100% { transform: scale(0.7); opacity: 0.5; }
            40% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>
    )
  }

  /* ── Timeout state ── */
  if (isTimedOut && article.status !== "done" && article.status !== "error") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto mb-4">
            <AlertIcon size={22} className="text-amber-500" />
          </div>
          <h2 className="text-base font-semibold text-slate-800 mb-1.5">生成逾時</h2>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            已等待超過 30 分鐘，後端可能發生異常<br />
            關鍵字：<span className="font-medium text-slate-700">「{article?.keyword}」</span>
          </p>
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 cursor-pointer active:scale-[0.98] shadow-sm shadow-blue-200"
          >
            <RefreshIcon size={15} />
            重新發送
          </button>
        </div>
      </div>
    )
  }

  /* ── Editor ── */
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      <div className="flex-1 overflow-y-auto">
        <BlockEditor key={article.id} article={article} onUpdate={onArticleUpdate} />
      </div>
    </div>
  )
}
