# Step 3.13B｜保母實付 ledger 草稿與驗收方案

狀態：REVIEW DRAFT，未 apply。2026-09-12，CURRENT 的 ChatGPT schema-preflight checkpoint 明確授權草稿與既有 schema 的工作；不代表 Pinyu 選 A 或授權新 migration。

## 指定草稿與適用範圍

- `supabase/migrations/20260912045136_draft_sitter_payment_ledger.sql`，檔名已對齊遠端 migration history。
- 第一段 transaction 有無條件 `DRAFT_ONLY` exception，任何誤跑會在 DDL 前中止。未核准不得移除此 guard；不可跑 migration push/reset/repair。此檔存在 migrations 目錄也不代表已獲准執行。
- 候選 target 僅 `pet-sitter-dev` / `zzkdmenxlucgxirwxayb`。不查 Production，不 backfill，不改已有 migration 或 financial ledger。
- 草稿建立一張獨立 append-only 表、四個 FK 索引、一個不可修改 trigger、一個 service-role append RPC。沒有前端持久化串接、讀取 RPC、付款批次、反沖／追回／重指派結算。
- 本輪沒有執行 SQL parser／Postgres／RPC 驗證。文字靜態檢查不是 SQL 可執行或交易驗收證明。

## Evidence 與不改動的規則

- CURRENT：<https://www.notion.so/3d6ce4142c9381ccb128f6c93bc367f5>；Roadmap：<https://www.notion.so/3cace4142c9381dba619cca1856bb9f2>。
- `20260830080519_add_orders_v2_core_and_order_items.sql`：item UUID、order text FK、assigned sitter bigint、service date、provider／commission／earnings／allocation snapshots、item updated_at。
- `20260901103813_add_save_order_v2_rpc.sql`：先鎖 order、CAS、不可刪既有 item；改派仍可能改變該 item 的當前報酬。
- `20260909183359_add_order_financial_ledgers.sql`：客戶／平台 ledger 已有獨立 events。
- Roadmap 的合作保母報酬需求：item 級、多次付款、差異原因、不可覆寫原應付；Owner/Admin 管理，Sitter 只看自己的必要明細；主要入口為「財務 → 保母結算／合作報酬」。
- ⚠️ 沿用確認：折扣只折服務；合作保母一般 80% 只含折前服務費；其他費用沿用獨立分配；小費歸執行者。草稿只取現有 earnings，不再套百分比；owner execution 不列入合作保母實付。若不是這樣請告知，我們會改回。
- 採 Supabase 官方 functions / RLS 文件的 invoker、明確 ACL，以及 FK 索引原則：<https://supabase.com/docs/guides/database/functions>、<https://supabase.com/docs/guides/database/postgres/row-level-security>。

## 精確資料契約（供 review，不是已核准新營運規則）

| 欄位 | 來源／用途 |
| --- | --- |
| request_id | 呼叫端產生 UUID，單一實付事件永久 key |
| order_id / order_item_id | RPC 驗證 item 屬於 V2 order；FK restrict |
| sitter_id_snapshot | 鎖定後從 item 取得，不能信任 client 指定收款保母 |
| order_updated_at_snapshot / item_updated_at_snapshot | 付款當下來源版本，保留微秒；不是新的報酬制度編號 |
| remuneration_snapshot | 明確白名單：類型、服務日、保母、價格／數量、commission base/rate、保母所得、公司分配／折扣吸收、home visit mode、calculation version |
| due_amount_snapshot | 原 item.sitter_earnings_amount，不以實付覆寫 |
| amount / paid_at / method | 正數 TWD 四位小數、實際付款時間含時區、方式文字（不放銀行帳號） |
| difference_reason | 累積實付與當前應付不同時必填；分次付款可記「分次付款」。不是金額調整授權 |
| recorded_by / recorded_at | 驗證後 server actor、DB 時間；不允許 client 偽造操作者 |

RPC：`append_sitter_payment_v2(p_entry jsonb, p_actor_id uuid, p_expected_order_updated_at timestamptz, p_expected_item_updated_at timestamptz)`。

`p_entry` 使用 requestId/orderId/orderItemId/amount/paidAt/method/differenceReason。正數實付紀錄不表示自動核准付款、改寫應付或把訂單設成完成；沒有轉帳 API。負數、0、超精度、非有限數拒絕；已付錯誤的更正／追回不在本草稿內。

