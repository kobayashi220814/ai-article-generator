"use client"

import { Suspense, useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArticleListItem, Article } from "@/lib/types"
import Sidebar from "@/components/Sidebar"
import Editor from "@/components/Editor"
import SeoPanel from "@/components/SeoPanel"

export default function Page() {
  return (
    <Suspense>
      <Home />
    </Suspense>
  )
}

function Home() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [articles, setArticles] = useState<ArticleListItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(
    searchParams.get("article")
  )
  const [article, setArticle] = useState<Article | null>(null)
  const [isNew, setIsNew] = useState(!searchParams.get("article"))
  const articleCache = useRef<Map<string, Article>>(new Map())

  const selectArticle = useCallback((id: string | null) => {
    setSelectedId(id)
    if (id) {
      router.replace(`/?article=${id}`, { scroll: false })
    } else {
      router.replace("/", { scroll: false })
    }
  }, [router])

  const fetchArticles = useCallback(async () => {
    const res = await fetch("/api/articles")
    const data = await res.json()
    setArticles(data)
  }, [])

  const fetchArticle = useCallback(async (id: string) => {
    const cached = articleCache.current.get(id)
    if (cached) setArticle(cached)
    const res = await fetch(`/api/articles/${id}`)
    const data = await res.json()
    articleCache.current.set(id, data)
    setArticle(data)
  }, [])

  useEffect(() => {
    fetchArticles()
  }, [fetchArticles])

  useEffect(() => {
    if (selectedId) {
      fetchArticle(selectedId)
      setIsNew(false)
    }
  }, [selectedId, fetchArticle])

  const handleNewArticle = () => {
    selectArticle(null)
    setArticle(null)
    setIsNew(true)
  }

  const handleGenerate = async (keyword: string) => {
    const res = await fetch("/api/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword }),
    })
    const data = await res.json()
    await fetchArticles()
    selectArticle(data.id)
    setIsNew(false)
  }

  const handleCreateBlank = async () => {
    const res = await fetch("/api/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "manual" }),
    })
    const data = await res.json()
    await fetchArticles()
    selectArticle(data.id)
    setIsNew(false)
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/articles/${id}`, { method: "DELETE" })
    await fetchArticles()
    if (selectedId === id) handleNewArticle()
  }

  const handleArticleUpdate = useCallback((updated: Article) => {
    articleCache.current.set(updated.id, updated)
    setArticle(updated)
    setArticles((prev) =>
      prev.map((a) =>
        a.id === updated.id
          ? { ...a, status: updated.status, keyword: updated.keyword }
          : a
      )
    )
  }, [])

  const handleRetry = async () => {
    if (!selectedId) return
    await fetch(`/api/articles/${selectedId}/retry`, { method: "POST" })
    await fetchArticle(selectedId)
    setArticles((prev) =>
      prev.map((a) => (a.id === selectedId ? { ...a, status: "pending" } : a))
    )
  }

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <aside className="w-60 flex-shrink-0 border-r border-gray-200 flex flex-col">
        <Sidebar
          articles={articles}
          selectedId={selectedId}
          onSelect={selectArticle}
          onNew={handleNewArticle}
          onDelete={handleDelete}
        />
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <Editor
          article={article}
          isNew={isNew}
          onGenerate={handleGenerate}
          onCreateBlank={handleCreateBlank}
          onRetry={handleRetry}
          onArticleUpdate={handleArticleUpdate}
        />
      </main>

      <aside className="w-72 flex-shrink-0 border-l border-gray-200 flex flex-col">
        <SeoPanel article={article} onUpdate={handleArticleUpdate} />
      </aside>
    </div>
  )
}
