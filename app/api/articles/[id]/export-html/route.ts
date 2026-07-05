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
    href?: string
    text?: string
    uuid?: string
    courses?: string
    html?: string
    title?: string
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
    case "ppButton": {
      const href = escapeAttr(block.props?.href ?? "")
      const text = escapeText(block.props?.text ?? "了解更多！")
      const uuid = block.props?.uuid ?? ""
      return `<p data-pp-ai-uuid="${uuid}" style="text-align: center;"><a class="btn btn-primary" href="${href}" style="color: #FFF!important;text-align: right ; font-size:18px;padding:10px 20px; border-radius:7px;">${text}</a></p>`
    }
    case "ppCourseCarousel":
      return courseCarouselToHTML(block)
    case "table":
      return tableToHTML(block)
    case "image": {
      const url = block.props?.url
      if (!url) return ""
      const caption = block.props?.caption ?? ""
      const alignment = align && align !== "left" ? align : "left"
      const pStyle = alignment !== "left" ? ` style="text-align:${alignment}"` : ""
      const altAttr = caption ? ` alt="${escapeAttr(caption)}"` : ""
      // 圖片連結存在 image block 的 name 欄位（http(s) 或站內絕對路徑才視為連結）
      const link = (block.props?.name ?? "").trim()
      const hasLink = /^(https?:\/\/|\/)/.test(link)
      if (hasLink) {
        // 連結圖片：Froala 內嵌圖片格式 fr-dii（display: inline）+ fr-draggable，外包 js-outside-link
        const img = `<img${altAttr} class="fr-dii fr-draggable" src="${escapeAttr(url)}" style="max-width:100%;height:auto;">`
        return `<p${pStyle}><a href="${escapeAttr(link)}" name="" class="js-outside-link" target="_blank" rel="noopener noreferrer">${img}</a></p>`
      }
      // Froala 標準圖片格式：fr-fic（floating image container）+ fr-dib（display: block）
      return `<p${pStyle}><img src="${escapeAttr(url)}"${altAttr} class="fr-fic fr-dib" style="max-width:100%;height:auto;"></p>`
    }
    default:
      return `<p style="${STYLE.p}">${inner || "<br>"}</p>`
  }
}

// 課程輪播（course-carousel-card 版本 A）：把 props.courses 還原成橫向捲動卡片 HTML
type CarouselCourse = { href?: string; img?: string; title?: string; desc?: string }

function courseCarouselToHTML(block: BNBlock): string {
  // 新版（radio 輪播）：整段 fragment（含 <style>）已預先渲染好存在 html prop，原樣輸出
  const rawHtml = block.props?.html
  if (typeof rawHtml === "string" && rawHtml.trim()) return rawHtml

  let courses: CarouselCourse[] = []
  try {
    const parsed = JSON.parse(block.props?.courses ?? "[]")
    if (Array.isArray(parsed)) courses = parsed
  } catch {
    return ""
  }
  if (!courses.length) return ""

  const card = (c: CarouselCourse): string => {
    const u = escapeAttr(c.href ?? "")
    const img = escapeAttr(c.img ?? "")
    const title = escapeText(c.title ?? "")
    const desc = escapeText(c.desc ?? "")
    return (
      `<div style="flex:0 0 280px; display:flex; flex-direction:column; scroll-snap-align:start; border:1px solid #eeeeee; border-radius:14px; overflow:hidden; background-color:#ffffff; background-image:linear-gradient(#ffffff,#ffffff); box-shadow:0 2px 10px rgba(0,0,0,0.08);">` +
      `<a href="${u}" target="_blank" rel="" style="display:block; text-decoration:none;">` +
      `<img src="${img}" alt="${escapeAttr(c.title ?? "")}" style="display:block; width:100%; height:150px; object-fit:cover;"></a>` +
      `<div style="padding:16px; display:flex; flex-direction:column; flex:1;">` +
      `<p style="margin:0 0 8px; min-height:45px; font-size:16px; font-weight:bold; line-height:1.4;">` +
      `<a href="${u}" target="_blank" rel="" style="text-decoration:none; color:#222222 !important;">${title}</a></p>` +
      `<p style="margin:0 0 14px; flex:1; font-size:14px; line-height:1.6; color:#666666 !important;">${desc}</p>` +
      `<a href="${u}" target="_blank" rel="" style="margin-top:auto; align-self:flex-start; display:inline-block; background:#FF6B00 !important; color:#FFFFFF !important; font-size:14px; font-weight:bold; padding:9px 22px; border-radius:6px; text-decoration:none;">了解更多 →</a>` +
      `</div></div>`
    )
  }

  return (
    `<div style="display:flex; gap:16px; overflow-x:auto; padding:4px 4px 18px; margin:0 0 28px; scroll-snap-type:x mandatory;">` +
    courses.map(card).join("") +
    `</div>`
  )
}

