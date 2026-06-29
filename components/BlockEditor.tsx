"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import {
  useCreateBlockNote,
  useEditorChange,
  useEditorSelectionChange,
  createReactBlockSpec,
} from "@blocknote/react"
import { BlockNoteView } from "@blocknote/mantine"
import "@blocknote/mantine/style.css"
import { BlockNoteSchema, defaultStyleSpecs, defaultBlockSpecs, createStyleSpec } from "@blocknote/core"
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

// ─── Custom 按鈕 block（btn btn-primary，原樣輸出至發布 HTML）─────────────────
const DEFAULT_BTN_TEXT = "了解更多！"

const PPButtonBlock = createReactBlockSpec(
  {
    type: "ppButton",
    propSchema: {
      href: { default: "" },
      text: { default: DEFAULT_BTN_TEXT },
      uuid: { default: "" },
    },
    content: "none",
  },
  {
    render: ({ block }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const props = block.props as any
      return (
        <div style={{ width: "100%", textAlign: "center", padding: "8px 0" }} contentEditable={false}>
          <a
            href={props.href || undefined}
            onClick={(e) => e.preventDefault()}
            style={{
              display: "inline-block",
              color: "#FFF",
              fontSize: "18px",
              padding: "10px 20px",
              borderRadius: "7px",
              background: "rgb(239, 135, 0)",
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            {props.text || DEFAULT_BTN_TEXT}
          </a>
        </div>
      )
    },
  }
)()

const editorSchema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs, ppButton: PPButtonBlock },
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

// 判斷圖片 block 的 name 欄位是否存著連結（http(s) 或站內絕對路徑）
const isLinkHref = (v: string) => /^(https?:\/\/|\/)/.test(v.trim())

function EditorToolbar({
  editor,
  onInsertCTA,
  ctaSending,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any
  onInsertCTA: () => void
  ctaSending: boolean
}) {
  const [styles, setStyles] = useState<Record<string, boolean>>({})
  const [blockType, setBlockType] = useState<BlockType>("paragraph")
  const [headingLevel, setHeadingLevel] = useState(1)
  const [activeTextColor, setActiveTextColor] = useState<string>("")
  const [activeFontSize, setActiveFontSize] = useState<string>("")
  const [hasLink, setHasLink] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")
  const [linkText, setLinkText] = useState("")
  const [linkHasSelection, setLinkHasSelection] = useState(false)
  const [linkIsExisting, setLinkIsExisting] = useState(false)
  const [linkOnImage, setLinkOnImage] = useState(false)
  const [btnOpen, setBtnOpen] = useState(false)
  const [btnUrl, setBtnUrl] = useState("")
  const [btnText, setBtnText] = useState(DEFAULT_BTN_TEXT)
  const [btnIsEditing, setBtnIsEditing] = useState(false)
  const [btnSelected, setBtnSelected] = useState(false)
  const colorInputRef = useRef<HTMLInputElement>(null)
  const linkWrapRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linkImageBlockRef = useRef<any>(null)
  const btnWrapRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const btnEditBlockRef = useRef<any>(null)

  // 取得目前作用中的 block：先看節點選取（圖片／按鈕等 content:"none" 的 block），
  // 再退回文字游標。content:"none" 的 block 被點選時是節點選取，getTextCursorPosition 抓不到。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getActiveBlock = useCallback((): any => {
    try {
      const sel = editor.getSelection()
      if (sel?.blocks?.length === 1) return sel.blocks[0]
    } catch {}
    try {
      return editor.getTextCursorPosition()?.block ?? null
    } catch {}
    return null
  }, [editor])

  const syncState = useCallback(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const activeStyles = (editor.getActiveStyles() as any) ?? {}
      setStyles(activeStyles)
      setActiveTextColor(activeStyles.textColor ?? "")
      setActiveFontSize(activeStyles.fontSize ?? "")
      const block = getActiveBlock()
      setBtnSelected(block?.type === "ppButton")
      if (block) {
        setBlockType(block.type as BlockType)
        if (block.type === "image") {
          const nm = (block.props as { name?: string }).name ?? ""
          setHasLink(isLinkHref(nm))
        } else {
          setHasLink(!!editor.getSelectedLinkUrl())
        }
        if (block.type === "heading") {
          setHeadingLevel((block.props as { level: number }).level ?? 1)
        }
      } else {
        setHasLink(!!editor.getSelectedLinkUrl())
      }
    } catch {}
  }, [editor, getActiveBlock])

  useEditorChange(syncState, editor)
  useEditorSelectionChange(syncState, editor)

  // 點 popover 外面就關閉
  useEffect(() => {
    if (!linkOpen) return
    const onDown = (e: MouseEvent) => {
      if (linkWrapRef.current && !linkWrapRef.current.contains(e.target as Node)) {
        setLinkOpen(false)
      }
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [linkOpen])

  useEffect(() => {
    if (!btnOpen) return
    const onDown = (e: MouseEvent) => {
      if (btnWrapRef.current && !btnWrapRef.current.contains(e.target as Node)) {
        setBtnOpen(false)
      }
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [btnOpen])

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

  const openLink = () => {
    if (linkOpen) {
      setLinkOpen(false)
      return
    }
    // 圖片 block：把連結存進 image block 的 name 欄位
    const block = getActiveBlock()
    if (block?.type === "image") {
      const nm: string = block.props?.name ?? ""
      const hasUrl = isLinkHref(nm)
      linkImageBlockRef.current = block
      setLinkOnImage(true)
      setLinkHasSelection(true) // 圖片不需要「顯示文字」欄
      setLinkIsExisting(hasUrl)
      setLinkUrl(hasUrl ? nm : "")
      setLinkText("")
      setLinkOpen(true)
      return
    }

    let existing: string | undefined
    let selected = ""
    try {
      existing = editor.getSelectedLinkUrl()
      selected = editor.getSelectedText()
    } catch {}
    linkImageBlockRef.current = null
    setLinkOnImage(false)
    setLinkHasSelection(!!selected)
    setLinkIsExisting(!!existing)
    setLinkUrl(existing ?? "")
    setLinkText(selected || "")
    setLinkOpen(true)
  }

  const closeLink = () => {
    setLinkOpen(false)
    editor.focus()
  }

  const submitLink = () => {
    const url = linkUrl.trim()
    if (linkOnImage) {
      // 空字串等同移除圖片連結
      editor.updateBlock(linkImageBlockRef.current, { props: { name: url } })
      closeLink()
      return
    }
    if (!url) {
      // 清空網址 → 移除連結（用純文字覆蓋原選取）
      if (linkIsExisting) editor.createLink("", editor.getSelectedText())
      closeLink()
      return
    }
    if (linkHasSelection) {
      editor.createLink(url)
    } else {
      editor.createLink(url, linkText.trim() || url)
    }
    closeLink()
  }

  const removeLink = () => {
    if (linkOnImage) {
      editor.updateBlock(linkImageBlockRef.current, { props: { name: "" } })
      closeLink()
      return
    }
    editor.createLink("", editor.getSelectedText())
    closeLink()
  }

  const openLinkUrl = () => {
    const url = linkUrl.trim()
    if (url) window.open(url, "_blank", "noopener,noreferrer")
  }

  const onLinkKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      submitLink()
    } else if (e.key === "Escape") {
      e.preventDefault()
      closeLink()
    }
  }

  // ─── 插入按鈕（ppButton block）─────────────────────────────────────────────
  const genUuid = () => {
    try {
      return crypto.randomUUID().replace(/-/g, "").toUpperCase()
    } catch {
      let s = ""
      for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16)
      return s.toUpperCase()
    }
  }

  const openButton = () => {
    if (btnOpen) {
      setBtnOpen(false)
      return
    }
    const block = getActiveBlock()
    if (block?.type === "ppButton") {
      btnEditBlockRef.current = block
      setBtnIsEditing(true)
      setBtnUrl(block.props?.href ?? "")
      setBtnText(block.props?.text ?? DEFAULT_BTN_TEXT)
    } else {
      btnEditBlockRef.current = null
      setBtnIsEditing(false)
      setBtnUrl("")
      setBtnText(DEFAULT_BTN_TEXT)
    }
    setBtnOpen(true)
  }

  const closeButton = () => {
    setBtnOpen(false)
    editor.focus()
  }

  const submitButton = () => {
    const href = btnUrl.trim()
    const text = btnText.trim() || DEFAULT_BTN_TEXT
    if (!href) {
      closeButton()
      return
    }
    const editing = btnEditBlockRef.current
    if (editing) {
      editor.updateBlock(editing, { type: "ppButton", props: { href, text } })
    } else {
      const cur = editor.getTextCursorPosition().block
      editor.insertBlocks(
        [{ type: "ppButton", props: { href, text, uuid: genUuid() } }],
        cur,
        "after"
      )
    }
    closeButton()
  }

  const onButtonKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      submitButton()
    } else if (e.key === "Escape") {
      e.preventDefault()
      closeButton()
    }
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
      <div ref={linkWrapRef} className="relative flex-shrink-0">
        <TBtn active={hasLink || linkOpen} onClick={openLink} onMouseDown={prevent} label="插入／編輯連結">
          <LinkIcon />
        </TBtn>
        {linkOpen && (
          <div className="absolute top-full left-0 mt-1 z-30 w-64 p-2.5 bg-white rounded-lg border border-gray-200 shadow-lg flex flex-col gap-1.5">
            {!linkHasSelection && (
              <input
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                onKeyDown={onLinkKeyDown}
                placeholder="顯示文字"
                className="h-7 px-2 text-xs rounded border border-gray-200 outline-none focus:border-blue-400 text-gray-700"
              />
            )}
            <input
              autoFocus
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={onLinkKeyDown}
              placeholder="https://"
              className="h-7 px-2 text-xs rounded border border-gray-200 outline-none focus:border-blue-400 text-gray-700"
            />
            <div className="flex items-center justify-between gap-1.5 mt-0.5">
              {linkIsExisting ? (
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={openLinkUrl}
                    className="text-[11px] px-2 py-1 rounded text-blue-600 hover:bg-blue-50 cursor-pointer"
                  >
                    開啟
                  </button>
                  <button
                    type="button"
                    onClick={removeLink}
                    className="text-[11px] px-2 py-1 rounded text-red-500 hover:bg-red-50 cursor-pointer"
                  >
                    移除
                  </button>
                </div>
              ) : <span />}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={closeLink}
                  className="text-[11px] px-2 py-1 rounded text-gray-500 hover:bg-gray-100 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={submitLink}
                  className="text-[11px] px-2.5 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                >
                  套用
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

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
        label="插入 CTA"
        disabled={ctaSending}
      >
        {ctaSending ? <SpinnerIcon size={14} className="text-blue-500" /> : <CTAIcon />}
      </TBtn>

      <div ref={btnWrapRef} className="relative flex-shrink-0">
        <TBtn active={btnOpen || btnIsEditing || btnSelected} onClick={openButton} onMouseDown={prevent} label={btnSelected ? "編輯按鈕" : "插入按鈕"}>
          <ButtonIcon />
        </TBtn>
        {btnOpen && (
          <div className="absolute top-full left-0 mt-1 z-30 w-64 p-2.5 bg-white rounded-lg border border-gray-200 shadow-lg flex flex-col gap-1.5">
            <input
              autoFocus
              value={btnText}
              onChange={(e) => setBtnText(e.target.value)}
              onKeyDown={onButtonKeyDown}
              placeholder="按鈕文字"
              className="h-7 px-2 text-xs rounded border border-gray-200 outline-none focus:border-blue-400 text-gray-700"
            />
            <input
              type="url"
              value={btnUrl}
              onChange={(e) => setBtnUrl(e.target.value)}
              onKeyDown={onButtonKeyDown}
              placeholder="連結網址 https://"
              className="h-7 px-2 text-xs rounded border border-gray-200 outline-none focus:border-blue-400 text-gray-700"
            />
            <div className="flex items-center justify-end gap-1.5 mt-0.5">
              <button
                type="button"
                onClick={closeButton}
                className="text-[11px] px-2 py-1 rounded text-gray-500 hover:bg-gray-100 cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={submitButton}
                className="text-[11px] px-2.5 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
              >
                {btnIsEditing ? "更新" : "插入"}
              </button>
            </div>
          </div>
        )}
      </div>

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

function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.5 8.5a2.5 2.5 0 0 0 3.6.1l2-2a2.5 2.5 0 0 0-3.5-3.5l-1 1" />
      <path d="M8.5 5.5a2.5 2.5 0 0 0-3.6-.1l-2 2a2.5 2.5 0 0 0 3.5 3.5l1-1" />
    </svg>
  )
}

function ButtonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="4" width="11" height="6" rx="3" fill="currentColor" opacity="0.12" />
      <rect x="1.5" y="4" width="11" height="6" rx="3" />
      <line x1="4.5" y1="7" x2="9.5" y2="7" strokeWidth="1.6" />
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

// ─── 連結浮動工具列（文字連結／圖片／按鈕共用）─────────────────────────────────
type FloaterKind = "text" | "image" | "ppButton"
interface FloaterData {
  kind: FloaterKind
  blockId: string
  url: string
  text: string
  oldHref: string
  rect: { top: number; left: number; bottom: number }
}

function EditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2.5l2 2L5 11l-2.5.5L3 9z" />
    </svg>
  )
}
function OpenIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 2.5H2.5v9h9V9" />
      <path d="M8 2.5h3.5V6" />
      <path d="M11.5 2.5L6.5 7.5" />
    </svg>
  )
}
function UnlinkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.5 8.5a2.3 2.3 0 0 0 3.3.1l1.6-1.6a2.3 2.3 0 0 0-3.2-3.2l-.6.6" />
      <path d="M8.5 5.5a2.3 2.3 0 0 0-3.3-.1L3.6 7a2.3 2.3 0 0 0 3.2 3.2l.6-.6" />
      <line x1="2" y1="2" x2="12" y2="12" stroke="#ef4444" />
    </svg>
  )
}
function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 3.5h9" />
      <path d="M5.5 3.5V2.5h3v1" />
      <path d="M3.5 3.5l.5 8h6l.5-8" />
    </svg>
  )
}

