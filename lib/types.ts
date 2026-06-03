export type ArticleStatus = "pending" | "generating" | "done" | "error"

export type ArticleSource = "ai" | "manual"

export interface ArticleListItem {
  id: string
  keyword: string
  source: ArticleSource
  status: ArticleStatus
  createdAt: string
}

export interface CoverCacheImage {
  id: string
  thumb_url: string
  full_url: string
  alt: string
}

export interface Seo {
  selected_title?: string
  promote_url?: string
  short_link_name?: string
  cover_cache?: { search_terms: string[]; images: CoverCacheImage[] }
}

export interface Article extends ArticleListItem {
  content: { type: "html"; raw: string } | unknown[] | null
  titles: string[]
  seo: Seo | null
  errorMsg: string | null
  updatedAt: string
}
