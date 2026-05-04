"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import {
  useCreateBlockNote,
  useEditorChange,
  useEditorSelectionChange,
} from "@blocknote/react"
import { BlockNoteView } from "@blocknote/mantine"
import "@blocknote/mantine/style.css"
import { BlockNoteSchema, defaultStyleSpecs, createStyleSpec } from "@blocknote/core"
import TurndownService from "turndown"
import { Article } from "@/lib/types"
import { SpinnerIcon, CheckIcon } from "./Icons"

// ─── Custom fontSize style ───────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FontSizeStyle = createStyleSpec(
  { type: "fontSize", propSchema: "string" as const },
  {
    render(value: string) {
      const dom = document.createElement("span")
      dom.style.fontSize = value
      return { dom, contentDOM: dom }
    },
  }
)

const editorSchema = BlockNoteSchema.create({
  styleSpecs: { ...defaultStyleSpecs, fontSize: FontSizeStyle },
})

interface Props {
  article: Article
  onUpdate: (article: Article) => void
}

type SaveState = "saved" | "saving" | "idle"
type BlockType = "paragraph" | "heading" | "bulletListItem" | "numberedListItem"

// ─── Toolbar ────────────────────────────────────────────────────────────────

const FONT_SIZES = [
  { label: "14px", value: "14px" },
  { label: "16px", value: "16px" },
  { label: "18px（預設）", value: "" },
  { label: "20px", value: "20px" },
  { label: "22px", value: "22px" },
  { label: "24px", value: "24px" },
  { label: "28px", value: "28px" },
  { label: "32px", value: "32px" },
]

