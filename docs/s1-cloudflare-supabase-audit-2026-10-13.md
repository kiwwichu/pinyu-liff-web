# S1 Cloudflare＋Supabase Dev 稽核紀錄

日期：2026-10-13
專案：Cloudflare Worker `pinyu-liff-web-dev`／Supabase `pet-sitter-dev`

## 執行結果

- Supabase 已由 `INACTIVE` 成功恢復為 `ACTIVE_HEALTHY`。
- Cloudflare Worker `/health`：HTTP 200。
- Cloudflare Worker `/api/site-settings`：恢復前 HTTP 500，恢復後 HTTP 200。
- 管理後台靜態頁 `/admin/`：HTTP 200。
- 公開排班 API `/api/avail?year=2026&month=10`：HTTP 200。
- 未帶動作的管理 API `/api/admin`：HTTP 405，沒有誤開放 GET。
- 靜態輸出未搜尋到 `SUPABASE_SECRET_KEY`、Supabase secret key、LINE channel secret 或 access token。

## 資料庫概況

只讀計數，不讀出客戶內容：

| 物件 | 筆數 |
| --- | ---: |
| families | 38 |
| pets | 52 |
| line_bindings | 20 |
| service_plans | 29 |
| orders | 104 |
| DEMO orders | 2 |
| app_users | 2 |
| sitters | 2 |
| service_reviews | 4 |
| order_items | 0 |
| booking_requests | 0 |

## 安全稽核

- public tables：34 張。
- RLS disabled：0 張。
- `anon`／`authenticated` table grants：0。
- Views：`orders_export`、`wallet_activity`、`wallet_balances` 全部為 `security_invoker=true`。
- public `SECURITY DEFINER`：只有 `rls_auto_enable()`，且 `PUBLIC`、`anon`、`authenticated` 都沒有 execute 權限。
- Supabase Security Advisor：沒有 WARN／ERROR；只有 34 筆 `rls_enabled_no_policy` INFO。

`rls_enabled_no_policy` 在目前設計中是預期結果：資料表不提供瀏覽器角色直接查詢，只有 Cloudflare Worker 的 server-side secret 可存取。未來若改成 browser-direct Supabase，必須先重新設計逐表 policy，不能直接開 grants。

## 效能稽核

- 7 個 foreign key 缺少 covering index，Advisor 等級為 INFO。
- 56 個 unused index，Advisor 等級為 INFO。

Dev 專案剛恢復且流量很低，`unused index` 目前不能作為刪除依據。7 個 foreign key index 可在 migration history 整理完成後，以一個獨立 migration 補上，再重新跑 advisors。

## Migration history 對齊

初查時，遠端 migration history 與本機 `supabase/migrations` 的邏輯名稱相符，但 timestamp 不一致；本機另有 `add_sitter_commission_history`，遠端 history 沒有這筆，然而對應資料表、索引與函式均已存在。

已完成：

1. 依遠端既有 history 對齊 20 個本機 migration 檔的 timestamp；未修改 SQL 內容。
2. 核對 `sitters`、`sitter_commission_rates`、4 個索引及 2 個函式均存在。
3. 只補上 `20260822030049_add_sitter_commission_history` tracking 紀錄；沒有重跑 DDL 或改業務資料。
4. 再次比較後 local／remote 均為 22 筆，`local_only=[]`、`remote_only=[]`。

仍應在未來具備本機 Supabase CLI／Docker 環境時執行一次全新 `db reset`，驗證 migrations 能從零重建。

## 本機驗證

- `npm run typecheck`：通過。
- `npm run test:schedule`：通過，10 項排班核心測試及後台 smoke test 成功。
- `npm run test:orders`：通過。
- `npm run test:ledger`：通過，19 項。
- `npm run cf:check`：通過，Cloudflare Worker dry-run 成功。
- `git diff --check`：通過；只有既有 LF／CRLF 提示。

補充：Wrangler 4.125.0 在 Windows 中文專案路徑下會於開始打包時靜默退出（exit 1）。將相同工作目錄暫時映射為 ASCII 磁碟代號後，dry-run 成功讀取 207 個靜態檔；Worker upload 2451.23 KiB，gzip 497.32 KiB。這是本機工具的路徑相容性問題，過程沒有上傳或部署。

## S1 狀態

Supabase 與 Worker 已恢復可用，安全邊界正常。S1 已完成：

1. 已整理大量未提交的 staging 工作樹，建立單一可審查的本機基準 commit；尚未推送或連接自動部署。
