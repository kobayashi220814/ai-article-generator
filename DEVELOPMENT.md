# 開發流程指南

## 架構概覽

```
本機電腦（開發）
  ├── 程式碼（Next.js 專案）
  ├── Docker PostgreSQL（本機測試用資料庫）
  └── .env.local（USE_MOCK=true，本機不需要 n8n）
        │
        │  git push
        ▼
GitHub（kobayashi220814/ai-article-generator）
        │
        │  自動部署（Zeabur 監聽 main branch）
        ▼
Zeabur（正式環境）
  ├── ai-article-generator（Next.js 應用）
  ├── PostgreSQL（正式資料庫，與本機分開）
  └── 環境變數指向正式 n8n webhook
        │
        │  webhook / callback
        ▼
n8n（n8n.pressplay.cc）
  └── 負責 AI 文章生成邏輯
```

---

## 新增或調整功能的步驟

### 1. 建立新分支

```bash
git checkout -b feature/功能名稱
```

例如：`git checkout -b feature/add-export-button`

### 2. 啟動本機開發環境

```bash
# 確認 Docker 資料庫有在跑
docker ps

# 啟動開發伺服器
npm run dev
```

在瀏覽器 http://localhost:3000 測試。

> `.env.local` 中 `USE_MOCK=true`，不會打到真實 n8n，文章生成約 3 秒完成。

### 3. 提交改動

```bash
git add .
git commit -m "feat: 簡短描述你做了什麼"
```

### 4. 推到 GitHub 並建立 Pull Request

```bash
git push -u origin feature/功能名稱
```

到 GitHub 開 Pull Request，將分支合併到 `main`。

### 5. 合併後自動上線

Merge PR 後，Zeabur 自動偵測 `main` 有新 commit，觸發重新部署。

到 https://ai-article-generator.zeabur.app 確認上線結果。

> 如果需要測試完整 n8n 流程（非 Mock），直接在正式網站測試即可。目前工具只有自己使用，小問題可以立刻 fix 再推。

---

## 簡單記法

```
改 code → 開分支 → 本機測試 → commit → push → 開 PR → merge → 自動上線
```

---

## 重要提醒

- **本機資料庫和 Zeabur 資料庫是分開的**，互不影響
- **本機用 `USE_MOCK=true`** 測試，不會觸發真實 n8n
- **不要直接在 `main` 上開發**，用分支可以避免還沒測好就上線
- 如果改了 `prisma/schema.prisma`，部署到 Zeabur 時會自動執行 `prisma db push`（`npm run start` 內建）

---

## Commit 訊息格式

| 前綴 | 用途 |
|------|------|
| `feat:` | 新功能 |
| `fix:` | 修 bug |
| `chore:` | 設定、套件更新等雜務 |
| `refactor:` | 重構，不影響功能 |