function LinkFloater({ editor }: { editor: ReturnType<typeof useCreateBlockNote> }) {
  const [data, setData] = useState<FloaterData | null>(null)
  const [editing, setEditing] = useState(false)
  const [editUrl, setEditUrl] = useState("")
  const [editText, setEditText] = useState("")
  const floaterRef = useRef<HTMLDivElement>(null)
  const editingRef = useRef(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    editingRef.current = editing
  }, [editing])

  const cancelHide = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }, [])
  const close = useCallback(() => {
    cancelHide()
    setData(null)
    setEditing(false)
  }, [cancelHide])
  const scheduleHide = useCallback(() => {
    if (editingRef.current) return
    cancelHide()
    hideTimerRef.current = setTimeout(() => setData(null), 220)
  }, [cancelHide])

  const detectTarget = useCallback(
    (node: EventTarget | null): FloaterData | null => {
      const el = node as HTMLElement | null
      const editorEl = document.querySelector(".bn-editor")
      if (!editorEl || !el || !editorEl.contains(el)) return null
      const contentEl = el.closest?.(".bn-block-content") as HTMLElement | null
      const blockEl = el.closest?.(".bn-block[data-id]") as HTMLElement | null
      const blockId = blockEl?.getAttribute("data-id") ?? ""
      const contentType = contentEl?.getAttribute("data-content-type") ?? ""
      const rectOf = (e: HTMLElement) => {
        const r = e.getBoundingClientRect()
        return { top: r.top, left: r.left, bottom: r.bottom }
      }

      if (contentType === "image") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const block = editor.getBlock(blockId) as any
        const name: string = block?.props?.name ?? ""
        const imgEl = (contentEl?.querySelector("img") as HTMLElement | null) ?? contentEl
        if (!imgEl) return null
        return { kind: "image", blockId, url: name, text: "", oldHref: name, rect: rectOf(imgEl) }
      }
      if (contentType === "ppButton") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const block = editor.getBlock(blockId) as any
        const href: string = block?.props?.href ?? ""
        const text: string = block?.props?.text ?? ""
        const aEl = (contentEl?.querySelector("a") as HTMLElement | null) ?? contentEl
        if (!aEl) return null
        return { kind: "ppButton", blockId, url: href, text, oldHref: href, rect: rectOf(aEl) }
      }
      const a = el.closest?.("a") as HTMLElement | null
      if (a && editorEl.contains(a)) {
        const href = a.getAttribute("href") ?? ""
        return { kind: "text", blockId, url: href, text: a.textContent ?? "", oldHref: href, rect: rectOf(a) }
      }
      return null
    },
    [editor]
  )

  useEffect(() => {
    const editorEl = document.querySelector(".bn-editor")
    if (!editorEl) return
    const onOver = (e: Event) => {
      if (editingRef.current) return
      const t = detectTarget(e.target)
      if (t) {
        cancelHide()
        setData(t)
      } else {
        scheduleHide()
      }
    }
    const onClick = (e: Event) => {
      const t = detectTarget(e.target)
      if (t) {
        // 文字連結／按鈕：點擊不直接跳轉，改顯示浮動工具列
        if (t.kind !== "image") (e as MouseEvent).preventDefault()
        cancelHide()
        setData(t)
      }
    }
    const onScroll = () => {
      if (!editingRef.current) setData(null)
    }
    const onDocDown = (e: Event) => {
      if (
        editingRef.current &&
        floaterRef.current &&
        !floaterRef.current.contains(e.target as Node)
      ) {
        close()
      }
    }
    editorEl.addEventListener("mouseover", onOver)
    editorEl.addEventListener("click", onClick)
    window.addEventListener("scroll", onScroll, true)
    document.addEventListener("mousedown", onDocDown)
    return () => {
      editorEl.removeEventListener("mouseover", onOver)
      editorEl.removeEventListener("click", onClick)
      window.removeEventListener("scroll", onScroll, true)
      document.removeEventListener("mousedown", onDocDown)
    }
  }, [detectTarget, cancelHide, scheduleHide, close])

  // 文字連結：直接改 block 的 link inline content，不依賴 DOM 選取
  const updateTextLink = (blockId: string, oldHref: string, newHref: string | null) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const block = editor.getBlock(blockId) as any
    if (!block || !Array.isArray(block.content)) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out: any[] = []
    for (const item of block.content) {
      if (item.type === "link" && item.href === oldHref) {
        if (newHref === null) {
          for (const c of item.content) out.push(c)
        } else {
          out.push({ ...item, href: newHref })
        }
      } else {
        out.push(item)
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editor.updateBlock(blockId, { content: out } as any)
  }

  const doOpen = () => {
    if (data?.url) window.open(data.url, "_blank", "noopener,noreferrer")
  }
  const startEdit = () => {
    if (!data) return
    setEditUrl(data.url)
    setEditText(data.text)
    setEditing(true)
  }
  const doRemove = () => {
    if (!data) return
    if (data.kind === "text") updateTextLink(data.blockId, data.oldHref, null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    else if (data.kind === "image") editor.updateBlock(data.blockId, { props: { name: "" } } as any)
    else if (data.kind === "ppButton") editor.removeBlocks([data.blockId])
    close()
  }
  const doSubmit = () => {
    if (!data) return
    const url = editUrl.trim()
    if (data.kind === "text") {
      updateTextLink(data.blockId, data.oldHref, url || null)
    } else if (data.kind === "image") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editor.updateBlock(data.blockId, { props: { name: url } } as any)
    } else if (data.kind === "ppButton") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editor.updateBlock(data.blockId, { props: { href: url, text: editText.trim() || DEFAULT_BTN_TEXT } } as any)
    }
    close()
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      doSubmit()
    } else if (e.key === "Escape") {
      e.preventDefault()
      close()
    }
  }

  if (!data) return null
  const hasUrl = !!data.url.trim()
  const above = data.rect.top > 96
  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.max(8, data.rect.left),
    zIndex: 50,
    ...(above
      ? { top: data.rect.top - 8, transform: "translateY(-100%)" }
      : { top: data.rect.bottom + 8 }),
  }

  return (
    <div
      ref={floaterRef}
      style={style}
      onMouseEnter={cancelHide}
      onMouseLeave={scheduleHide}
      className="bg-white rounded-lg border border-gray-200 shadow-lg p-1"
    >
      {editing ? (
        <div className="flex flex-col gap-1.5 w-60 p-1.5">
          {data.kind === "ppButton" && (
            <input
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={onKey}
              placeholder="按鈕文字"
              className="h-7 px-2 text-xs rounded border border-gray-200 outline-none focus:border-blue-400 text-gray-700"
            />
          )}
          <input
            autoFocus
            type="url"
            value={editUrl}
            onChange={(e) => setEditUrl(e.target.value)}
            onKeyDown={onKey}
            placeholder="https://"
            className="h-7 px-2 text-xs rounded border border-gray-200 outline-none focus:border-blue-400 text-gray-700"
          />
          <div className="flex items-center justify-end gap-1.5">
            <button type="button" onClick={close} className="text-[11px] px-2 py-1 rounded text-gray-500 hover:bg-gray-100 cursor-pointer">
              取消
            </button>
            <button type="button" onClick={doSubmit} className="text-[11px] px-2.5 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 cursor-pointer">
              儲存
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={startEdit}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded text-gray-700 hover:bg-gray-100 cursor-pointer"
          >
            <EditIcon /> {hasUrl ? "編輯連結" : "新增連結"}
          </button>
          {hasUrl && (
            <button type="button" onClick={doOpen} title="開啟連結" className="flex items-center justify-center w-7 h-7 rounded text-gray-600 hover:bg-gray-100 cursor-pointer">
              <OpenIcon />
            </button>
          )}
          {(data.kind === "ppButton" || hasUrl) && (
            <button
              type="button"
              onClick={doRemove}
              title={data.kind === "ppButton" ? "刪除按鈕" : "移除連結"}
              className="flex items-center justify-center w-7 h-7 rounded text-red-500 hover:bg-red-50 cursor-pointer"
            >
              {data.kind === "ppButton" ? <TrashIcon /> : <UnlinkIcon />}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function BlockEditor({ article, onUpdate }: Props) {
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [ctaSending, setCtaSending] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitializedRef = useRef(false)

  const editor = useCreateBlockNote({ schema: editorSchema })
  // 預覽（唯讀）／編輯切換：唯讀時連結可單擊跳轉，預設維持編輯模式
  const [editable, setEditable] = useState(true)

  // BlockNote 的 tryParseHTMLToBlocks 對「連續的 <p>+<ul> 區塊」會整批漏掉清單
  // （單一清單正常，多組相鄰時 <li> 會消失）。改成逐個頂層節點分別 parse 再串接，
  // 讓每個清單都以「單一清單」的形式被解析，避免內容遺失。
  const parseHTMLToBlocksSafe = useCallback(
    (html: string): ReturnType<typeof editor.tryParseHTMLToBlocks> => {
      const doc = new DOMParser().parseFromString(html, "text/html")
      const nodes = Array.from(doc.body.children)
      if (nodes.length <= 1) return editor.tryParseHTMLToBlocks(html)
      const all = [] as unknown as ReturnType<typeof editor.tryParseHTMLToBlocks>
      for (const el of nodes) {
        all.push(...editor.tryParseHTMLToBlocks(el.outerHTML))
      }
      return all
    },
    [editor]
  )

  useEffect(() => {
    if (!editor || isInitializedRef.current) return

    const initEditor = async () => {
      if (!article.content) {
        // 空白文章：content 為 null，直接標記已初始化，讓 handleChange 可以存檔
        isInitializedRef.current = true
        return
      }

      const content = article.content as { type?: string; raw?: string } | unknown[]

      if (Array.isArray(content)) {
        editor.replaceBlocks(editor.document, content as Parameters<typeof editor.replaceBlocks>[1])
        isInitializedRef.current = true
      } else if (content && typeof content === "object" && "type" in content && content.type === "html") {
        const blocks = parseHTMLToBlocksSafe((content as { raw: string }).raw)
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

  const handleCTAInsert = useCallback(async () => {
    const url = seo?.promote_url?.trim() ?? ""
    const note = seo?.short_link_name?.trim() ?? ""
    if (!url || !note) {
      alert("Promote URL 與短連結名稱不能為空")
      return
    }
    if (!isValidUrl(url)) {
      alert("Promote URL 格式錯誤")
      return
    }
    const icsParams = new URLSearchParams({ note, redirect_url: url })
    window.open(
      `https://ics-admin.pressplay.cc/admin/pressplay/promote/ad_link/add?${icsParams}`,
      "_blank"
    )
    setCtaSending(true)
    try {
      const html: string = editor.blocksToHTMLLossy(editor.document)
      const td = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" })
      const markdown = td.turndown(html)

      const startRes = await fetch("/api/cta/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, content: markdown }),
      })
      const { jobId } = await startRes.json()

      const responseHtml = await new Promise<string | null>((resolve) => {
        const es = new EventSource(`/api/cta/stream/${jobId}`)
        es.onmessage = (e) => {
          const data = JSON.parse(e.data)
          if (data.status === "done") {
            es.close()
            resolve(data.result ?? null)
          } else if (data.status === "error") {
            es.close()
            resolve(null)
          }
        }
        es.onerror = () => {
          es.close()
          resolve(null)
        }
      })

      if (responseHtml) {
        const newBlocks = parseHTMLToBlocksSafe(responseHtml)
        const lastBlock = editor.document[editor.document.length - 1]
        if (newBlocks.length > 0 && lastBlock) {
          editor.insertBlocks(newBlocks, lastBlock, "after")
        }
      }
    } catch (err) {
      console.error("[CTA] error:", err)
    } finally {
      setCtaSending(false)
    }
  }, [editor, seo, parseHTMLToBlocksSafe])

  return (
    <div className="relative min-h-full flex flex-col">
      {/* Status bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-2 bg-white/95 backdrop-blur-sm border-b border-slate-100">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditable((v) => !v)}
            className="text-xs font-medium px-2 py-0.5 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer"
          >
            {editable ? "預覽" : "編輯"}
          </button>
          <span className="text-xs font-medium text-slate-400">{editable ? "編輯中" : "預覽中"}</span>
          <span className="text-slate-200">·</span>
          <span className="text-xs text-slate-600 font-medium">{article.keyword || "未命名文章"}</span>
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
          ctaSending={ctaSending}
        />
      </div>

      {/* Editor content */}
      <style>{`
        .bn-editor h2 { color: rgb(239, 135, 0); }
        .bn-editor h3 { color: rgb(21, 170, 191); }
        .bn-editor p { font-size: 18px; }
        .bn-editor a { color: rgb(37, 99, 235); text-decoration: underline; }
        .bn-editor a:hover { color: rgb(29, 78, 216); }
      `}</style>
      <div className="px-2 py-6 max-w-3xl mx-auto w-full">
        <BlockNoteView
          editor={editor}
          editable={editable}
          onChange={handleChange}
          theme="light"
          formattingToolbar={false}
          linkToolbar={false}
        />
        <LinkFloater editor={editor} />
      </div>
    </div>
  )
}
