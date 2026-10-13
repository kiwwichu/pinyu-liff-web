import { moneyText, moneyUnits, normalizeLedgerTime, parseLedgerEntry, summarizeOrderLedger } from "./order-ledger";
import type { LedgerEntryInput, OrderMoneySnapshot } from "./order-ledger";
import { LedgerFailure } from "./ledger-failure";

export type LedgerActor = { userId: string; role: string; canViewMoney: boolean; canEditOrders: boolean };
export type LedgerStore = {
  read(orderId: string, actorId: string): Promise<unknown>;
  append(entry: LedgerEntryInput, actorId: string, expectedUpdatedAt: string): Promise<unknown>;
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("流水回應格式不正確");
  return value as Record<string, unknown>;
}
function requiredText(value: unknown, max = 100): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error("流水識別欄位不正確");
  return value.trim();
}

export function assertLedgerAccess(actor: LedgerActor, appEnv: string, supabaseUrl: string, write: boolean) {
  if (appEnv !== "development" || new URL(supabaseUrl).origin !== "https://zzkdmenxlucgxirwxayb.supabase.co") {
    throw new Error("Step 3.13A 流水只允許指定 Dev 環境");
  }
  if (!["OWNER", "ADMIN"].includes(actor.role.toUpperCase()) || !actor.canViewMoney || (write && !actor.canEditOrders)) {
    throw new Error("沒有操作訂單流水的權限");
  }
}

export function ledgerResponse(raw: unknown, expectedOrderId: string) {
  const data = record(raw);
  const source = record(data.order);
  const amount = (key: string) => moneyText(moneyUnits(source[key]));
  const order: OrderMoneySnapshot = {
    orderId: requiredText(source.orderId), updatedAt: requiredText(source.updatedAt),
    customerTotal: amount("customerTotal"), ownerEarningsTotal: amount("ownerEarningsTotal"),
    sitterEarningsTotal: amount("sitterEarningsTotal"),
    companyEarningsBeforePlatform: amount("companyEarningsBeforePlatform"),
    platformName: source.platformName == null ? null : requiredText(source.platformName),
  };
  if (source.orderModelVersion !== 2 || order.orderId !== expectedOrderId) throw new Error("找不到新版訂單流水");
  if (!Array.isArray(data.entries)) throw new Error("流水資料尚未就緒");
  const entries = data.entries.map(parseLedgerEntry);
  return { order, entries, summary: summarizeOrderLedger(order, entries) };
}

export async function getOrderLedger(
  raw: unknown, actor: LedgerActor, appEnv: string, supabaseUrl: string, store: LedgerStore,
) {
  assertLedgerAccess(actor, appEnv, supabaseUrl, false);
  const orderId = requiredText(record(raw).orderId);
  return ledgerResponse(await store.read(orderId, actor.userId), orderId);
}

export async function appendOrderLedger(
  raw: unknown, actor: LedgerActor, appEnv: string, supabaseUrl: string, store: LedgerStore,
) {
  assertLedgerAccess(actor, appEnv, supabaseUrl, true);
  let entry: LedgerEntryInput;
  let expectedUpdatedAt: string;
  try {
    const source = record(raw);
    entry = parseLedgerEntry(source);
    expectedUpdatedAt = requiredText(source.expectedUpdatedAt, 40);
    // Preserve PostgreSQL microseconds for CAS, not a normalized JS timestamp.
    if (!Number.isFinite(Date.parse(expectedUpdatedAt))) throw new Error("invalid CAS");
    normalizeLedgerTime(entry.occurredAt);
  } catch {
    throw new LedgerFailure("LEDGER_REJECTED", "本次尚未送出；請核對金額、途徑、時間與原因", 422);
  }
  // RPC performs order-version check, row locking and idempotency atomically.
  const saved = await store.append(entry, actor.userId, expectedUpdatedAt);
  return ledgerResponse(saved, entry.orderId);
}
