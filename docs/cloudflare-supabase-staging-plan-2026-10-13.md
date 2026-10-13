# Cloudflare＋Supabase 測試版上線計畫

日期：2026-10-13
範圍：只處理測試環境；不修改正式 Google Sheet、正式 Apps Script、正式 LINE 通知或正式 DNS 流量。

## 結論

測試版應以現有 `城市/pinyu-liff-web-git` 為主線，沿用已存在的 Cloudflare Worker `pinyu-liff-web-dev` 與 Supabase Dev 架構，不再把 B-v0.14 內的 Vercel `/api/*.js` 直接搬到 Cloudflare Pages。

B-v0.14 的 `admin-preview` 適合作為畫面與互動規格來源；真正的 API、驗證、資料庫與安全隔離應由目前的 TypeScript Worker 與 Supabase migrations 負責。

## 2026-10-13 實際盤點

### 已具備

- Cloudflare Worker 設定已存在：`wrangler.jsonc`，Worker 名稱為 `pinyu-liff-web-dev`。
- Worker 同時提供靜態資源與 `/api/*`，不需要另建 Pages 專案。
- 線上 `https://pinyu-liff-web-dev.pinyu-liff-web.workers.dev/health` 回傳 HTTP 200。
- 已有 Supabase migrations、RLS、安全索引、Cloudflare Worker server-side Supabase client。
- 瀏覽器端不持有 Supabase secret；secret 由 Worker binding 提供。
- `APP_ENV=development`，LINE 真實發送路由目前明確停用；測試通知採 dry-run。
- 本機 `typecheck`、排班測試、訂單計算測試、帳務 19 項測試及 Cloudflare dry-run 均通過。

### 目前阻塞

- Supabase 專案 `pet-sitter-dev`（Singapore）狀態為 `INACTIVE`。
- Worker 的純 liveness 正常，但實際資料 API `/api/site-settings` 回傳 HTTP 500，與資料庫不可用一致。
- `migration/supabase-cloudflare` 工作樹有大量未提交檔案；GitHub `origin/main` 尚未包含目前完整 Worker、migrations 與新版後台，不能直接開啟自動部署。
- B-v0.14 Apps Script 複本尚未完成真正的 `TEST_MODE`。目前程式仍可依 Script Property 指向任意 Sheet，通知佇列也仍會寫入「發送」指令，因此不得接正式 Sheet 後公開。
- `pinyupets.com` 公開 DNS 目前只查到 SOA，`admin-test.pinyupets.com` 尚未可用。

## 建議目標架構

```text
admin-test.pinyupets.com
        |
        v
Cloudflare Worker: pinyu-liff-web-dev
  - 靜態前端（新版管理後台）
  - /api/*（驗證、訂單、排班、財務）
  - APP_ENV=development
  - LINE 發送關閉／dry-run
        |
        v
Supabase: pet-sitter-dev
  - staging schema/data only
  - migrations 管理
  - RLS 全開
  - Worker secret only

正式 Google Sheet / Apps Script / LINE
  - 保持不變
  - 不接受測試版寫入
```

## 分階段執行

### Phase 0｜整理可部署來源

1. 保留現有 dirty worktree，不覆蓋既有成果。
2. 盤點未提交檔案，移除不應進 Git 的輸出與大型展示壓縮檔。
3. 將 `migration/supabase-cloudflare` 整理成可審查的 staging commit。
4. 再次執行：
   - `npm run typecheck`
   - `npm run test:schedule`
   - `npm run test:orders`
   - `npm run test:ledger`
   - `npm run cf:check`

通過條件：Git diff 可審查、沒有 secret／客戶資料、所有檢查成功。

### Phase 1｜恢復 Supabase Dev

1. 先確認 `pet-sitter-dev` 是否仍為預定的測試專案，並確認恢復後的計費影響。
2. 經使用者同意後恢復該專案；不另建 production 專案。
3. 核對 migrations、資料表與 Edge Functions 狀態。
4. 執行 Supabase security/performance advisors。
5. 用少量合成資料驗證 Worker API；若保留舊匯入資料，只做唯讀比對。

