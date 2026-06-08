// 用法：node scripts/publish.mjs <html-file-path> [--local]
// html-file-path：包含文章 HTML 的暫存檔
// --local：發布到本機 localhost:3000（預設發布到正式環境）

import { readFileSync } from "fs"
import { resolve } from "path"

const PROD_URL = "https://ai-article-generator.wade-lin.com"
const LOCAL_URL = "http://localhost:3000"

const args = process.argv.slice(2)
const isLocal = args.includes("--local")
const htmlFilePath = args.find((a) => !a.startsWith("--"))
const BASE_URL = process.env.ARTICLE_BASE_URL ?? (isLocal ? LOCAL_URL : PROD_URL)

if (!htmlFilePath) {
  console.error("用法：node scripts/publish.mjs <html-file-path> [--local]")
  process.exit(1)
}

console.log(`🌐 目標環境：${BASE_URL}`)

const rawHtml = readFileSync(resolve(htmlFilePath), "utf-8")

// 提取所有 <h1> 作為標題選項，並從 HTML 中移除
const h1Regex = /<h1[^>]*>([\s\S]*?)<\/h1>/gi
const titles = []
let match
while ((match = h1Regex.exec(rawHtml)) !== null) {
  titles.push(match[1].replace(/<[^>]+>/g, "").trim())
}
const html = rawHtml.replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, "").trim()

if (titles.length > 0) {
  console.log(`📝 提取到 ${titles.length} 個標題選項`)
}

// 建立空白文章
const createRes = await fetch(`${BASE_URL}/api/articles`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ source: "manual" }),
})

if (!createRes.ok) {
  console.error("建立文章失敗：", await createRes.text())
  process.exit(1)
}

const { id } = await createRes.json()

// 填入 HTML 內容與標題選項
const patchBody = { content: { type: "html", raw: html } }
if (titles.length > 0) patchBody.titles = titles

const patchRes = await fetch(`${BASE_URL}/api/articles/${id}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(patchBody),
})

if (!patchRes.ok) {
  console.error("填入內容失敗：", await patchRes.text())
  process.exit(1)
}

console.log(`✅ 文章已建立`)
console.log(`   ID：${id}`)
console.log(`   URL：${BASE_URL}/?article=${id}`)
