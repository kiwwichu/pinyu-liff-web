# 官網公開評價資料模型提案（尚未執行 migration）

本文件只記錄稽核結果與建議，2026-08-25 這輪沒有修改 Supabase 評價資料表。

## 現況

`service_reviews` 已有：評分、各項細分評分、文字回饋、`allow_anonymous_publication`、`public_name`、訂單／家庭關聯與時間。現有資料足以安全做第一版官網評價卡片，但尚缺：故事標題、公開毛孩照片、來源、來源連結、公開標籤與更明確的公開身分欄位。

第一版 API 因此採以下保守規則：

1. 只讀取 `allow_anonymous_publication = true` 且有文字回饋的資料。
2. 顯示名稱順序：`public_name` → 訂單毛孩名＋家長 → 家庭毛孩名＋家長 → 毛孩家長。
3. 即使 `public_name` 已同意公開，若內容看起來像電話、網址、Email 或 LINE ID，仍會拒絕輸出。
4. 不輸出 LINE UID、真名、電話、Email、地址、家庭編號、訂單編號或內部備註。
5. 尚無照片授權欄位時，一律顯示 Pinyu 品牌占位圖，不拿私人照片猜測使用。

## 建議第二版欄位

| 欄位 | 建議型別 | 維護方式 |
|---|---|---|
| `review_title` | `text` | 後台可編輯；未填時由系統依已勾選項目產生中性標題 |
| `owner_public_display_name` | `text` | 飼主在評價表單明確填寫／勾選，取代語意不清的 `public_name` |
| `owner_relation` | `text` | 選單，例如家長、媽媽、爸爸；不得自由填聯絡資料 |
| `pet_photo_public_path` | `text` | 後台挑選已取得公開授權、已去除 EXIF 的公開版圖片 |
| `review_source` | `text` + check | 僅允許 `pinyu_service`、`maoxiaoai`、`private_message` |
| `source_url` | `text` | 只有公開外部評價才填；伺服器再做 HTTPS 與網域白名單檢查 |
| `public_tags` | `text[]` | 後台從固定標籤選單挑 1–2 個，避免任意文字變成敏感資料 |
| `publication_consented_at` | `timestamptz` | 記錄公開同意時間 |
| `publication_revoked_at` | `timestamptz` | 飼主撤回時立即停止官網輸出，但保留稽核紀錄 |
| `publication_scope` | `text` + check | 例如官網、社群、兩者，避免一次同意被無限延伸使用 |

## 照片與來源安全

- 不直接把家庭檔案或私密 Storage 原圖公開。
- 建議另存一份「公開衍生圖」：隨機 UUID 檔名、移除 EXIF、裁掉門牌／鑰匙／環境線索、轉成 WebP。
- 官網 API 仍只輸出通過公開同意與後台審核的路徑。
- `source_url` 應由 Worker 驗證協定與允許網域，前端不可自行拼接。
- 撤回同意後，API 不再輸出該評價，並清除 CDN 快取與公開衍生圖。

## 建議的後台維護流程

1. 評價進入後台，預設不公開。
2. 飼主勾選公開範圍並決定顯示名稱。
3. OWNER 檢查文字與照片是否含可識別個資。
4. 選標題、1–2 個標籤、來源與可選來源連結。
5. 預覽桌機／手機卡片後才發布。
6. 每次修改或撤回都記錄時間與操作人。