type BNTableCell = {
  type?: "tableCell"
  props?: {
    colspan?: number
    rowspan?: number
    textAlignment?: "left" | "center" | "right" | "justify"
    backgroundColor?: string
    textColor?: string
  }
  content?: BNInline[]
}

// 舊版 BlockNote 的 cell 可能直接是 inline 陣列，新版是物件
type BNTableCellLike = BNTableCell | BNInline[]

type BNTableContent = {
  type?: "tableContent"
  headerRows?: number
  columnWidths?: (number | null)[]
  rows?: { cells?: BNTableCellLike[] }[]
}

function tableToHTML(block: BNBlock): string {
  const content = block.content as unknown as BNTableContent | undefined
  const rows = content?.rows
  if (!Array.isArray(rows) || rows.length === 0) return ""

  const headerRows = content?.headerRows ?? 0

  // 對齊 PressPlay（Froala）編輯器原生 table 格式：
  // - th：<span style="font-size: 18px;"><strong>…</strong><br></span>
  // - td：colspan/rowspan 永遠帶值，內容包 <p><span style="font-size: 18px;">…</span></p>
  // - table 不加 inline style，交給 Froala CSS 上色
  const renderCell = (cell: BNTableCellLike, isHeader: boolean): string => {
    const inline = Array.isArray(cell) ? cell : cell?.content ?? []
    const props = Array.isArray(cell) ? undefined : cell?.props
    const inner = inlineContentToHTML(inline)

    const colspan = props?.colspan ?? 1
    const rowspan = props?.rowspan ?? 1

    if (isHeader) {
      const span =
        (colspan > 1 ? ` colspan="${colspan}"` : "") +
        (rowspan > 1 ? ` rowspan="${rowspan}"` : "")
      return `<th${span}><span style="font-size: 18px;"><strong>${inner || "<br>"}</strong><br></span></th>`
    }

    const pStyleParts: string[] = []
    const align = props?.textAlignment
    if (align && align !== "left") pStyleParts.push(`text-align:${align}`)
    const pStyle = pStyleParts.length ? ` style="${pStyleParts.join(";")}"` : ""

    return `<td colspan="${colspan}" rowspan="${rowspan}"><p${pStyle}><span style="font-size: 18px;">${inner || "<br>"}</span></p></td>`
  }

  const out: string[] = ["<table>"]

  if (headerRows > 0) {
    out.push("<thead>")
    for (let i = 0; i < headerRows && i < rows.length; i++) {
      const cells = rows[i].cells ?? []
      out.push("<tr>" + cells.map((c) => renderCell(c, true)).join("") + "</tr>")
    }
    out.push("</thead>")
  }

  out.push("<tbody>")
  for (let i = headerRows; i < rows.length; i++) {
    const cells = rows[i].cells ?? []
    out.push("<tr>" + cells.map((c) => renderCell(c, false)).join("") + "</tr>")
  }
  out.push("</tbody>")

  out.push("</table>")
  return out.join("")
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