原子流程：驗證 server actor OWNER/ADMIN + active + can_view_money + can_edit_orders → key advisory lock → order lock → 相同 key 比對原業務 payload＋actor → 新事件才做雙 CAS → item 與 sitter 關聯／報酬快照 → 差異原因 → insert。重試同 key 不重拍快照、不因 CAS 過期拒絕已成功事件；同 key 不同金額／來源／時間／方式／原因／actor 拒絕。

若已付後 item 改派、改價或改服務日，既有付款仍歸原 sitter snapshot；新的 append 暫時 fail closed，需結算 review。**這是草稿的保守邊界，非決定誰應退款、何時追回或如何重分配**。不修改既有改期／改派 API，不把例外藏成正常未付。

RLS 開啟、anon/authenticated 無表或 RPC 權限；service_role 只有 select/insert，UPDATE/DELETE/TRUNCATE 不授權；trigger 拒絕 update/delete。沿用既有可信後端 invoker 模式，service role 不是可交给瀏覽器的金鑰。直接 service-role insert 是可信系統邊界，應用只能走經驗證的 RPC；不能宣稱 DB 阻止特權操作者繞過 RPC。

未提供 Sitter read API；未來 projection 必須由 server 驗證 sitter 身分，以原收款 sitter snapshot 限縮、刪除 company share 與他人資料。不能直接把 remuneration_snapshot 回傳給 Sitter。換 sitter 後歷史付款來源可見範圍也不可因「目前 assigned」無條件擴大。

## 摘要與語意邊界

- 應付：当前 item 的既有報酬；實付：獨立 payment events；差額：應付減實付。不要把差額直接當催收／退款權利。
- 若 source 已不同，顯示 source mismatch／需核對，不把舊 sitter payment 算到新 sitter 名下，也不把新舊快照混成一個「已結清」。
- 沒有付款記錄只代表「尚無記錄」，不證明現實未付；缺 API／schema 是 unavailable，不是 0。
- 暫緩、報酬確認狀態、差額結清、付款證明附件目前不由此 append-only 表自行推算；需後續規則／資料契約。
- 實付依 paid_at，服務歸屬依 service_date；月應付與單量歸月規則尚需確認，不能由 paid_at 反推。

## 未來 apply 前與真實 RPC 驗收計畫（全部 NOT RUN）

1. Pinyu 明確核准指定檔案／review 後內容及 checksum，僅 Dev。先查 Active target、columns/types、20 筆基準 migration history 與既有 ledger version；若有變化先比對，不 repair。
2. Review 移除 DRAFT guard 的精確 diff；確認只有新增表／索引／函式／trigger，無舊資料 DML、无既有 RPC replace。apply 後核對 ACL、RLS、FK、function invoker/search_path 與 history。不得聲稱目前可直接使用草稿。
3. 測試建立 synthetic OWNER、ADMIN、SITTER、disabled actor、兩張不同 family 的 V2 orders、不同 sitters 的多 items；所有測試在 transaction 中，結尾 ROLLBACK。沒有真實姓名／帳號／LINE UID。
4. 基準 due=800：單筆 800 → 1 row；分次 300（reason）+500 → 2 rows、實付800、不更新應付；300 無 reason 拒絕；900 有 reason 只記差異、不改800；0/負數/NaN/五位小數/無時區拒絕。
5. 車馬／家訪／小費：各自 item 的既有 earnings 原樣 snapshot，分開 event；不再乘80%；owner item 拒絕合作保母付款，無 company double count。
6. 同 key retry 相同 payload（包括過期 CAS）→ 1 row；改 amount/item/order/time/method/reason/actor → 拒絕。兩連線同 key 同／不同 payload 併發測試；不同 order 重用同 key 也要拒絕。兩個不同 key 分次付款逐筆核對，不能假稱同 key 能辨識兩次人工輸入的相同現實轉帳。
7. 舊 order CAS／item CAS、跨 order item、unassigned、owner、cancelled source 拒絕；已付後改派／改報酬／改服務日：歷史不變、讀取 source mismatch、新 append 拒絕直到另行 review。既有 save_order_v2 本身未加付款鎖，這是明列限制。
8. 權限：anon/authenticated 表及 RPC 直接拒絕；service_role RPC 的 SITTER/MEMBER/disabled/無 money／edit flag actor 拒絕；server 不從 body 接 actorId；不得把原始 DB error、snapshot公司欄位、PII 回給不符權限者。Sitter read 尚未提供，不能標 assigned-only 驗收完成。
9. UPDATE/DELETE/TRUNCATE 對 service role 拒絕；用 privileged synthetic transaction 檢查 immutable trigger。前後 hash 對照既有 orders/items/financial entries，沒有意外 UPDATE、repricing、status mutation。
10. readback：amount/paid_at/method/reason/recorded_by/snapshots 準確、分次合計及跨月付款、兩 sitter 不串帳；另驗 client normalization、HTTP adapter、失敗不標成功、desktop/mobile。
11. ROLLBACK 後精確查 synthetic UUID/IDs 殘留為0，原表 counts/hash 未變。只保留經核准 schema；不 DELETE 或 TRUNCATE 舊業務資料。

