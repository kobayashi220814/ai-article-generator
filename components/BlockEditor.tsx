"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import {
  useCreateBlockNote,
  useEditorChange,
  useEditorSelectionChange,
} from "@blocknote/react"
import { BlockNoteView } from "@blocknote/mantine"
import "@blocknote/mantine/style.css"
import TurndownService from "turndown"
import { Article } from "@/lib/types"
import { SpinnerIcon, CheckIcon } from "./Icons"

interface Props {
  article: Article
  onUpdate: (article: Article) => void
}

type SaveState = "saved" | "saving" | "idle"
type BlockType = "paragraph" | "heading" | "bulletListItem" | "numberedListItem"

// ─── CTA Floating Input ───────────────────────────────────────────────────────

function CTAInput({
  onSubmit,
  onClose,
  sending,
}: {
  onSubmit: (url: string) => void
  onClose: () => void
  sending: boolean
}) {
  const [url, setUrl] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && url.trim()) onSubmit(url.trim())
    if (e.key === "Escape") onClose()
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border-b border-blue-200">
      <span className="text-xs font-semibold text-blue-600 whitespace-nowrap">插入 CTA</span>
      <input
        ref={inputRef}
        type="url"
        placeholder="輸入 URL，按 Enter 送出..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={handleKey}
        disabled={sending}
        className="flex-1 text-sm px-2.5 py-1 rounded border border-blue-200 bg-white outline-none focus:border-blue-400 disabled:opacity-50"
      />
      {sending ? (
        <SpinnerIcon size={14} className="text-blue-500 flex-shrink-0" />
      ) : (
        <button
          type="button"
          onClick={onClose}
          className="text-blue-300 hover:text-blue-500 transition-colors text-lg leading-none flex-shrink-0"
          title="取消"
        >
          ×
        </button>
      )}
    </div>
  )
}

// ─── Toolbar ────────────────────────────────────────────────────────────────

function EditorToolbar({
  editor,
  onInsertCTA,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any
  onInsertCTA: () => void
}) {
  const [styles, setStyles] = useState<Record<string, boolean>>({})
  const [blockType, setBlockType] = useState<BlockType>("paragraph")
  const [headingLevel, setHeadingLevel] = useState(1)

  const syncState = useCallback(() => {
    try {
      setStyles((editor.getActiveStyles() as Record<string, boolean>) ?? {})
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

      <TBtn active={false} onClick={onInsertCTA} onMouseDown={prevent} label="插入 CTA">
        <CTAIcon />
      </TBtn>
    </div>
  )
}

function Sep() {
  return <div className="w-px h-5 bg-gray-200 mx-1 flex-shrink-0" />
}

function TBtn({
  active, onClick, onMouseDown, label, children,
}: {
  active: boolean
  onClick: () => void
  onMouseDown: (e: React.MouseEvent) => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      onMouseDown={onMouseDown}
      className={`flex items-center justify-center w-7 h-7 rounded cursor-pointer flex-shrink-0 ${
        active ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
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
  const [showCTA, setShowCTA] = useState(false)
  const [ctaSending, setCtaSending] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitializedRef = useRef(false)

  const editor = useCreateBlockNote()

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

  const handleCTASubmit = useCallback(async (url: string) => {
    setCtaSending(true)
    try {
      const html: string = await editor.blocksToHTMLLossy(editor.document)
      const td = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" })
      const markdown = td.turndown(html)

      const res = await fetch("https://n8n.pressplay.cc/webhook/cta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, content: markdown }),
      })

      const json = await res.json()
      const responseHtml: string = Array.isArray(json) ? json[0]?.data : json?.data

      if (responseHtml) {
        const newBlocks = await editor.tryParseHTMLToBlocks(responseHtml)
        const lastBlock = editor.document[editor.document.length - 1]
        editor.insertBlocks(newBlocks, lastBlock, "after")
      }
    } finally {
      setCtaSending(false)
      setShowCTA(false)
    }
  }, [editor])

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

      {/* Formatting toolbar + CTA input */}
      <div className="sticky top-[37px] z-10 bg-white">
        <EditorToolbar editor={editor} onInsertCTA={() => setShowCTA(true)} />
        {showCTA && (
          <CTAInput
            onSubmit={handleCTASubmit}
            onClose={() => setShowCTA(false)}
            sending={ctaSending}
          />
        )}
      </div>

      {/* Editor content */}
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
