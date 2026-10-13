## 🤖 Codex milestone checkpoint｜Step 3.13B｜2026-09-13
HANDOFF_STATUS: READY_FOR_CHATGPT
HANDOFF_ID: step-3.13b-service-counts-20260913-75838f317926410380050ae8a4508b83

### Result／scope
PARTIAL；Step 3.13B 尚未完整完成。本次从最新 CURRENT（2026-09-13 08:53 UTC）續跑，已落實 Pinyu 最新服務單量規則的純計算及與既有財務資料投影合併，不重做 3.13A／3.12，不進 3.13C。
原 4 題單量 blocker 已解除，不再重問。這次停止點是「保母每月金額歸屬」仍缺直接確認，不能把已確認的單量歸月直接當成應付／所得歸月。請 ChatGPT 先查證並整理，必要時才問 Pinyu。

### 本次已完成
- 新增 financeServiceCounts：每個 active 且 item_type=service 的項目計 1；分鐘／quantity 不增加單量。整單 cancelled 或 item cancelled 不計；車馬費、家訪費、小費等獨立費用項不額外增加 service 單量。
- 整體月單量按每張 order 最後有效 service 日期歸月；保母按自己在該 order 的最後有效 service 日期歸月。保母僅計 assigned items；未指派計入整體但不推定保母。
- 日期區間必須先由既有建單流程展開 items；本投影不再擅自展開或乘 quantity。共同執行個人分配 deferred；不接受 assigned sitter 陣列冒充已支持多人分配。
- 新增 financeOperationalBasis 合併逐單、月現金／月服務單量、家庭淨付款／累積服務單量、保母累積與每月服務單量。現金依實際事件台北時間歸月，與服務歸月分開。
- 取消訂單保留其真實收款／退款事件，不因服務單量為零就抹除金流。不同月份收款／退款不被挪到服務月。
- 未知狀態／項目類型、有效服務缺少或錯誤日期、重複 order/item、無效保母識別碼拒絕計算。新投影不查 DB、不收客戶任意來源作可信資料、不更改金額公式；完整來源檢查仍須在未完成的 server adapter 實現。
- 修正舊財務 basis 的「單量待確認」描述，指向已確認的新投影。未宣稱已有 server query 或 XLSX。

### Evidence／精確 review 問題
已讀最新共同記憶、Roadmap、CURRENT，並查 repo 計價／CRUD／schema／既有 draft review。沒有重讀正式 Excel／GAS，因此不宣稱已窮盡所有舊系統外部證據。
- CURRENT 2026-09-13 最新確認只明定保母「月單量」按自己最後有效服務日。Dashboard cash basis 和實付 paid_at 都已明確，不重問。
- Roadmap 保母報酬需求包含「本月應付」「每月／累積服務報酬、車馬費、小費、已付款、待付款」，但查到的段落未定義跨月應付金額的歸月方式。
- docs/step-3.13b-sitter-payment-draft-review.md:55 已記錄「月應付與單量歸月規則尚需確認」。最新回覆已解決單量，未找到明確涵蓋月應付金額的文字。
- supabase/migrations/20260830080519_add_orders_v2_core_and_order_items.sql:140 service_date 可為 NULL；:171 只有 service 類型必填日期。車馬費／家訪費／小費可能沒有日期。報酬保存在 item snapshot，不能用 actual paid_at 替代應付的歸屬日期。

請 ChatGPT 整理以下兩個相連問題，而非重問已決定的 4 題：
1. 同一保母同一 order 在 8/31 和 9/1 各有服務報酬 800：月單量已確認兩次歸 9 月；「月服務總額／月應得報酬／對應公司收入」是也整單歸 9 月，還是按每項實際服務月拆成 8 月 800、9 月 800？目前未將任一選項寫入金額邏輯。
2. 獨立車馬／家訪／小費項沒有 service_date，或該保母在 order 只有費用項而沒有 service item 時，其月應付歸月應採哪個明確依據？不自行用訂單建立日、付款日、另一位保母的服務日或當月補值。
若既有 evidence 已足以回答，請直接更新 CURRENT 的金額口徑，無需 Pinyu 重複確認；若仍無答案，再由 ChatGPT 白話詢問 Pinyu。單量、cash basis、折扣、80%、Pinyu 不 double count 等既有確認不重問。
本 session 沒有可用內建 ChatGPT thread／Computer Use／node_repl 工具（已搜尋工具清單）；依已授權 fallback 寫共同 Notion，沒有假稱已傳到另一聊天視窗。

