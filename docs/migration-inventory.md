# Google Sheets to Supabase migration inventory

Source snapshot: `正式_寵物保姆資料庫.xlsx`, exported on 2026-08-18.

The workbook remains outside this repository because it contains customer data.

## Source-of-truth tables

| Google Sheet | Supabase object | Notes |
| --- | --- | --- |
| 家庭主檔 | `families` | One row per customer family. |
| 毛孩主檔 | `pets` | Linked to `families`. |
| LINE綁定表 | `line_bindings` | LINE user to family binding. |
| 方案表 | `service_plans` | Service catalog and prices. |
| 需求單 | `orders` | Historical money values are imported as snapshots. |
| 到府明細 | `visits` | One order can produce multiple visits. |
| 服務評價 | `service_reviews` | Linked to order and family. |
| 使用者權限 | `app_users` | Staff/admin access metadata. |
| 系統提醒紀錄 | `reminder_logs` | Idempotency and reminder audit trail. |
| 儲值流水、扣款自動表 | `wallet_transactions` | Unified immutable ledger. |
| 郵遞區號 | `postal_codes` | Lookup data. |
| 系統設定 | `app_settings` | Small server-side settings store. |
| COOLDOWN | `rate_limits` | Temporary LINE command cooldown state. |

## Derived sheets that will not be imported as independent data

| Google Sheet | Replacement |
| --- | --- |
| 儲值總表 | `wallet_balances` view |
| 消費紀錄  查詢表 | `wallet_activity` view |
| 匯出用 | `orders_export` view |
| 使用說明 | Project documentation |

## Safety rules

- The production workbook, CSV exports, LINE IDs, addresses, and tokens never enter Git.
- Historical order totals are imported exactly as stored; the migration does not recalculate money.
- Browser code never receives the Supabase secret key or LINE secrets.
- RLS is enabled on every operational table. No `anon` or `authenticated` policies are created initially.
- Only the Cloudflare Worker may use the server-side Supabase secret.
- Google Sheets, Apps Script, and Vercel stay live until reconciliation and parallel testing pass.
