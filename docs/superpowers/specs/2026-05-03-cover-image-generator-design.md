# Cover Image Generator — Design Spec
Date: 2026-05-03

## Overview

讀取文章 `selected_title`，透過 AI 萃取英文搜尋詞後呼叫 Unsplash API 取得最多 10 張圖片候選，在 Modal 中讓使用者選圖、拖曳定位、編輯文字後，以 HTML Canvas 合成封面圖並下載 JPG（1280×720）。

---

## Template Spec

- **尺寸**：1280 × 720px（16:9）
- **底圖**：Unsplash 圖片，user 可拖曳調整構圖
- **遮罩**：`rgba(0, 0, 0, 0.6)` 全幅疊加
- **文字**：靠左下，padding 60px
  - 第一行（第一個 `\n` 之前）：`#FF6A13`（橘色），Noto Sans TC Bold
  - 第二行起：`#FFFFFF`（白色），Noto Sans TC Bold
  - 字體大小：約 64px（對應 Canva 72.8pt，在 web canvas 實測後微調）
- **文字內容**：由使用者在 Modal 內 textarea 自訂，支援手動換行，預設填入 `selected_title`

---

## 系統架構

### 新增 API Routes

#### `POST /api/articles/[id]/cover-search`

1. 從 DB 讀取文章的 `keyword` 與 `seo.selected_title`
2. 呼叫 `gpt-4o-mini`，要求回傳 2~3 個適合在 Unsplash 搜尋的英文關鍵詞（JSON array）
3. 依序用第一個關鍵詞打 Unsplash API：`GET /search/photos?query=...&per_page=10&orientation=landscape`
   - 若結果 ≥ 3 張，直接回傳
   - 若結果 < 3 張，自動改用第二個關鍵詞重試一次
   - 兩次都 < 3 張，回傳現有結果（前端顯示 AI 生成按鈕）
4. 回傳圖片列表：`[{ id, thumb_url, full_url, description }]`

**Request：** `{}`（無需 body，從 article id 取資料）

**Response：**
```json
{
  "search_terms": ["bank credit tightening", "money finance"],
  "images": [
    { "id": "abc", "thumb_url": "...", "full_url": "...", "alt": "..." }
  ]
}
```

#### `GET /api/image-proxy?url=<encoded_url>`

- 後端 fetch Unsplash 圖片並 pipe 回前端，解決 canvas CORS 限制
- 加上 `Cache-Control: public, max-age=86400` 避免重複請求

#### `POST /api/articles/[id]/cover-generate`

- 呼叫 DALL-E 3 生成一張適合當封面底圖的圖片
- Prompt 根據 `keyword` + `selected_title` 自動產生（英文、寫實攝影風格、無文字）
- 回傳：`{ "image_url": "..." }`（DALL-E 3 的臨時 URL，前端立即使用，不需儲存）

---

## UI 設計

### 觸發入口

- 位置：SEO 面板底部，一個「產生封面」按鈕（緊接在 Slug 欄位之後）
- 條件：`selected_title` 為空時 disabled，hover 顯示提示「請先填寫文章標題」

### Modal 版型：上大預覽 + 下橫向縮圖列

```
┌─────────────────────────────────────────────┐
│  產生封面                               [✕]  │
├─────────────────────────────────────────────┤
│                                             │
│          [ Canvas 預覽 16:9 ]               │
│          （可拖曳底圖調整構圖）               │
│                                             │
├─────────────────────────────────────────────┤
│  文字編輯：                                  │
│  ┌─────────────────────────────────────┐    │
│  │ 抽銀根是什麼？                        │    │
│  │ 弄懂銀行收傘手法與4大前兆             │    │
│  └─────────────────────────────────────┘    │
├─────────────────────────────────────────────┤
│  搜尋詞：bank credit tightening  [重新搜尋]  │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ... [AI生成] │
│  └──┘ └──┘ └──┘ └──┘ └──┘              │
├─────────────────────────────────────────────┤
│                         [ 下載 JPG ]        │
└─────────────────────────────────────────────┘
```

### 縮圖列行為

- 橫向捲動，每張縮圖 16:9 比例
- 選中的縮圖有藍色邊框高亮
- Unsplash 結果 < 3 張時，縮圖列末尾出現「讓 AI 生成」按鈕
- Unsplash 結果 0 張時，只顯示「讓 AI 生成」按鈕

### 文字編輯 textarea

- 預設填入 `selected_title`
- 使用者手動按 Enter 換行
- 每次 `input` 事件觸發 canvas 重繪
- **第一行**（第一個 `\n` 前）→ 橘色 `#FF6A13`
- **第二行起** → 白色 `#FFFFFF`

---

## Canvas 渲染

### 流程

1. Modal 開啟時預載 Noto Sans TC Bold（`FontFace` API）
2. 使用者點選縮圖：
   - 圖片經 `/api/image-proxy` 取得（避免 CORS）
   - `new Image()` 載入後開始渲染
3. 渲染順序：
   1. `drawImage(img, offsetX, offsetY, scaledW, scaledH)`（依拖曳 offset）
   2. `fillRect` 繪製 `rgba(0,0,0,0.6)` 全幅遮罩
   3. 解析 textarea 文字，依 `\n` 分行
   4. 第一行用橘色，其後用白色，逐行繪製（底部對齊，左 padding 60px）

### 拖曳定位

- 圖片縮放至至少覆蓋 1280×720（`object-fit: cover` 邏輯）
- `mousedown` → 記錄起點，`mousemove` → 更新 offsetX/Y 並重繪，`mouseup` → 結束
- 限制 offset 範圍：圖片邊緣不得露出畫布

### 下載

```js
canvas.toBlob(
  (blob) => saveAs(blob, 'cover.jpg'),
  'image/jpeg',
  0.92
)
```

---

## 錯誤處理

| 情況 | 處理 |
|---|---|
| Unsplash 結果 < 3 張 | 縮圖列末尾顯示「讓 AI 生成」按鈕 |
| Unsplash 結果 0 張 | 只顯示「讓 AI 生成」按鈕 |
| DALL-E 3 生成失敗 | toast 錯誤訊息，按鈕恢復可點擊 |
| 字體未載入 | 等 `FontFace.load()` resolve 後才繪製 |
| `selected_title` 為空 | 「產生封面」按鈕 disabled |
| 圖片 proxy 失敗 | 該縮圖顯示錯誤佔位，不影響其他縮圖 |

---

## 環境變數

```env
UNSPLASH_ACCESS_KEY="..."   # Unsplash Client-ID
OPENAI_API_KEY="..."        # DALL-E 3 & gpt-4o-mini
```

---

## 不在範圍內

- 封面圖儲存至 DB（本期只下載，不持久化）
- 多種封面模板切換
- 行動裝置支援
