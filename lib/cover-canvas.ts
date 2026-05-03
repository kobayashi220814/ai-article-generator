// lib/cover-canvas.ts

export const CANVAS_W = 1280
export const CANVAS_H = 720
const FONT_SIZE = 94
const LINE_HEIGHT = 100
const PADDING_LEFT = 40
const PADDING_BOTTOM = 60
const OVERLAY_COLOR = "rgba(0, 0, 0, 0.6)"
const COLOR_LINE1 = "#ff914d"
const COLOR_REST = "#FFFFFF"

export async function loadCoverFont(): Promise<void> {
  await document.fonts.load('700 64px "Noto Sans TC"')
}

export interface CoverImage {
  element: HTMLImageElement
  scaledW: number
  scaledH: number
  minOffsetX: number
  maxOffsetX: number
  minOffsetY: number
  maxOffsetY: number
}

export function prepareCoverImage(img: HTMLImageElement): CoverImage {
  const scale = Math.max(CANVAS_W / img.naturalWidth, CANVAS_H / img.naturalHeight)
  const scaledW = img.naturalWidth * scale
  const scaledH = img.naturalHeight * scale
  return {
    element: img,
    scaledW,
    scaledH,
    minOffsetX: CANVAS_W - scaledW,
    maxOffsetX: 0,
    minOffsetY: CANVAS_H - scaledH,
    maxOffsetY: 0,
  }
}

export function clampOffset(
  coverImage: CoverImage,
  offsetX: number,
  offsetY: number
): { x: number; y: number } {
  return {
    x: Math.min(coverImage.maxOffsetX, Math.max(coverImage.minOffsetX, offsetX)),
    y: Math.min(coverImage.maxOffsetY, Math.max(coverImage.minOffsetY, offsetY)),
  }
}

export function defaultOffset(coverImage: CoverImage): { x: number; y: number } {
  return {
    x: (CANVAS_W - coverImage.scaledW) / 2,
    y: (CANVAS_H - coverImage.scaledH) / 2,
  }
}

export function renderCover(
  canvas: HTMLCanvasElement,
  coverImage: CoverImage,
  offsetX: number,
  offsetY: number,
  text: string
): void {
  const ctx = canvas.getContext("2d")
  if (!ctx) return

  canvas.width = CANVAS_W
  canvas.height = CANVAS_H

  // 1. 底圖
  ctx.drawImage(coverImage.element, offsetX, offsetY, coverImage.scaledW, coverImage.scaledH)

  // 2. 遮罩
  ctx.fillStyle = OVERLAY_COLOR
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // 3. 文字
  const lines = text.split("\n").filter((l) => l.length > 0)
  if (lines.length === 0) return

  ctx.font = `bold ${FONT_SIZE}px 'Noto Sans TC', sans-serif`
  ctx.textBaseline = "alphabetic"

  const totalTextHeight = lines.length * LINE_HEIGHT
  const startY = CANVAS_H - PADDING_BOTTOM - totalTextHeight + LINE_HEIGHT

  lines.forEach((line, i) => {
    ctx.fillStyle = i === 0 ? COLOR_LINE1 : COLOR_REST
    ctx.fillText(line, PADDING_LEFT, startY + i * LINE_HEIGHT)
  })
}
