"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Article, Seo } from "@/lib/types"
import dynamic from "next/dynamic"
import type { CoverState } from "./CoverModal"
const CoverModal = dynamic(() => import("./CoverModal"), { ssr: false })

interface Props {
  article: Article | null
  onUpdate: (article: Article) => void
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
      {children}
    </p>
  )
}

function SkeletonBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-12 rounded-xl bg-slate-100 animate-pulse"
          style={{ opacity: 1 - i * 0.2 }}
        />
      ))}
    </div>
  )
}

export default function SeoPanel({ article, onUpdate }: Props) {
  const [selectedTitle, setSelectedTitle] = useState("")
  const [promoteUrl, setPromoteUrl] = useState("")
  const [shortLinkName, setShortLinkName] = useState("")
  const [coverModalOpen, setCoverModalOpen] = useState(false)
  const [coverState, setCoverState] = useState<CoverState | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const seo = article?.seo as Seo | null
    setSelectedTitle(seo?.selected_title ?? "")
    setPromoteUrl(seo?.promote_url ?? "")
    setShortLinkName(seo?.short_link_name ?? "")
    setCoverState(null)
  }, [article?.id])

  const saveSeo = useCallback(
    (patch: Partial<Seo>) => {
      if (!article) return
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

      saveTimerRef.current = setTimeout(async () => {
        const currentSeo = (article.seo as Seo) ?? {}
        const newSeo = { ...currentSeo, ...patch }
        const res = await fetch(`/api/articles/${article.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seo: newSeo }),
        })
        const updated = await res.json()
        onUpdate(updated)
      }, 2000)
    },
    [article, onUpdate]
  )

  const handleTitleSelect = (title: string) => {
    setSelectedTitle(title)
    saveSeo({ selected_title: title })
  }

  const handleTitleChange = (value: string) => {
    setSelectedTitle(value)
    saveSeo({ selected_title: value })
  }

  const handlePromoteUrlChange = (value: string) => {
    setPromoteUrl(value)
    saveSeo({ promote_url: value })
  }

  const handleShortLinkNameChange = (value: string) => {
    setShortLinkName(value)
    saveSeo({ short_link_name: value })
  }

  const isPending = article?.status === "pending" || article?.status === "generating"

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-4 rounded-full bg-blue-500" />
          <h2 className="text-sm font-semibold text-slate-700 tracking-tight">SEO 設定</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* No Article Placeholder */}
        {!article ? (
          <div className="px-4 py-10 text-center">
            <p className="text-xs text-slate-400">選擇或生成文章後，可在此設定 SEO</p>
          </div>
        ) : (
          <div className="p-4 space-y-5">
            {/* AI Title Options */}
            <div>
              <SectionLabel>AI 標題選項</SectionLabel>
              {isPending ? (
                <SkeletonBlock rows={3} />
              ) : !article.titles?.length ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center">
                  <p className="text-xs text-slate-400">文章生成後顯示標題</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {article.titles.map((title, i) => {
                    const isActive = selectedTitle === title
                    return (
                      <button
                        key={i}
                        onClick={() => handleTitleSelect(title)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs leading-snug border cursor-pointer ${
                          isActive
                            ? "border-blue-400 bg-blue-50 text-blue-800 shadow-sm"
                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <span className={`inline-block w-4 h-4 rounded-full text-[10px] font-bold mr-2 flex-shrink-0 leading-4 text-center ${
                          isActive ? "bg-blue-500 text-white" : "bg-slate-200 text-slate-500"
                        }`}
                          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", verticalAlign: "middle" }}
                        >
                          {i + 1}
                        </span>
                        {title}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-slate-100" />

            {/* Editable Title */}
            <div>
              <SectionLabel>文章標題</SectionLabel>
              <textarea
                value={selectedTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="選擇上方標題，或手動輸入"
                rows={3}
                className="w-full px-3 py-2.5 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 focus:bg-white resize-none placeholder:text-slate-300 leading-relaxed"
              />
            </div>

            {/* Promote URL */}
            <div>
              <SectionLabel>Promote URL</SectionLabel>
              <input
                type="url"
                value={promoteUrl}
                onChange={(e) => handlePromoteUrlChange(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2.5 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 focus:bg-white placeholder:text-slate-300 font-mono"
              />
            </div>

            {/* 短連結名稱 */}
            <div>
              <SectionLabel>短連結名稱</SectionLabel>
              <input
                type="text"
                value={shortLinkName}
                onChange={(e) => handleShortLinkNameChange(e.target.value)}
                placeholder=""
                className="w-full px-3 py-2.5 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 focus:bg-white placeholder:text-slate-300"
              />
            </div>

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
          </div>
        )}
      </div>
      {coverModalOpen && article && (
        <CoverModal
          articleId={article.id}
          text={selectedTitle}
          onTextChange={handleTitleChange}
          persistedState={coverState}
          onStateChange={setCoverState}
          onClose={() => setCoverModalOpen(false)}
        />
      )}
    </div>
  )
}
