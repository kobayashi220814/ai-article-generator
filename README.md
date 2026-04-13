# AI Article Generator

以關鍵字為輸入，透過 n8n 工作流自動產生 SEO 文章的 Next.js 應用程式。

## 功能

- 輸入關鍵字，觸發 n8n webhook 進行 AI 文章生成
- 以 SSE（Server-Sent Events）即時回傳生成進度
- 使用 BlockNote 富文字編輯器顯示與編輯產出文章
- SEO 面板：提供多個標題候選與 SEO 建議
- 文章列表管理（側邊欄）
- Mock 模式：無需 n8n 也能本地測試

## 技術棧

- **框架**：Next.js 16 (App Router)
- **資料庫**：PostgreSQL + Prisma ORM
- **編輯器**：BlockNote
- **UI**：Tailwind CSS + Mantine
- **自動化**：n8n webhook

## 環境變數

建立 `.env` 檔案並填入以下變數：

```env
# PostgreSQL 連線字串
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ai_article_generator

# n8n webhook URL（生產環境必填）
N8N_WEBHOOK_URL=https://your-n8n-instance/webhook/xxx

# 應用程式對外 URL（供 n8n callback 使用）
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Mock 模式（設為 true 可跳過 n8n，直接本地模擬生成）
USE_MOCK=false

# Mock 延遲秒數（USE_MOCK=true 時有效，預設 10）
MOCK_DELAY_SECONDS=10
```

## 開發環境啟動

### 1. 啟動資料庫

```bash
docker-compose up -d
```

### 2. 安裝依賴

```bash
npm install
```

### 3. 初始化資料庫

```bash
npx prisma db push
```

### 4. 啟動開發伺服器

```bash
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000) 即可使用。

## 生產環境部署

```bash
npm run build
npm run start
```

`npm run start` 會自動執行 `prisma db push` 後再啟動伺服器。

## n8n 整合說明

應用程式會向 `N8N_WEBHOOK_URL` 發送 POST 請求，payload 格式如下：

```json
{
  "keyword": "關鍵字",
  "article_id": "uuid",
  "callback_url": "https://your-app/api/callback/{article_id}"
}
```

n8n 完成生成後，需呼叫 `callback_url`，回傳文章內容（HTML 格式）與 SEO 資料。

## 資料結構

```
Article
├── id          UUID
├── keyword     關鍵字
├── status      pending | done | error
├── content     文章內容（BlockNote JSON 或 HTML）
├── titles      標題候選陣列
├── seo         SEO 資料
└── errorMsg    錯誤訊息
```
