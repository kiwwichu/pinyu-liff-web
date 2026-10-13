# 正式 Apps Script 功能盤點

盤點日期：2026-08-19
來源：`0818/apps-script-live-20260819`
取得方式：使用 Google clasp 從目前正式 Apps Script 專案完整匯出

## 備份與安全狀態

- 已成功匯出 19 個檔案，包含 16 個 JavaScript／HTML 功能檔、`appsscript.json`，以及巢狀管理後台 API 檔案。
- 線上正式版本比 `0716/快樂小狗_AppsScript_分類整理版` 更新，後續盤點以本次匯出為準。
- 第一輪硬編碼憑證掃描未發現 token、密碼或 API key 直接寫在原始碼。
- LINE Channel Access Token 由 Apps Script 的 Script Properties 讀取；屬性值未被匯出。
- clasp 已於匯出後登出並刪除本機登入憑證。
- 原始碼尚未直接加入 GitHub；提交前仍需處理正式環境 ID、外部 URL、部署設定及其他設定值。

## 模組與搬遷方向

| 正式檔案 | 現有責任 | 新系統搬遷方向 | 狀態 |
|---|---|---|---|
| `01_LINE_Webhook.js` | LINE webhook、postback、綁定檢查、訂單確認、冷卻與訊息發送 | Cloudflare Worker webhook、LINE token 驗證、Supabase 訂單與綁定資料 | 待搬遷 |
| `02_會員綁定與查詢.js` | 會員綁定、餘額、近期訂單／儲值、家庭與 LINE 對象查詢 | 會員 API、LINE 綁定、錢包與歷史查詢 | 待搬遷 |
| `03_訂單查詢與歷史.js` | 訂單歷史、訂金、進行中訂單、狀態卡片、確認回覆 | 訂單歷史 API 已有測試版；仍需補齊訂金、狀態與確認流程 | 部分完成 |
| `04_訂單通知.js` | 建立、完成、待尾款等訂單通知與通知佇列 | Worker 端通知服務、佇列／重試／防重、LINE Messaging API | 待搬遷 |
| `05_到府明細同步.js` | 將訂單日期展開為服務明細、同步、重建、刪除與鎖定 | Supabase 訂單服務時段／visits 正規化資料與後台操作 | 待搬遷 |
| `06_儲值與扣款.js` | 儲值扣款、扣款與重複檢查 | Supabase 錢包交易、不可重複扣款與後台登記 | 待搬遷 |
| `07_WebApp與LIFF_API.js` | Apps Script Web App 路由、綁定與歷史 API | Cloudflare Worker API | 部分完成 |
| `08_日期與共用工具.js` | 日期轉換、客戶總額、訂金比例、折扣解析與總額更新 | 共用計價領域邏輯與伺服器端驗證 | 待搬遷 |
| `09_試算表觸發器與選單.js` | 試算表編輯事件與操作入口 | 管理後台表單、按鈕與伺服器端流程 | 待取代 |
| `10_通知狀態自動提醒.js` | 訂單通知狀態、顏色與編輯觸發 | 後台通知狀態、排程與明確錯誤狀態 | 待搬遷 |
| `11_到府明細快捷操作整合版.js` | 試算表選單、同步、重建、檢查與解鎖操作 | 管理後台服務明細工具與安全的重建／修復流程 | 待取代 |
| `12_ServiceReview.html` | 客戶服務評價 LIFF 畫面 | Cloudflare 靜態前端／LIFF | 待搬遷 |
| `13_服務評價.js` | LINE token 驗證、評價資料、訂單所有權與儲存 | Worker 評價 API、Supabase 權限與後台評價列表 | 待搬遷 |
| `14_apps-script/15_管理後台API.gs.js` | 管理通知佇列與觸發器 | 管理後台 API、通知工作佇列 | 待搬遷 |
| `15_家訪與服務前提醒自動化.js` | 家訪與服務前提醒、觸發器、紀錄、防重與測試工具 | Worker 排程、提醒紀錄、防重、重試與後台狀態 | 待搬遷 |
| `index.html` | 歷史訂單查詢畫面 | Cloudflare 測試版已可透過 LINE 查詢 Supabase | 部分完成 |
| `richmenu.js` | 建立、上傳、切換、查詢與重設 LINE rich menu | 保留為受控維運腳本，設定值改用安全環境變數 | 待整理 |
| `共用設定.js` | 試算表、欄位與共用設定 | 型別化伺服器設定、Supabase 資料模型及環境變數 | 待搬遷 |
| `appsscript.json` | Apps Script 執行環境與權限設定 | 僅作舊系統盤點與回復參考 | 已備份 |

## 已辨識入口與自動化

- Webhook／HTTP：`doPost`、`doGet`。
- 試算表事件：`onOpen`、`onEdit` 與共用 `handleEdit`。
- 排程：通知狀態、家訪提醒、服務前提醒、管理通知佇列。
- 人工維運工具：到府明細同步／重建、rich menu 建立／重設、提醒測試。

### 正式專案目前安裝的觸發器

| 函式 | 事件／頻率 | 目前用途 | 截圖所示錯誤率 |
|---|---|---|---|
| `runCareReminderAutomation` | 時間驅動，每天台北時間上午 10 點 | 檢查家訪與服務前提醒並防止重複發送 | 0% |
| `processAdminNotificationQueue` | 時間驅動，每 1 分鐘 | 處理管理後台通知佇列 | 0.04% |
| `handleEdit` | 綁定試算表，編輯文件時 | 處理需求單狀態、通知、扣款及相關試算表自動化 | 0% |

- Apps Script 專案時區為 `Asia/Taipei`，執行環境為 V8，例外紀錄使用 Stackdriver。
- `processAdminNotificationQueue` 雖然錯誤率很低，仍需在搬遷前查看錯誤類型；新系統需保留失敗狀態、重試次數與最後錯誤訊息。
- `handleEdit` 不是單一小功能，它是多個試算表業務動作的總入口；必須逐項拆成新後台的明確操作或後端事件。

## 搬遷時不可遺漏

- Script Properties 中的 `CHANNEL_ACCESS_TOKEN` 只做安全輪替與 Worker secret 設定，不寫入程式碼或 Git。
- Apps Script 的三個正式觸發器已完成盤點；搬遷後仍需核對新排程實際執行時間、失敗重試與通知結果。
- 試算表的選單、顏色、鎖定欄位與人工指令也是業務流程，不能只搬函式名稱；需在新後台提供對應操作與防呆。
- 原始碼中的正式 URL、LIFF ID、試算表／部署識別碼需分類成公開設定或秘密設定，分離測試與正式環境。
- 所有金額與日期規則需和實際試算表資料交叉測試，不能直接假設舊程式中的每段邏輯都仍符合目前需求。
