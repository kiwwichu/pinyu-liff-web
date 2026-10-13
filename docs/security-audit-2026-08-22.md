# Pinyu 第一輪隱私與安全稽核

日期：2026-08-22
範圍：Cloudflare Worker、公開前端建置、Supabase `public` schema／Storage、套件弱點與部署設定。
結論：未發現已知的前端高權限密鑰外洩或匿名直讀業務資料情形；本輪已修正數項防禦缺口。這是時間點與範圍有限的工程檢查，不是資安認證，也不代表百分之百安全。

## 已驗證的保護

- Supabase 官方安全文件顯示平台符合 SOC 2 Type 2、取得 ISO 27001 認證，並說明靜態資料使用 AES-256、傳輸使用 TLS；這是供應商平台層級的控制，不等於 Pinyu 自動取得相同認證。
- `public` 業務資料表全部啟用 RLS。
- `anon`、`authenticated` 沒有業務資料表或公開函式的直接權限。
- 公開 view 使用 `security_invoker`，沒有匿名或一般登入角色權限。
- 高權限 Supabase secret 僅由 Worker secret binding 讀取；原始碼與 `dist` 建置成品未掃到 service key、JWT 或私鑰樣式內容。
- Storage 目前沒有 bucket，因此沒有公開合約／身分文件；正式啟用 Storage 前仍必須先建立私有政策。
- 正式與開發套件稽核皆為 0 個已知 npm 弱點（稽核當下）。
- 管理 API 會先驗證 LINE access token，再核對內部角色；瀏覽器跨站請求會被拒絕。

## 本輪已修正

1. PostgreSQL 未來新資料表、序列與函式改為預設不授權 `PUBLIC`、`anon`、`authenticated`。
2. `/health` 不再匿名觸發 service-role 資料庫查詢，也不再公開依賴服務與環境細節。
3. 後端資料庫錯誤只寫入內部結構化紀錄，前端收到通用錯誤，不取得資料表名稱、查詢提示或內部代碼。
4. 客戶歷史訂單不再查詢或回傳內部訂單備註。
5. 靜態頁與 JSON API 加入 CSP、禁止 iframe、`nosniff`、Referrer Policy、Permissions Policy 與必要的 `no-store`。
6. 新增公開安全說明頁，使用者可理解目前保護方式、限制與回報管道。

## 顧問檢查結果

- Supabase Security Advisor 只有 `INFO: RLS enabled, no policy`。本系統目前刻意採「瀏覽器不直連資料表、沒有 policy 即預設拒絕，由 Worker service role 經應用層授權」架構，因此這些 INFO 是預期結果，不是把 RLS 關掉或補一條過寬 policy 的理由。
- Performance Advisor 回報多個 unused index。資料剛遷入且使用量低，現在刪除會太早；累積正式查詢統計後再判斷。

## 尚未完成／殘餘風險

| 優先 | 項目 | 目前處理方式 |
| --- | --- | --- |
| 高 | 正式 Cloudflare Rate Limiting／WAF 尚未設定 | 自訂網域與環境拆分後，對登入、管理 API、webhook 與表單分開限速 |
| 高 | 保姆逐單授權尚未完成 | 保姆端正式開放前建立 sitter-scoped API；不得共用 OWNER 批次資料 API |
| 高 | 合約與身分文件尚未建立 Storage 政策 | 首次上傳前建私有 bucket、短效網址、逐角色政策及下載稽核 |
| 中 | OWNER 尚無 MFA／敏感操作再次驗證 | 加入短效 session 或 step-up auth，並建立遺失裝置撤銷流程 |
| 中 | 舊 `admin-login` Apps Script 登入頁仍存在 | 確認無使用者後移除，減少額外入口與設定漂移 |
| 中 | 備份還原、保存期限、刪除與事件應變尚未文件化 | 正式上線前完成流程與至少一次還原演練 |
| 中 | 管理啟動資料範圍較廣 | 地址／電話已單筆延後讀取；後續再縮小訂單與家庭批次載入範圍 |
| 低 | 舊 LIFF 頁仍含 inline script/style | 已用 CSP 限制來源；逐頁重構後移除 `unsafe-inline` |

## 上線前安全閘門

- 不將 `SUPABASE_SECRET_KEY`、LINE secret/token、簽名私鑰放入 Git、HTML、JavaScript 或 Cloudflare `vars`。
- 每次 migration 後重新檢查 RLS、GRANT、函式 `search_path`、view `security_invoker` 及 Security Advisor。
- 每次部署後重新掃描 `dist`，並實際測試安全標頭、跨站 API 阻擋、角色拒絕與敏感錯誤訊息。
- 正式網域、正式 LINE LIFF 與正式資料切換前，完成角色權限測試矩陣及回復舊系統演練。
- 對外文字只能說明採取的保護與持續改善，不使用「絕對安全」「零風險」或「百分之百不外洩」。
