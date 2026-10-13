# Step 3.13B 付款與正式保留時段：最小變更提案（未 apply）

2026-09-21。來源：CURRENT 9/19 review、新客全額／熟客個別例外既有確認。
本文件是技術契約與驗收方案，不是 migration apply 授權，不是已完成持久化。

## 已核實缺口

- `src/order-scheduling.ts` 的 occupied 查詢只看 active service item，沒有依 parent order 的正式保留狀態過濾；draft／awaiting_deposit 目前也會占位。
- `20260902135025_link_orders_v2_operational_relations.sql` 的 `save_order_v2_with_relations` 有 per-sitter transaction advisory lock，最後 overlap 查詢同樣未篩 parent order status。
- `20260901103813_add_save_order_v2_rpc.sql` 的 `save_order_v2` 鎖住 order 並驗 CAS，但不讀實收 ledger。
- `append_order_ledger_v2` 與 order save 共用 order row lock，新增 receipt/refund 不更新 order.updated_at。因此 Worker 先讀收款再 save，僅靠原 updated_at CAS 仍存在收款／退款競爭窗口。
- `legacy_data.customer_type` 與 deposit snapshot 能表示客戶類型、報價條件，沒有專用的人工收款確認／熟客個別例外授權快照。不把 returning 或 waived 的一般欄位，直接冒充已獲核准保留。
- 本次純 `reservationPaymentPreview` 只顯示差額及待確認狀態，永遠不回傳可自動保留。不新增零元流水、不自動改 payment/order/platform/sitter 狀態。

## 最小持久化／RPC 契約候選

需 review 後產生指定 migration；本輪不建立或執行未審核的上線 migration。

1. 保留 `orders` 與 `order_items` 為唯一服務來源，不另複製排班業務資料。新增最小 nullable reservation confirmation metadata：操作者、時間、訂單版本、人工核對的最低應收條件、當下實收及 ledger request-id/version 證據；熟客例外必須有明確每單確認，不能僅以 returning 推斷。欄位命名及是否獨立 append-only event 應在精確 migration review 一次定稿，不視本提案為產品權限決定。
2. 由同一受授權 Owner/Admin 呼叫的 compound RPC 完成人工確認、ledger 重讀、金額門檻、availability 重檢、order/item 保存及正式保留。`SECURITY INVOKER`、空 search_path、只授權 service_role；actor 取自已驗證 session，仍需 DB 重新檢查 active role/flags。
3. 先按固定順序取得相關舊／新 sitter locks，再 order row lock、CAS、policy/ledger 重讀。所有會改占位的 RPC 遵守一致鎖順序；不能只有新 RPC 鎖住，而保留可繞過檢查的舊 save 路徑。一般寫入不可跳過人工確認門檻。客戶 ledger 維持 append-only。
4. 更新既有 SQL overlap、Worker availability、Admin/Public/Sitter 讀取投影的一致 parent-order predicate；draft／awaiting_deposit 是試排，不正式占位。confirmed／in_service 與既有 completed/cancelled 邊界要沿用已確認 lifecycle，不單獨改其中一層。保留 recurring、單日 override、buffer、月上限檢查。
5. 退款只記實際退款，不自動取消已保留服务；若後續操作需重確認，顯示須核對。既有缺日期／缺人工確認 metadata 的單不回填、猜值或批次重寫。
6. idempotency 同 key 同 payload 回同結果，同 key 異 payload 拒絕；收到結果不確定時用原 key 核對，不另建事件。不可只使用記憶體 idempotency。

以上需要修改資料庫函式／必要持久化，超出 CURRENT 的新 migration apply 授權；只加 Worker precheck 不能解決原子性。正式啟用整合必須等待精確 migration review 與 Pinyu 指定 Dev apply 授權。

## 驗收方案（未執行 SQL，不能標 PASS）

- 新客欠款／只有付款證明／只有手改 payment_status 均不可保留；人工核對且 ledger 已足額才可保留。平台客戶付款與平台撥款分離，不要求把 settlement 冒充 customer payment。
- 熟客個別訂金與免訂金有明確核准證據；免訂金不新增 0 元 entry。未知 customer type／未知例外不得 fallback 為熟客。
- 同時退款與確認：用 barrier 證明兩請求真正重疊，共用鎖後重新讀到有效 ledger，不以 Promise.all 或 sequential retry 當 concurrency 證據。
- 同時兩單搶同 sitter/date/time：一成一拒；兩張未保留草稿可試排；改期、換保母、部分取消、整單取消後投影一致。
- 固定排班、單日 override、buffer、月上限、無指定時間、超過1000筆都需顯式完整性／可用性驗證，不默默截斷或發明時段。
- Owner/Admin 許可旗標、Sitter/Member/Public 拒絕、跨家庭 pets/home visit 拒絕，response/logs 不洩露 PII。
- 僅指定 Dev、synthetic 可 rollback fixtures；若真正跨連線併發需要可見的 committed fixture，需另行限定授權與 cleanup 方案，不用正式資料測試。

F21 完整分鐘庫存／私人月曆等舊後台承接仍分列退場前待辦，沒有因本契約而擴成完整排班重寫。
