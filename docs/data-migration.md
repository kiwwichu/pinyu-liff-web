# Google Sheets → Supabase 資料搬遷紀錄

資料快照：`0818/正式_寵物保姆資料庫.xlsx`（2026-08-18）

## 已匯入筆數

| Supabase 資料表 | 筆數 |
| --- | ---: |
| families | 38 |
| pets | 52 |
| line_bindings | 20 |
| service_plans | 29 |
| orders | 102 |
| visits | 60 |
| service_reviews | 4 |
| app_users | 2 |
| reminder_logs | 8 |
| wallet_transactions | 8 |
| postal_codes | 10 |
| app_settings | 1 |

以下試算表是衍生資料，不重複匯入：

- `消費紀錄  查詢表` → `wallet_activity` view
- `儲值總表` → `wallet_balances` view
- `匯出用` → `orders_export` view
- `COOLDOWN` 是暫時限流狀態，搬遷時重置

## 舊資料相容處理

- 舊需求單公式產生了 12 組重複編號，共影響 25 筆資料。`orders.order_id` 保存唯一內部編號，`legacy_order_id` 保存舊編號。
- 16 筆需求單的 Excel 公式沒有輸出編號，匯入時依來源列建立固定的 `MIGRATED-ROW-*` 編號，沒有捨棄資料。
- 2 筆到府明細無法安全判定所屬舊需求單、2 筆缺少服務日期；均完整保留並標示為未解析關聯。
- 3 筆評價無法安全判定所屬舊需求單；舊編號仍保存在 `legacy_order_id`。
- 5 筆提醒紀錄使用舊欄位排列；保留紀錄，但不偽造不存在的時間或關聯。

## 本機重新檢查

Excel 檔案和所有產生的暫存資料都被 `.gitignore` 排除，不得提交到 GitHub。

```powershell
npm ci
npm run migration:dry-run -- --file "..\0818\正式_寵物保姆資料庫.xlsx"
```

預期結果為 `錯誤：0`。警告是上方已記錄的舊資料問題，不應在未人工確認的情況下自動猜測或覆寫。

## 安全設計

- 公開和登入角色都沒有直接資料表權限。
- 所有公開 schema 資料表已啟用 RLS。
- Cloudflare Worker 未來使用 Supabase server secret；瀏覽器不會取得 secret。
- 正式匯入採私有暫存分片與單一 transaction；入庫完成後暫存資料已清空，本機含個資的暫存 SQL 也已刪除。
