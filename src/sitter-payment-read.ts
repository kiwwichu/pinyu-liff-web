import { createSupabaseAdmin } from "./supabase";
import { assertLedgerAccess, type LedgerActor } from "./order-ledger-service";
import { moneyText, moneyUnits } from "./order-ledger";
import { LedgerFailure } from "./ledger-failure";

/** Owner/Admin-only projection. No names, contacts, LINE IDs, or free-text item snapshots. */
export async function getSitterPayment(raw: unknown, actor: LedgerActor, env: Env) {
  assertLedgerAccess(actor, env.APP_ENV, env.SUPABASE_URL, false);
  if (!raw || typeof raw !== "object" || !("orderId" in raw) || !("orderItemId" in raw)
      || typeof raw.orderId !== "string" || typeof raw.orderItemId !== "string"
      || raw.orderId.length > 100 || !/^[0-9a-f-]{36}$/i.test(raw.orderItemId)) {
    throw new LedgerFailure("LEDGER_REJECTED", "請指定訂單與服務項目", 422);
  }
  const db = createSupabaseAdmin(env);
  const { data: item, error } = await db.from("order_items")
    .select("order_item_id,order_id,item_type,item_status,service_date,assigned_sitter_id,provider_type_snapshot,sitter_earnings_amount,updated_at,orders!inner(order_model_version,order_status,updated_at)")
    .eq("order_item_id", raw.orderItemId).eq("order_id", raw.orderId).eq("orders.order_model_version", 2).maybeSingle();
  if (error || !item) throw new LedgerFailure("LEDGER_READ_UNAVAILABLE", "找不到可讀取的 V2 報酬項目", 404);
  const { data: rows, error: historyError, count } = await db.from("sitter_payment_entries")
    .select("request_id,order_id,order_item_id,sitter_id_snapshot,item_updated_at_snapshot,due_amount_snapshot,amount,paid_at,method,difference_reason,recorded_at", { count: "exact" })
    .eq("order_id", raw.orderId).eq("order_item_id", raw.orderItemId)
    .order("recorded_at", { ascending: true }).order("request_id", { ascending: true }).limit(500);
  if (historyError || !rows || count === null || count !== rows.length) {
    throw new LedgerFailure("LEDGER_READ_UNAVAILABLE", "付款歷程未完整取得，不能當成實付 0 元", 503);
  }
  const due = moneyUnits(item.sitter_earnings_amount);
  const paid = rows.reduce((sum, row) => sum + moneyUnits(row.amount), 0n);
  const requiresReview = item.item_status !== "active" || item.orders.order_status === "cancelled"
    || item.provider_type_snapshot !== "sitter" || item.assigned_sitter_id === null
    || rows.some(row => row.sitter_id_snapshot !== item.assigned_sitter_id || row.item_updated_at_snapshot !== item.updated_at);
  return {
    source: { orderId: item.order_id, orderItemId: item.order_item_id, itemType: item.item_type,
      serviceDate: item.service_date, sitterId: item.assigned_sitter_id,
      expectedOrderUpdatedAt: item.orders.updated_at, expectedItemUpdatedAt: item.updated_at },
    summary: { currentDueSnapshot: moneyText(due), actualPaidHistory: moneyText(paid),
      // Changed/cancelled payee must not look like an automatically payable balance.
      dueLessPaid: requiresReview ? null : moneyText(due - paid), requiresReview },
    entries: rows.map(row => ({
      requestId: row.request_id, orderId: row.order_id, orderItemId: row.order_item_id,
      sitterIdSnapshot: row.sitter_id_snapshot, dueAmountSnapshot: moneyText(moneyUnits(row.due_amount_snapshot)),
      amount: moneyText(moneyUnits(row.amount)), paidAt: row.paid_at, method: row.method,
      differenceReason: row.difference_reason, recordedAt: row.recorded_at,
    })),
    boundary: "應付快照不代表實付；差額不代表自動支付或追回授權。來源變更需人工核對。",
  };
}
