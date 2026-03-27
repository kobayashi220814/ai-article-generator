import { prisma } from "@/lib/prisma"

export function triggerGeneration(articleId: string, keyword: string) {
  if (process.env.USE_MOCK === "true") {
    runMockGeneration(articleId, keyword)
  } else {
    callN8nWebhook(articleId, keyword)
  }
}

async function runMockGeneration(articleId: string, keyword: string) {
  const delaySeconds = parseInt(process.env.MOCK_DELAY_SECONDS ?? "10", 10)
  await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000))

  if (keyword === "__error__") {
    await prisma.article.update({
      where: { id: articleId },
      data: { status: "error", errorMsg: "Mock error triggered" },
    })
    return
  }

  const titles = [
    `${keyword}：完整指南與實用技巧`,
    `深入了解${keyword}：從入門到精通`,
    `${keyword}全攻略：專家建議與最佳實踐`,
  ]

  const htmlContent = `
<h2>${keyword}：完整介紹</h2>
<p>${keyword}是一個重要的主題，值得我們深入探討。在本文中，我們將全面介紹${keyword}的各個面向，幫助您更好地理解和應用相關知識。</p>

<h2>為什麼${keyword}很重要？</h2>
<p>在現代社會中，${keyword}扮演著越來越重要的角色。無論是個人生活還是職業發展，掌握${keyword}的相關知識都能帶來顯著的優勢。</p>
<ul>
<li>提升效率與生產力</li>
<li>增強競爭優勢</li>
<li>創造更多價值</li>
</ul>

<h2>${keyword}的核心概念</h2>
<p>要深入理解${keyword}，首先需要掌握幾個核心概念。這些概念構成了${keyword}的基礎框架，也是進一步學習的起點。</p>

<h2>如何開始學習${keyword}？</h2>
<p>學習${keyword}的最佳方式是循序漸進。建議從基礎知識開始，逐步深入，並結合實際案例進行練習。</p>
<ol>
<li>建立基礎知識體系</li>
<li>尋找優質學習資源</li>
<li>實際操作與練習</li>
<li>與社群交流分享</li>
</ol>

<h2>結語</h2>
<p>${keyword}是一個值得長期投資的領域。希望本文能為您提供有價值的參考，幫助您在${keyword}的學習之路上取得成功。</p>
`

  // Store raw HTML; client will convert to BlockNote blocks on first load
  await prisma.article.update({
    where: { id: articleId },
    data: {
      status: "done",
      titles,
      content: { type: "html", raw: htmlContent } as object,
    },
  })
}

async function callN8nWebhook(articleId: string, keyword: string) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL
  if (!webhookUrl) {
    await prisma.article.update({
      where: { id: articleId },
      data: { status: "error", errorMsg: "N8N_WEBHOOK_URL not configured" },
    })
    return
  }

  const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/callback/${articleId}`

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword, article_id: articleId, callback_url: callbackUrl }),
    })
  } catch (err) {
    await prisma.article.update({
      where: { id: articleId },
      data: { status: "error", errorMsg: `Failed to call n8n: ${err}` },
    })
  }
}
