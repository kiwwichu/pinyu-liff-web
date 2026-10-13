# 快樂小狗 Pinyu｜Keyword Audit

盤點日期：2026-08-25
盤點範圍：Cloudflare Worker 路由、現有靜態頁、公開首頁、LIFF 頁面、SEO metadata、圖片／JS 內容、Notion 待辦。
注意：以下「現況」指本輪多頁 SEO 實作前的網站；「處理方向」是依 Audit 建立的測試版。

## 1. 現有路由清單與索引角色

| 路由 | 現況用途 | 應否索引 |
|---|---|---|
| `/` | 302 轉到 `/client-preview/` | 正式網域未來應是公開首頁；測試網域不索引 |
| `/client-preview/` | 品牌首頁＋服務＋價格＋評價＋流程＋預約表單 | 測試／功能整合頁，不索引 |
| `/security/` | 公開隱私與安全說明 | 可索引，但不搶服務關鍵字 |
| `/admin/` | OWNER 後台 | 不索引、需登入 |
| `/admin-login/` | 管理員登入 | 不索引 |
| `/design-admin/` | 網站版面管理 | 不索引、需登入 |
| `/sitter-preview/` | 保姆工作台 | 不索引、需登入 |
| `/booking.html` | 既有 LIFF 預約設定 | 不索引 |
| `/history.html` | 既有 LIFF 歷史訂單 | 不索引 |
| `/bound.html` | LINE 會員綁定 | 不索引 |
| `/calendar.html` | 可預約時間表 | 視未來公開版另拆；目前 LIFF 版不索引 |
| `/review.html` | 服務評價表單 | 不索引 |
| `/api/*` | Worker API | 不索引，不能出現在 Sitemap |

本輪前只有 `/client-preview/` 一個公開行銷內容頁，而且自己帶有 `noindex,nofollow`。因此搜尋引擎既不能索引，也無法用獨立 URL 分辨服務、價格、地區、評價和文章。

## 2. 每頁原始 Title／Description／H1

| 頁面 | Title | Description | H1 |
|---|---|---|---|
| `/client-preview/` | 快樂小狗 Pinyu｜到府寵物保姆・安心從詢問開始 | 有，品牌與服務流程描述 | 安心，從你找到我的那刻——就開始。 |
| `/security/` | Pinyu｜隱私與安全說明 | 有 | 我們照顧毛孩，也很重視您的隱私與資料安全 |
| `/admin/` | Pinyu｜Supabase 測試後台 | 缺 | 缺 |
| `/admin-login/` | 快樂小狗｜管理員登入 | 缺 | 快樂小狗 Pinyu |
| `/design-admin/` | Pinyu 網站版面管理 | 缺 | 網站版面設計 |
| `/sitter-preview/` | Pinyu｜保姆工作台測試版 | 缺 | 2 個 H1 |
| `/booking.html` | 快樂小狗 Pinyu｜預約設定 | 缺 | 缺 |
| `/history.html` | 歷史訂單查詢 | 缺 | 缺 |
| `/bound.html` | 會員綁定 | 缺 | 會員綁定 |
| `/calendar.html` | 可預約時間表 | 缺 | 缺 |
| `/review.html` | 快樂小狗｜服務評價 | 缺 | 您的回饋，是我們前進的動力！ |

私人頁缺 Description 或 H1 不會成為公開 SEO P0；正確做法是明確 `noindex`，不是替後台堆服務關鍵字。

## 3. Metadata 缺失與重複

- 公開首頁有 Title／Description／H1，但沒有 canonical、Open Graph、WebSite／Organization Schema。
- 沒有每個搜尋意圖的獨立頁，因此不是 metadata 重複，而是「根本只有一頁」。
- 私人與 LIFF 頁面沒有完整的 `X-Robots-Tag` 防索引規則。
- 沒有 `meta keywords`，這是正確的；不需要補。
- 正式品牌分享圖尚未提供，因此不應把住家、毛孩私人照片或尺寸不適合的自介照硬當 `og:image`。

## 4. 搜尋意圖互相競爭的位置

原本 `/client-preview/` 同時承接：

- 品牌名稱。
- 台北／到府寵物保姆。
- 到府照顧、遛狗、長時間陪伴、家訪。
- 價格、車馬費與多貓費用。
- 服務範圍。
- Pinyu 專業背景。
- 飼主評價。
- 第一次找保姆。
- 預約與距離評估。

現在還沒有多頁互搶關鍵字，但若直接複製首頁到多個頁面，就會形成 cannibalization。正確拆分是「首頁概覽、內頁完整回答」，而不是每頁重複首頁全文。

## 5. Crawler 不容易理解的資訊

