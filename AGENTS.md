# Pinyu 城市開發協作規則

本專案提供三個 custom sub-agent：`frontend`、`backend`、`database`。大型或跨層工作才使用 sub-agent；單一小改動由主 agent 直接完成即可。

## 派工方式

- `frontend`：靜態 HTML/CSS/JavaScript、管理後台與預覽站、RWD、無障礙、SEO 呈現、瀏覽器端 API 串接。
- `backend`：TypeScript Cloudflare Worker、API、驗證授權、預約/訂單/保姆/排程/財務服務、LINE 與其他伺服器端整合。
- `database`：Supabase/PostgreSQL schema、migration、RLS、RPC、索引、資料完整性、效能與 database types。

不要為了形式同時啟動三個 agent。只有任務能拆成互不修改同一檔案的獨立工作流時才平行處理；否則依下列順序交接：

1. 資料模型改變：`database` 先定義 schema、RLS 與 RPC 契約。
2. API/商業流程改變：`backend` 依資料契約實作 request/response 與驗證。
3. 畫面與互動改變：`frontend` 最後依穩定 API 契約串接與驗證。

主 agent 負責整合、處理衝突與最終驗證。sub-agent 不得再把核心責任轉派出去，也不要越界修改其他角色擁有的檔案；需要跨層修改時，先回報父 agent。

## 專案共同限制

- 不猜測 Pinyu 的價格、佣金、付款、預約、排班、服務次數、訂單狀態或其他商業規則。
- 保護客戶個資、地址、聯絡方式、寵物醫療資料、LINE UID、API keys 與 Supabase secrets。
- 預設只修改本機 workspace。未經使用者當次明確授權，不 deploy、不 push、不執行 Production migration 或遠端破壞性操作。
- 保留使用者現有的 dirty worktree，不覆蓋或回復與目前任務無關的變更。
- 使用 `apply_patch` 編輯檔案；搜尋優先使用 `rg`。
- 完成前執行與改動範圍相稱的 build、typecheck、tests 或 SQL 驗證，並列出未能執行的檢查。
