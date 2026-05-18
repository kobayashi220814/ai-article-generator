@AGENTS.md

# 專案架構

兩套對稱環境，三個元件各自獨立：

| | 測試環境（本地） | 正式環境（家用伺服器） |
|---|---|---|
| 程式碼 | `localhost:3000`（Next.js dev） | `https://ai-article-generator.wade-lin.com`（Coolify） |
| DB | Docker pg `localhost:5432` | Coolify PostgreSQL |
| n8n | `localhost:5678` | `https://n8n.pressplay.cc` |
| n8n MCP | `mcp__n8n-local__*` | `mcp__n8n-mcp__*` |

## n8n 工作流 ID

兩套對稱維護，僅 webhook URL 與 callback URL 不同。

| 工作流 | 測試環境 | 正式環境 |
|---|---|---|
| 文章生成 | `GGSho0gvc4OLBDuQ`（`_testenv` 後綴，回傳假資料） | `3mousbZkBDVF8vgzkwh-W`（真實 AI 流程） |
| CTA | `mI3rstuz6eT395vZ`（`_testenv`，假資料） | `4rtQbOrawi1h3NaL`（真實 AI 流程） |

改一邊記得同步另一邊。改完 n8n 工作流後務必 `publish_workflow` — `activeVersionId` 更新後才會生效。

## 環境變數（依環境切換）

| 變數 | 測試（`.env.local`） | 正式（Coolify env） |
|---|---|---|
| `N8N_WEBHOOK_URL` | `http://localhost:5678/webhook/6bca01e7-...` | `https://n8n.pressplay.cc/webhook/6bca01e7-...` |
| `N8N_CTA_WEBHOOK_URL` | `http://localhost:5678/webhook/cta` | `https://n8n.pressplay.cc/webhook/cta` |
| `NEXT_PUBLIC_BASE_URL` | `http://host.docker.internal:3000`（給 n8n 容器打回來用，**不是 `localhost`**） | `https://ai-article-generator.wade-lin.com` |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/ai_article_generator` | Coolify 內部連線 |
| `USE_MOCK` | `false`（要打本地 n8n）；`true` 時走 [lib/generation.ts](lib/generation.ts) 內建假資料 | `false` |
| `CALLBACK_SECRET` | `dev-secret-change-in-production` | 同上 |

## 文章生成資料流

1. `POST /api/articles` → 建 article（status=pending）→ `triggerGeneration()`
2. `lib/generation.ts` → `callN8nWebhook()` POST 至 `N8N_WEBHOOK_URL`，帶 `{ keyword, article_id, callback_url }`，`callback_url` = `${NEXT_PUBLIC_BASE_URL}/api/callback/${article_id}`
3. n8n 工作流：
   - `Webhook1` → `Edit Fields`（解析 body）
   - `Edit Fields` 分兩支：
     - → `假資料/實際生成` → `Callback`（POST 回 `callback_url`，帶 `[{title, data}]`）
     - → `Bind Execution`（POST 至 `/api/n8n-bind`，綁定 `execution_id` 至 article，供錯誤反查）
   - `Error Trigger` → `Notify Error`（POST 至 `/api/n8n-error`，依 `execution_id` 標記 article 為 error）
4. 前端 `/api/articles/[id]/stream`（SSE）每 5 秒輪詢 status，30 分鐘逾時自動標 error

## 部署

- **GitHub repo**：`kobayashi220814/ai-article-generator`（public，部署所需 token 與其他憑證在 `~/.claude/credentials/wade-server.md`）
- **Coolify**：`https://coolify.wade-lin.com`，push 至 main 自動部署，應用 UUID `jn0mynxa545ecem8lo3yh5xt`，Build 約 3-4 分鐘
- **Cloudflare Tunnel**：`wade-server` 將 `ai-article-generator.wade-lin.com` → 家用伺服器 `192.168.0.115`
- 完整憑證見 `~/.claude/credentials/wade-server.md`

## 常見坑

- **本地 n8n 跑在 Docker 容器內，callback URL 不能用 `localhost`** → 從 n8n 容器看，`localhost` 是容器自己。要用 `host.docker.internal` 才會打到 host 上的 Next.js dev server。
  - 本地工作流的 `Bind Execution` / `Notify Error` URL：必須是 `http://host.docker.internal:3000/...`
  - `.env.local` 的 `NEXT_PUBLIC_BASE_URL`：必須是 `http://host.docker.internal:3000`（給 n8n 用，瀏覽器可直接 fallback）
  - 驗證指令：`docker exec n8n wget -qO- --timeout=3 http://host.docker.internal:3000/`
- **n8n 工作流改完沒生效** → 忘了 publish。`activeVersionId` 必須等於最新 `versionId` 才會 active。
- **SDK 改工作流時不要簡化「假資料」節點內容** → 影響測試體驗。原本是完整長文章 mock。
- **CTA URL 曾經寫死** → 已抽到 `process.env.N8N_CTA_WEBHOOK_URL`（fallback 為正式 URL）。新增正式環境部署時記得在 Coolify 設這個 env。
- **本地 n8n MCP 無 REST API key** → 改工作流只能透過 `mcp__n8n-local__*` 工具，不能直接 curl。
- **改 n8n 工作流 setting 透過 REST API 時** → 只能傳 `{"executionOrder": "v1"}`，`binaryMode` / `availableInMCP` 不被公開 API 接受。
- **BlockNote `article.content` 不一定是陣列** → server-side 轉 HTML 時要 `Array.isArray()` 先擋。BlockNote 的 table block content 是 object 不是 array，直接 iterate 會炸 `TypeError: ... is not iterable`，在 production minified 後 stack trace 變數全變 `t`/`e`，完全看不出哪行。對策：route handler 一律包 `try/catch` 把 `err.message` 回給 client，比 SSH 翻 container log 快。
