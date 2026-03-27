"use client"

import { useState } from "react"
import { ArticleListItem, ArticleStatus } from "@/lib/types"
import { PlusIcon, TrashIcon, DocumentIcon } from "./Icons"

interface Props {
  articles: ArticleListItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
}

function StatusIndicator({ status }: { status: ArticleStatus }) {
  if (status === "pending" || status === "generating") {
    return (
      <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
    )
  }
  if (status === "error") {
    return <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-400" />
  }
  return null
}

export default function Sidebar({ articles, selectedId, onSelect, onNew, onDelete }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setConfirmId(id)
  }

  const confirmDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setConfirmId(null)
    onDelete(id)
  }

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setConfirmId(null)
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 select-none">
      {/* Brand Header */}
      <div className="px-4 py-3.5 border-b border-slate-200/80">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 11l3-3 2 2 5-7" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-sm font-semibold text-slate-800 tracking-tight">AI 文章生成器</span>
        </div>
      </div>

      {/* New Article Button */}
      <div className="px-3 pt-3 pb-2">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-800 hover:shadow-sm border border-transparent hover:border-slate-200 cursor-pointer"
        >
          <PlusIcon size={15} className="text-slate-500" />
          <span>新文章</span>
        </button>
      </div>

      {/* Section Label */}
      {articles.length > 0 && (
        <div className="px-4 pt-2 pb-1">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
            文章紀錄
          </span>
        </div>
      )}

      {/* Article List */}
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {articles.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="w-8 h-8 rounded-xl bg-slate-200 flex items-center justify-center mx-auto mb-3">
              <DocumentIcon size={16} className="text-slate-400" />
            </div>
            <p className="text-xs font-medium text-slate-500">尚無文章</p>
            <p className="text-xs text-slate-400 mt-0.5">輸入關鍵字開始生成</p>
          </div>
        ) : (
          articles.map((article) => {
            const isSelected = selectedId === article.id
            return (
              <div
                key={article.id}
                className={`relative group px-3 py-2.5 mx-0 rounded-lg cursor-pointer mb-0.5 ${
                  isSelected
                    ? "bg-white shadow-sm border border-slate-200 text-slate-900"
                    : "text-slate-600 hover:bg-white/60 hover:text-slate-800"
                }`}
                onClick={() => onSelect(article.id)}
                onMouseEnter={() => setHoveredId(article.id)}
                onMouseLeave={() => {
                  setHoveredId(null)
                  if (confirmId === article.id) setConfirmId(null)
                }}
              >
                {confirmId === article.id ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500 flex-1">確定刪除？</span>
                    <button
                      onClick={(e) => confirmDelete(e, article.id)}
                      className="px-2 py-0.5 text-xs font-medium bg-red-500 text-white rounded-md hover:bg-red-600 cursor-pointer"
                    >
                      刪除
                    </button>
                    <button
                      onClick={cancelDelete}
                      className="px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-600 rounded-md hover:bg-slate-300 cursor-pointer"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <StatusIndicator status={article.status} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-medium truncate leading-snug ${isSelected ? "text-slate-900" : "text-slate-700"}`}>
                        {article.keyword}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(article.createdAt).toLocaleDateString("zh-TW", {
                          month: "short",
                          day: "numeric",
                        })}
                        {(article.status === "pending" || article.status === "generating") && (
                          <span className="ml-1.5 text-amber-500">生成中</span>
                        )}
                        {article.status === "error" && (
                          <span className="ml-1.5 text-red-400">失敗</span>
                        )}
                      </p>
                    </div>
                    {hoveredId === article.id && confirmId !== article.id && (
                      <button
                        onClick={(e) => handleDelete(e, article.id)}
                        className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 cursor-pointer opacity-0 group-hover:opacity-100"
                        aria-label="刪除文章"
                      >
                        <TrashIcon size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