通過條件：`/api/site-settings`、後台啟動資料、排班及 DEMO 訂單 API 正常，RLS／advisors 無高風險問題。

### Phase 2｜先用 workers.dev 驗收

1. 將整理後的 staging 版本部署到既有 `pinyu-liff-web-dev`。
2. Cloudflare secrets 只設定測試用：`SUPABASE_SECRET_KEY`、必要的 LINE 測試憑證。
3. 保持 `APP_ENV=development`。
4. 禁止真實 LINE 發送、Google Calendar 正式寫入及 Apps Script 正式寫入。
5. 以手機與桌面驗收登入、訂單、排班、金額及權限。

通過條件：測試資料具有 `DEMO-`／`demo=true` 標記，沒有任何正式外部副作用。

### Phase 3｜接上測試子網域

1. 將 `pinyupets.com` 網域加入正確的 Cloudflare account／zone。
2. 在 Worker 的 Custom Domains 加入 `admin-test.pinyupets.com`，先不要變更正式站網址。
3. 初期以 Cloudflare Access 限定管理者 email，避免測試後台公開。
4. 更新測試 LIFF／Google OAuth 允許的 callback 或 endpoint，只指向測試子網域。
5. 完成 TLS、登入、手機 LINE WebView 與一般瀏覽器測試。

通過條件：只有允許的測試人員能進站；`workers.dev` 與自訂網域行為一致。

### Phase 4｜整合 B-v0.14 介面

1. 以 B-v0.14 `admin-preview` 為 UI 規格，不直接帶入它的 localStorage 假資料層。
2. 將已確認的畫面與互動逐項移植到 `admin/`，沿用既有 `/api/admin` 契約。
3. 每次只整合一組功能：首頁／訂單 → 待處理 → 排班 → 明細與編輯。
4. 對每組功能補 smoke test，再發布 preview。

通過條件：新版 UI 與 Supabase Dev 真實測試資料一致，既有權限與安全邊界未退化。

## Supabase 環境決策

目前不建議立刻建立第二個 Supabase 專案：已有 `pet-sitter-dev`、migrations 與 Worker 綁定，先恢復並審查它最省風險與重工。

未來正式上線時再建立獨立 production project：

- Dev／staging 與 production 使用不同 project ref、URL、secret、Auth、Storage 與資料。
- schema 只透過 `supabase/migrations` 推進。
- staging 只放合成資料或去識別資料。
- 不從正式專案複製客戶資料到 preview branch。
- 切正式前先做唯讀比對，再做受控雙寫；不做一次性無回復切換。

## 不可跨越的安全線

- 不把 `SUPABASE_SECRET_KEY`、LINE token、客戶 Excel／CSV、LINE UID、地址或醫療資料提交到 Git。
- 不把 B-v0.14 Apps Script 測試專案指向正式 Sheet。
- 不在 staging 啟用真實 LINE 發送。
- 不把 `migration/supabase-cloudflare` 直接合併到 `main` 後自動部署。
- 不將舊 Google Sheet／Apps Script 關閉，直到 Supabase 對帳與回復演練完成。

## 下一個可執行里程碑

`S1：恢復可用的 Cloudflare＋Supabase Dev 測試站`

完成定義：

- Supabase Dev 已恢復且 advisors 檢查完成。
- Worker API 不再回 500。
- staging 分支內容已整理、測試與審查。
- 測試站可由 `workers.dev` 使用，LINE／Google Calendar／正式 Sheet 皆沒有副作用。
- 之後才設定 `admin-test.pinyupets.com`。

## 執行進度（2026-10-13）

- [x] Supabase Dev 已恢復為 `ACTIVE_HEALTHY`。
- [x] Security／performance advisors 已執行。
- [x] Worker `/api/site-settings` 已由 500 恢復為 200。
- [x] 本機 typecheck、核心測試、Cloudflare dry-run 已通過。
- [x] Migration history 已對齊：local／remote 各 22 筆。
- [x] staging dirty worktree 已整理成單一可審查的本機基準 commit。
- [ ] `admin-test.pinyupets.com` 尚未設定。

完整稽核結果見 `docs/s1-cloudflare-supabase-audit-2026-10-13.md`。