- 11 張服務流程圖卡主要是圖片；雖然有 alt，但圖片內完整規則不是 HTML 文字。
- 公開評價透過 JavaScript 從 `/api/public-reviews` 讀取；Google 可執行 JavaScript，但速度與穩定性不如原始 HTML。頁面仍需有可直接抓取的評價政策、來源與服務說明。
- 預約步驟與即時距離提示是 JavaScript UI，屬轉換功能，不應成為唯一的服務範圍說明。
- 可預約時間與私人訂單在 LIFF／登入後顯示，正確做法是保持私人；公開 SEO 頁只說明規則。
- 品牌的重要文字、價格與主要服務已經是 HTML，這部分可沿用。

## 6. Sitemap／robots／canonical 原始現況

- `/sitemap.xml`：不存在。
- `/robots.txt`：不存在。
- canonical：所有頁面都沒有。
- `/client-preview/`：有 `noindex,nofollow`，測試環境方向正確。
- `/`：302 到測試首頁，不是正式 canonical 首頁。
- www／non-www：尚未建立正式規則。
- HTTPS：Cloudflare 測試站已使用 HTTPS；正式網域尚未切換。
- Search Console：依 Notion 規劃，正式網域上線後才驗證與提交 Sitemap，優先度 P2。

## 7. Keyword Map 摘要

完整表見 [seo-keyword-map.md](./seo-keyword-map.md)。核心分工：

| 搜尋意圖 | 主要頁面 |
|---|---|
| 品牌＋台北到府寵物保姆＋核心信任 | `/` |
| 到府照顧、遛狗、長時間陪伴、家訪 | `/services/` |
| 價格、車馬費、家訪費、多貓 | `/pricing/` |
| 中正區／中正紀念堂／距離與轉介 | `/service-area/` |
| Pinyu、300+ 趟、200 小時、CPR、照護理念 | `/about/` |
| 已授權公開評價與來源 | `/reviews/` |
| 真實服務案例 | `/cases/`，素材完成前 noindex |
| 第一次找保姆與旅館／到府比較 | `/articles/...` |
| 家訪、鑰匙、餵藥、回報與承接限制 | `/faq/` |
| 送出承接評估 | `/booking/`，轉換頁先 noindex |

不先做「大安區、萬華區、中山區……」大量頁面。只有確實可服務、有案例與獨立交通資訊時才新增。

## 8. 建議新增／拆分／合併

### 新增

- `/services/`、`/pricing/`、`/service-area/`、`/about/`、`/reviews/`、`/articles/`、`/faq/`、`/booking/`。
- 第一批兩篇文章：第一次找保姆、寵物旅館 vs 到府保姆。
- 自動 Sitemap、環境感知 robots、canonical、Open Graph、內部連結。

### 暫時建立但不索引

- `/cases/`：需要真實照片、服務情境與公開授權。
- `/booking/`：目前只是帶到既有測試表單的轉換入口。

### 暫不拆分

- 到府照顧、遛狗、長時間陪伴先放在同一 `/services/`；內容累積到足以獨立回答搜尋問題後再拆。
- Reviews 與 Cases 先分路由，但 Cases 不公開索引；如果未來案例量不足，可再合併。

## 9. 優先級

### P0 立即

- 測試站保持 noindex。
- 公開行銷頁與後台／LIFF／API 分流。
- 正式網域根路徑、trailing slash、www → non-www 規則。
- 私人路徑加 `X-Robots-Tag`。
- 每個公開頁唯一 Title／Description／Canonical／H1。
- robots.txt 與自動 Sitemap。

### P1 上線前

- 多頁公開網站與內部連結。
- 服務、價格、範圍、關於、評價、FAQ 與第一批知識文章。
- WebSite、Organization、Person、Service、Article、Breadcrumb 基礎 Schema。
- 結構化資料、404、手機、圖片尺寸與 LIFF 回歸測試。
- 補正式 `og:image`。

### P2 正式網域上線後

- Search Console 網域驗證與 Sitemap 提交。
- 觀察真實 Queries／Pages／Indexing 後再決定下一批文章。
- GA4、CTA 事件與轉換漏斗。
- 取得授權後補真實案例與區域內容。

## Notion 需求來源

- [Pinyu 網站待辦＆學習清單](https://app.notion.com/p/98583740096e4299bad65abbf4ba8ee9?pvs=204)
- [網站改成多頁式架構](https://app.notion.com/p/3c6ce4142c9381d18c58d32331fcb7fa?pvs=204)
- [每頁 SEO Title／Description／Canonical](https://app.notion.com/p/3c6ce4142c9381f0ba18e75a947f82f9?pvs=204)
- [建立 robots.txt 與搜尋爬蟲規則](https://app.notion.com/p/3c6ce4142c9381c88594c118ed66d4de?pvs=204)
- [建立自動 Sitemap.xml](https://app.notion.com/p/3c6ce4142c93815b8d23f197353641e2?pvs=204)
- [建立知識文章系統](https://app.notion.com/p/3c6ce4142c9381feafb5f22c931946e3?pvs=204)
- [設定 Google Search Console](https://app.notion.com/p/3c6ce4142c93810799d0f0c1263a15e4?pvs=204)
