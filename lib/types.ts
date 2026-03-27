export type ArticleStatus = "pending" | "generating" | "done" | "error"

export interface ArticleListItem {
  id: string
  keyword: string
  status: ArticleStatus
  createdAt: string
}

export interface Seo {
  selected_title?: string
  meta_description?: string
  slug?: string
}

export interface Article extends ArticleListItem {
  content: { type: "html"; raw: string } | unknown[] | null
  titles: string[]
  seo: Seo | null
  errorMsg: string | null
  updatedAt: string
}