## 本輪獨立工作與驗證

- 收款面板新增收款／退款分列與方式／原因；讀取失敗可重試，不再錯稱既有 ledger migration 未核准。
- 寫入失聯後可只讀核對同 key：相同內容才顯示已記錄；未找到仍維持原 key／鎖定輸入；內容不同禁止再次提交。未改伺服器金額、狀態或權限。
- synthetic-only 通知模擬器：所有 bound+enabled 成員、去重、跨家庭拒絕、OWNER/ADMIN 權限、fake 回應／部分成功、只重試失敗項；只在同一 simulator 記憶體內冪等，無 network、無 durable outbox、無 LINE 發送。
- 通知模擬器尚未接 Admin/API；不把 simulator 的 client-supplied orderFamilyId 當真實授權。將來 adapter 必須由驗證後 order 查 family。
- `node --test scripts/test-step313b.mjs`：13/13 PASS（notification9 + ledger projection3 + draft static1）。
- typecheck PASS；ledger19/19；orders calculation/Admin boundary PASS；availability10/10。
- mock ledger panel smoke：1440/390 都通過原 key retry、只讀、escaping、not-ready、readback recovery/missing/conflicting key。是獨立 panel 的瀏覽器互動測試，不是正式 Admin live E2E 或全站視覺驗收。
- 無新 Dev SQL/RPC 測試；無 DB synthetic rows；headless Chrome 專屬暫存 profile 已清理。

## 真正待確認與未完成（不重問已確認折扣／80%／多人通知／cash basis）

1. 新 schema：此指定草稿仍須 review／明確 Dev apply 授權，沒有選 A 的假設。實付持久化／Admin入口仍未完成。
2. 報表：月訂單數取建單、確認或服務月？跨月訂單是否每月算一次、取消是否排除？多保母單按服務項目數還是每保母不重複 order 數？家庭累積消費是應收或淨實收？月收入 cash basis 已確認，不重問；未定義欄位未輸出成正式 XLSX。repo docs、CURRENT、Roadmap 未提供這些精確新版規則；未重新讀取正式 Excel／舊 GAS，本輪不聲稱已窮盡全部外部 evidence。
3. 通知：還需 review 明確事件／觸發／文案及 durable outbox。binding 變更後 retry 策略未定；模擬器遇收件集合改變直接要求 review，並非新通知權限規則。Admin/API與真實送出不完成，也不啟用。
4. 訂單成立：CURRENT 的新客服務前全收規則與最新 Roadmap UX 的「先沿用常客／未付訂金／待服務／未付尾款」須釐清正式狀態映射與 exception 保存方式；目前只驗證 ledger 金額不混用，未改 confirmed 條件。不能把本輪 full/deposit/waived projection tests 冒稱時段成立規則已落實。
5. 既有後端把 CAS／拒絕／不明結果包成同一訊息，尚未完成精確錯誤分類；本輪安全 readback 不等於該缺口已解。

Step 3.13B complete: NO。草稿與本輪獨立增量已完成，完整 milestone 仍受上述 schema／規格邊界阻擋。沒有 Production/schema/data/migration/deploy/commit/push／正式 Excel／真實 LINE 變更。
