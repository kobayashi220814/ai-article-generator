import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import type { Seo } from "@/lib/types"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

const STYLE = {
  h2: "color:rgb(239,135,0)",
  h3: "color:rgb(21,170,191)",
  p: "font-size:18px",
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const article = await prisma.article.findUnique({ where: { id } })
  if (!article) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: CORS_HEADERS }
    )
  }
  if (article.status !== "done") {
    return NextResponse.json(
      { error: "Article is not ready", status: article.status },
      { status: 409, headers: CORS_HEADERS }
    )
  }

  const seo = (article.seo as Seo | null) ?? null
  const title =
    seo?.selected_title?.trim() ||
    article.titles?.[0] ||
    article.keyword

  let html: string
  try {
    html = renderArticleHTML(article.content)
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to render HTML",
        detail: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
      { status: 500, headers: CORS_HEADERS }
    )
  }

  return NextResponse.json(
    {
      id: article.id,
      keyword: article.keyword,
      title,
      seo,
      html,
    },
    { headers: CORS_HEADERS }
  )
}

// ─────────────────────────────────────────────────────────────────────────────

type BNStyles = {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  code?: boolean
  textColor?: string
  backgroundColor?: string
  fontSize?: string
}

type BNInline =
  | { type: "text"; text: string; styles?: BNStyles }
  | { type: "link"; href: string; content: BNInline[] }

type BNBlock = {
  type: string
  props?: {
    level?: number
    textAlignment?: "left" | "center" | "right" | "justify"
    textColor?: string
    backgroundColor?: string
    url?: string
    caption?: string
    name?: string
    showPreview?: boolean
    previewWidth?: number
  }
  content?: BNInline[]
  children?: BNBlock[]
}

function renderArticleHTML(content: unknown): string {
  if (!content) return ""
  if (Array.isArray(content)) {
    return blocksToHTML(content as BNBlock[])
  }
  if (
    typeof content === "object" &&
    content !== null &&
    "type" in content &&
    (content as { type: string }).type === "html"
  ) {
    const raw = (content as { raw?: string }).raw ?? ""
    return applyInlineStylesToRawHTML(raw)
  }
  return ""
}

function blocksToHTML(blocks: BNBlock[]): string {
  if (!Array.isArray(blocks)) {
    throw new Error(`blocksToHTML: expected array, got ${typeof blocks}`)
  }
  const out: string[] = []
  let currentList: "ul" | "ol" | null = null

  const closeList = () => {
    if (currentList) {
      out.push(`</${currentList}>`)
      currentList = null
    }
  }

  for (const block of blocks) {
    const isUL = block.type === "bulletListItem"
    const isOL = block.type === "numberedListItem"
    const wantList: "ul" | "ol" | null = isUL ? "ul" : isOL ? "ol" : null

    if (wantList !== currentList) {
      closeList()
      if (wantList) {
        out.push(`<${wantList}>`)
        currentList = wantList
      }
    }

    out.push(blockToHTML(block))
  }
  closeList()
  return out.join("\n")
}