function EditorToolbar({
  editor,
  onInsertCTA,
  ctaDisabled,
  ctaSending,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any
  onInsertCTA: () => void
  ctaDisabled: boolean
  ctaSending: boolean
}) {
  const [styles, setStyles] = useState<Record<string, boolean>>({})
  const [blockType, setBlockType] = useState<BlockType>("paragraph")
  const [headingLevel, setHeadingLevel] = useState(1)
  const [activeTextColor, setActiveTextColor] = useState<string>("")
  const [activeFontSize, setActiveFontSize] = useState<string>("")
  const colorInputRef = useRef<HTMLInputElement>(null)

  const syncState = useCallback(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const activeStyles = (editor.getActiveStyles() as any) ?? {}
      setStyles(activeStyles)
      setActiveTextColor(activeStyles.textColor ?? "")
      setActiveFontSize(activeStyles.fontSize ?? "")
      const pos = editor.getTextCursorPosition()
      if (pos?.block) {
        setBlockType(pos.block.type as BlockType)
        if (pos.block.type === "heading") {
          setHeadingLevel((pos.block.props as { level: number }).level ?? 1)
        }
      }
    } catch {}
  }, [editor])

  useEditorChange(syncState, editor)
  useEditorSelectionChange(syncState, editor)

  const applyBlock = (type: BlockType, props?: object) => {
    try {
      const block = editor.getTextCursorPosition().block
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editor.updateBlock(block, { type, ...(props ? { props } : {}) } as any)
      editor.focus()
    } catch {}
  }

  const toggle = (style: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editor.toggleStyles({ [style]: true } as any)
    editor.focus()
  }

  const prevent = (e: React.MouseEvent) => e.preventDefault()

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 bg-white border-b border-gray-200 flex-wrap select-none">
      <TBtn active={blockType === "paragraph"} onClick={() => applyBlock("paragraph")} onMouseDown={prevent} label="正文">
        <span className="text-[11px] font-medium tracking-tight">P</span>
      </TBtn>
      <TBtn active={blockType === "heading" && headingLevel === 1} onClick={() => applyBlock("heading", { level: 1 })} onMouseDown={prevent} label="標題 1">
        <span className="text-[11px] font-bold">H1</span>
      </TBtn>
      <TBtn active={blockType === "heading" && headingLevel === 2} onClick={() => applyBlock("heading", { level: 2 })} onMouseDown={prevent} label="標題 2">
        <span className="text-[11px] font-bold">H2</span>
      </TBtn>
      <TBtn active={blockType === "heading" && headingLevel === 3} onClick={() => applyBlock("heading", { level: 3 })} onMouseDown={prevent} label="標題 3">
        <span className="text-[11px] font-bold">H3</span>
      </TBtn>

      <Sep />

      <TBtn active={!!styles.bold} onClick={() => toggle("bold")} onMouseDown={prevent} label="粗體 (Ctrl+B)">
        <span className="text-[13px] font-bold">B</span>
      </TBtn>
      <TBtn active={!!styles.italic} onClick={() => toggle("italic")} onMouseDown={prevent} label="斜體 (Ctrl+I)">
        <span className="text-[13px] italic font-medium">I</span>
      </TBtn>
      <TBtn active={!!styles.underline} onClick={() => toggle("underline")} onMouseDown={prevent} label="底線 (Ctrl+U)">
        <span className="text-[13px] underline">U</span>
      </TBtn>
      <TBtn active={!!styles.strike} onClick={() => toggle("strike")} onMouseDown={prevent} label="刪除線">
        <span className="text-[13px] line-through">S</span>
      </TBtn>
      <TBtn active={!!styles.code} onClick={() => toggle("code")} onMouseDown={prevent} label="行內程式碼">
        <CodeIcon />
      </TBtn>

      <Sep />

      <TBtn active={blockType === "bulletListItem"} onClick={() => applyBlock("bulletListItem")} onMouseDown={prevent} label="項目清單">
        <BulletIcon />
      </TBtn>
      <TBtn active={blockType === "numberedListItem"} onClick={() => applyBlock("numberedListItem")} onMouseDown={prevent} label="編號清單">
        <NumberedIcon />
      </TBtn>

      <Sep />

      <TBtn
        active={false}
        onClick={onInsertCTA}
        onMouseDown={prevent}
        label={ctaDisabled ? "插入 CTA（需填寫 Promote URL 與短連結名稱）" : "插入 CTA"}
        disabled={ctaDisabled || ctaSending}
      >
        {ctaSending ? <SpinnerIcon size={14} className="text-blue-500" /> : <CTAIcon />}
      </TBtn>

      <Sep />

      {/* Font size */}
      <select
        value={activeFontSize}
        title="字體大小"
        onChange={(e) => {
          const val = e.target.value
          if (val) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            editor.addStyles({ fontSize: val } as any)
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            editor.removeStyles({ fontSize: "" } as any)
          }
          editor.focus()
        }}
        className="h-7 px-1 text-[11px] rounded border border-gray-200 bg-white text-gray-700 cursor-pointer outline-none hover:border-gray-300 flex-shrink-0"
      >
        {FONT_SIZES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      {/* Text color */}
      <div className="relative flex items-center flex-shrink-0">
        <button
          type="button"
          title={activeTextColor ? `文字顏色：${activeTextColor}` : "文字顏色"}
          onMouseDown={prevent}
          onClick={() => colorInputRef.current?.click()}
          className="w-7 h-7 flex flex-col items-center justify-center gap-0.5 rounded cursor-pointer hover:bg-gray-100"
        >
          <span className="text-[13px] font-bold leading-none" style={{ color: activeTextColor || "#374151" }}>A</span>
          <div className="w-4 h-1 rounded-full" style={{ backgroundColor: activeTextColor || "#374151" }} />
        </button>
        <input
          ref={colorInputRef}
          type="color"
          value={activeTextColor || "#374151"}
          onChange={(e) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            editor.addStyles({ textColor: e.target.value } as any)
            editor.focus()
          }}
          className="absolute opacity-0 w-0 h-0 pointer-events-none"
        />
        {activeTextColor && (
          <button
            type="button"
            title="清除顏色"
            onMouseDown={prevent}
            onClick={() => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              editor.removeStyles({ textColor: "" } as any)
              editor.focus()
            }}
            className="w-4 h-4 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 text-xs cursor-pointer leading-none"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}

function Sep() {
  return <div className="w-px h-5 bg-gray-200 mx-1 flex-shrink-0" />
}

function TBtn({
  active, onClick, onMouseDown, label, children, disabled,
}: {
  active: boolean
  onClick: () => void
  onMouseDown: (e: React.MouseEvent) => void
  label: string
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      onMouseDown={onMouseDown}
      disabled={disabled}
      className={`flex items-center justify-center w-7 h-7 rounded flex-shrink-0 ${
        disabled
          ? "text-gray-300 cursor-not-allowed"
          : active
            ? "bg-blue-100 text-blue-700 cursor-pointer"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 cursor-pointer"
      }`}
    >
      {children}
    </button>
  )
}

function BulletIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="2" cy="3.5" r="1.2" fill="currentColor" />
      <circle cx="2" cy="7" r="1.2" fill="currentColor" />
      <circle cx="2" cy="10.5" r="1.2" fill="currentColor" />
      <rect x="4.5" y="2.8" width="8" height="1.4" rx="0.7" fill="currentColor" />
      <rect x="4.5" y="6.3" width="8" height="1.4" rx="0.7" fill="currentColor" />
      <rect x="4.5" y="9.8" width="8" height="1.4" rx="0.7" fill="currentColor" />
    </svg>
  )
}

function NumberedIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <text x="0" y="4.5" fontSize="4" fontFamily="monospace">1.</text>
      <text x="0" y="8" fontSize="4" fontFamily="monospace">2.</text>
      <text x="0" y="11.5" fontSize="4" fontFamily="monospace">3.</text>
      <rect x="5" y="2.8" width="8" height="1.4" rx="0.7" />
      <rect x="5" y="6.3" width="8" height="1.4" rx="0.7" />
      <rect x="5" y="9.8" width="8" height="1.4" rx="0.7" />
    </svg>
  )
}

function CodeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4,3 1,7 4,11" />
      <polyline points="10,3 13,7 10,11" />
    </svg>
  )
}

function CTAIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="12" height="6" rx="1.5" />
      <line x1="4" y1="7" x2="10" y2="7" />
      <polyline points="8,5.5 10,7 8,8.5" />
    </svg>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function BlockEditor({ article, onUpdate }: Props) {
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [ctaSending, setCtaSending] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitializedRef = useRef(false)

  const editor = useCreateBlockNote({ schema: editorSchema })

  useEffect(() => {
    if (!editor || isInitializedRef.current) return

    const initEditor = async () => {
      if (!article.content) return

      const content = article.content as { type?: string; raw?: string } | unknown[]

      if (Array.isArray(content)) {
        editor.replaceBlocks(editor.document, content as Parameters<typeof editor.replaceBlocks>[1])
        isInitializedRef.current = true
      } else if (content && typeof content === "object" && "type" in content && content.type === "html") {
        const blocks = await editor.tryParseHTMLToBlocks((content as { raw: string }).raw)
        editor.replaceBlocks(editor.document, blocks)
        isInitializedRef.current = true

        const res = await fetch(`/api/articles/${article.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: blocks }),
        })
        const updated = await res.json()
        onUpdate(updated)
      }
    }

    initEditor()
  }, [editor, article.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // 攔截複製事件，將預設樣式加為 inline style
  // 我們的 listener 在 BlockNote 之後註冊，所以 BlockNote 的 handler 一定先跑，
  // 先把含有正確 <ul>/<ol><li> 結構的 HTML 放進 clipboardData，
  // 我們再讀出來加 inline style 後覆蓋回去。
  useEffect(() => {
    const addInlineStyles = (root: Element) => {
      root.querySelectorAll("h2").forEach((el) => {
        if (!(el as HTMLElement).style.color)
          (el as HTMLElement).style.color = "rgb(239, 135, 0)"
      })
      root.querySelectorAll("h3").forEach((el) => {
        if (!(el as HTMLElement).style.color)
          (el as HTMLElement).style.color = "rgb(21, 170, 191)"
      })
      root.querySelectorAll("p").forEach((el) => {
        if (!(el as HTMLElement).style.fontSize)
          (el as HTMLElement).style.fontSize = "18px"
      })
    }

    const handleCopy = (e: ClipboardEvent) => {
      if (!e.clipboardData) return

      const selection = window.getSelection()
      if (!selection?.rangeCount) return
      const editorEl = document.querySelector(".bn-editor")
      if (!editorEl) return
      let inEditor = false
      for (let i = 0; i < selection.rangeCount; i++) {
        if (editorEl.contains(selection.getRangeAt(i).commonAncestorContainer)) {
          inEditor = true; break
        }
      }
      if (!inEditor) return

      // 讀取 BlockNote 已設定的 HTML（含正確的 <ul>/<li> 結構）
      const blockNoteHTML = e.clipboardData.getData("text/html")
      if (!blockNoteHTML) return

      const parser = new DOMParser()
      const parsed = parser.parseFromString(blockNoteHTML, "text/html")
      addInlineStyles(parsed.body)
      e.clipboardData.setData("text/html", parsed.body.innerHTML)
      // BlockNote 已呼叫 e.preventDefault()，不需重複呼叫
    }

    document.addEventListener("copy", handleCopy)
    return () => document.removeEventListener("copy", handleCopy)
  }, [])

  const handleChange = useCallback(() => {
    if (!isInitializedRef.current) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSaveState("saving")

    saveTimerRef.current = setTimeout(async () => {
      const blocks = editor.document
      const res = await fetch(`/api/articles/${article.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: blocks }),
      })
      const updated = await res.json()
      onUpdate(updated)
      setSaveState("saved")
    }, 2000)
  }, [editor, article.id, onUpdate])

  const seo = article.seo as { promote_url?: string; short_link_name?: string } | null
  const isValidUrl = (v: string) => { try { new URL(v); return true } catch { return false } }
  const ctaDisabled = !seo?.promote_url || !isValidUrl(seo.promote_url) || !seo?.short_link_name?.trim()

  const handleCTAInsert = useCallback(async () => {
    const url = seo?.promote_url ?? ""
    const note = seo?.short_link_name ?? ""
    const icsParams = new URLSearchParams({ note, redirect_url: url })
    window.open(
      `https://ics-admin.pressplay.cc/admin/pressplay/promote/ad_link/add?${icsParams}`,
      "_blank"
    )
    setCtaSending(true)
    try {
      const html: string = await editor.blocksToHTMLLossy(editor.document)
      const td = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" })
      const markdown = td.turndown(html)

      const res = await fetch("/api/cta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, content: markdown }),
      })

      const text = await res.text()
      console.log("[CTA] raw response:", text)
      if (!text.trim()) return
      const json = JSON.parse(text)
      console.log("[CTA] parsed json:", json)
      const responseHtml: string = Array.isArray(json) ? (json[0]?.data ?? json[0]?.json?.data) : (json?.data ?? json?.json?.data)
      console.log("[CTA] responseHtml:", responseHtml)

      if (responseHtml) {
        const newBlocks = editor.tryParseHTMLToBlocks(responseHtml)
        console.log("[CTA] newBlocks count:", newBlocks.length, newBlocks)
        const lastBlock = editor.document[editor.document.length - 1]
        console.log("[CTA] lastBlock:", lastBlock)
        if (newBlocks.length > 0 && lastBlock) {
          editor.insertBlocks(newBlocks, lastBlock, "after")
          console.log("[CTA] inserted successfully")
        }
      } else {
        console.warn("[CTA] responseHtml is empty, check response structure")
      }
    } catch (err) {
      console.error("[CTA] error:", err)
    } finally {
      setCtaSending(false)
    }
  }, [editor, seo])

  return (
    <div className="relative min-h-full flex flex-col">
      {/* Status bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-2 bg-white/95 backdrop-blur-sm border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-400">編輯中</span>
          <span className="text-slate-200">·</span>
          <span className="text-xs text-slate-600 font-medium">{article.keyword}</span>
        </div>
        <div className="flex items-center gap-1.5 h-5">
          {saveState === "saving" && (
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <SpinnerIcon size={12} className="text-slate-400" />
              儲存中
            </span>
          )}
          {saveState === "saved" && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600">
              <CheckIcon size={12} className="text-emerald-500" />
              已儲存
            </span>
          )}
        </div>
      </div>

      {/* Formatting toolbar */}
      <div className="sticky top-[37px] z-10 bg-white">
        <EditorToolbar
          editor={editor}
          onInsertCTA={handleCTAInsert}
          ctaDisabled={ctaDisabled}
          ctaSending={ctaSending}
        />
      </div>

      {/* Editor content */}
      <style>{`
        .bn-editor h2 { color: rgb(239, 135, 0); }
        .bn-editor h3 { color: rgb(21, 170, 191); }
        .bn-editor p { font-size: 18px; }
      `}</style>
      <div className="px-2 py-6 max-w-3xl mx-auto w-full">
        <BlockNoteView
          editor={editor}
          onChange={handleChange}
          theme="light"
          formattingToolbar={false}
        />
      </div>
    </div>
  )
}