### Tests／self-review
全部 PASS：
- npm.cmd run typecheck
- npm.cmd run test:ledger：19
- npm.cmd run test:orders：calculation＋V2 admin boundaries
- node scripts/test-availability-core.mjs：10
- node --test scripts/test-step313b.mjs scripts/test-sitter-payment.mjs scripts/test-sitter-payment-admin.mjs scripts/test-finance-export-basis.mjs scripts/test-finance-service-counts.mjs：27（13＋5＋1＋3＋5）
- self-review 後再次跑新單量／財務基礎：8。修正五天每日一次 fixture 日期、補共同執行陣列拒絕驗證；檢查沒有來源 mutation、沒有服務／现金歸月混算。
- git diff --check PASS；既有 tracked files 的 CRLF 提示不屬本次新錯誤。新增／untracked 檔另外做靜態檢查。
以上為本機 pure/mock regression，不是假冒 real RPC／live HTTP。沒有本次 UI 變更，未重跑先前 panel smoke；沒有 build、XLSX workbook 或瀏覽器驗收。

### Changed files（本次 attributable = 5）
- 新增 src/finance-service-counts.ts
- 修改 src/finance-export-basis.ts
- 新增 scripts/test-finance-service-counts.mjs
- 修改 scripts/test-finance-export-basis.mjs
- 新增 docs/step-3.13b-service-counts-checkpoint.md
其他既有 dirty／untracked（含之前 20 檔 checkpoint）保留；沒有 stage、reset、清除或重寫 Skill。實際 repo 為 C:/Users/kiwi9/OneDrive/桌面/寵物保姆/城市/pinyu-liff-web-git。

### Dev／migration preflight
- 本次只讀確認 pet-sitter-dev（zzkdmenxlucgxirwxayb）為 ACTIVE_HEALTHY。
- 仍為 21 支 migration；包含 20260909183359_add_order_financial_ledgers 和 20260912045136_draft_sitter_payment_ledger。沒有重跑／修補 history。
- 指定 sitter migration 本機 SHA256 仍為 927FF883BB3FBCEFFFB373F5822B4248D0887139C9CB8B1EDCD9C22775DA61DA，與已套用 handoff 相同。
- 本次未執行 SQL、未查業務列、未新增 synthetic DB data；cleanup 不適用。前次 rollback／零殘留結果保留為前次 evidence，沒有冒稱本次重驗。

### 尚未完成（不可消失或誤標 PASS）
- 真正 server report query、Owner/Admin report/download 入口、XLSX writer／download／重新讀取檔案驗證。
- 保母月金額／費用歸月口徑、對應金額彙總與 sitter-facing 財務摘要。
- 前 checkpoint 所列真實同時 RPC concurrency 仍未驗收；不能把 sequential mock 或未證明重疊的 SQL 當 PASS。
- 完整 Admin navigation／live HTTP、notification Admin dry-run 呈現、新客全額收款後正式保留時段整合仍未完成。
- 正式通知 outbox／事件／觸發／文案／binding 變更 retry 策略維持 deferred，不是本次新 blocker。
- 不宣稱 Step 3.13B 或 Step 3.13 整體完成。

### Safety／next
Production queried/changed: NO
Supabase schema changed this round: NO
Dev business data changed this round: NO
Migration executed/history repaired this round: NO
Dev/formal deploy: NO
Commit: NO
Push: NO
Old orders backfill/cleanup/rewrite: NO
Formal Excel changed: NO
Real PII / real LINE / scheduler: NO
Synthetic cleanup: no DB fixtures created this round; in-memory tests only.
Step complete: NO
Pinyu confirmation needed: YES if ChatGPT evidence review cannot resolve the two monthly-money cases.
Immediate next: ChatGPT review 本 handoff 的月金額歸屬案例，依 evidence 回答或集中請 Pinyu 確認；解除後重讀 CURRENT，從 server report／XLSX 和剩餘整合續跑，不重建 ledger、不重跑 migration、不進 3.13C。
⚠️ 沿用確認：2026-09-13 最新服務單量與保母歸月、現金 cash basis、家庭實際淨支付、折扣／80%／Pinyu 不 double count 均維持。若不是這樣請告知，我們會改回。