function blockToHTML(block: BNBlock): string {
  const inner = inlineContentToHTML(block.content ?? [])
  const align = block.props?.textAlignment

  switch (block.type) {
    case "heading": {
      const level = block.props?.level ?? 1
      const tag = `h${Math.min(Math.max(level, 1), 6)}`
      const styleParts: string[] = []
      if (level === 2) styleParts.push(STYLE.h2)
      else if (level === 3) styleParts.push(STYLE.h3)
      if (block.props?.textColor && block.props.textColor !== "default") {
        // 覆蓋預設色（使用者自訂）
        styleParts[0] = `color:${block.props.textColor}`
      }
      if (align && align !== "left") styleParts.push(`text-align:${align}`)
      const style = styleParts.length ? ` style="${styleParts.join(";")}"` : ""
      return `<${tag}${style}>${inner || "<br>"}</${tag}>`
    }
    case "paragraph": {
      const styleParts: string[] = [STYLE.p]
      if (align && align !== "left") styleParts.push(`text-align:${align}`)
      return `<p style="${styleParts.join(";")}">${inner || "<br>"}</p>`
    }
    case "bulletListItem":
    case "numberedListItem": {
      const pStyle = align && align !== "left" ? ` style="text-align:${align}"` : ""
      return `<li><p${pStyle}><span style="font-size: 18px;">${inner || "<br>"}</span></p></li>`
    }
    case "image": {
      const url = block.props?.url
      if (!url) return ""
      const caption = block.props?.caption ?? ""
      const alignment = align && align !== "left" ? align : "left"
      const pStyle = alignment !== "left" ? ` style="text-align:${alignment}"` : ""
      const altAttr = caption ? ` alt="${escapeAttr(caption)}"` : ""
      // Froala 標準圖片格式：fr-fic（floating image container）+ fr-dib（display: block）
      return `<p${pStyle}><img src="${escapeAttr(url)}"${altAttr} class="fr-fic fr-dib" style="max-width:100%;height:auto;"></p>`
    }
    default:
      return `<p style="${STYLE.p}">${inner || "<br>"}</p>`
  }
}

function inlineContentToHTML(items: BNInline[]): string {
  if (!Array.isArray(items)) {
    // BlockNote 對 table block 的 content 是 object，不是陣列；先跳過避免炸
    return ""
  }
  let html = ""
  for (const item of items) {
    if (item.type === "text") {
      html += textWithStyles(item.text ?? "", item.styles ?? {})
    } else if (item.type === "link") {
      const href = escapeAttr(item.href ?? "")
      const inner = inlineContentToHTML(item.content ?? [])
      html += `<a href="${href}" target="_blank" rel="noopener noreferrer">${inner}</a>`
    }
  }
  return html
}

function textWithStyles(text: string, styles: BNStyles): string {
  let out = escapeText(text)

  const spanParts: string[] = []
  if (styles.textColor && styles.textColor !== "default")
    spanParts.push(`color:${styles.textColor}`)
  if (styles.backgroundColor && styles.backgroundColor !== "default")
    spanParts.push(`background-color:${styles.backgroundColor}`)
  if (styles.fontSize) spanParts.push(`font-size:${styles.fontSize}`)

  if (spanParts.length) {
    out = `<span style="${spanParts.join(";")}">${out}</span>`
  }

  if (styles.code) out = `<code>${out}</code>`
  if (styles.strike) out = `<s>${out}</s>`
  if (styles.underline) out = `<u>${out}</u>`
  if (styles.italic) out = `<em>${out}</em>`
  if (styles.bold) out = `<strong>${out}</strong>`

  return out
}

function escapeText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;")
}

// 處理 mock / 舊資料 (content = { type: "html", raw }) 的 fallback
function applyInlineStylesToRawHTML(html: string): string {
  return html
    .replace(/<h2(\s[^>]*)?>/gi, (m, attrs) =>
      injectStyle(`<h2${attrs ?? ""}>`, STYLE.h2)
    )
    .replace(/<h3(\s[^>]*)?>/gi, (m, attrs) =>
      injectStyle(`<h3${attrs ?? ""}>`, STYLE.h3)
    )
    .replace(/<p(\s[^>]*)?>/gi, (m, attrs) =>
      injectStyle(`<p${attrs ?? ""}>`, STYLE.p)
    )
    .replace(/<li(\s[^>]*)?>([\s\S]*?)<\/li>/gi, (m, attrs, inner) =>
      `<li${attrs ?? ""}><p><span style="font-size: 18px;">${inner}</span></p></li>`
    )
}

function injectStyle(openTag: string, style: string): string {
  if (/style\s*=/i.test(openTag)) {
    return openTag.replace(/style\s*=\s*"([^"]*)"/i, (m, existing) => {
      if (existing.includes(style.split(":")[0])) return m
      return `style="${existing.replace(/;\s*$/, "")};${style}"`
    })
  }
  return openTag.replace(/>$/, ` style="${style}">`)
}
