import { assertLedgerAccess, type LedgerActor } from "./order-ledger-service";
import { moneyText, moneyUnits, normalizeLedgerTime } from "./order-ledger";
import { LedgerFailure } from "./ledger-failure";

export type SitterPaymentInput = {
  requestId: string; orderId: string; orderItemId: string; amount: string;
  paidAt: string; method: string; differenceReason: string;
};
export type SitterPaymentStore = {
  append(entry: SitterPaymentInput, actorId: string, orderVersion: string, itemVersion: string): Promise<unknown>;
};
function record(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("invalid object");
  return v as Record<string, unknown>;
}
function text(v: unknown, max: number, optional = false): string {
  if (optional && v === undefined) return "";
  if (typeof v !== "string" || v.length > max || (!optional && !v.trim())) throw new Error("invalid text");
  return v.trim();
}
const uuid = (v: unknown) => {
  const id = text(v, 36).toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) throw new Error("invalid UUID");
  return id;
};
export async function appendSitterPayment(raw: unknown, actor: LedgerActor, appEnv: string, url: string, store: SitterPaymentStore) {
  assertLedgerAccess(actor, appEnv, url, true);
  let entry: SitterPaymentInput, orderVersion: string, itemVersion: string;
  try {
    const source = record(raw);
    const amount = moneyUnits(source.amount);
    if (amount <= 0n) throw new Error("positive actual payments only");
    orderVersion = text(source.expectedOrderUpdatedAt, 40);
    itemVersion = text(source.expectedItemUpdatedAt, 40);
    if (![orderVersion, itemVersion].every(t => Number.isFinite(Date.parse(t)))) throw new Error("invalid CAS");
    entry = { requestId: uuid(source.requestId), orderId: text(source.orderId, 100),
      orderItemId: uuid(source.orderItemId), amount: moneyText(amount),
      paidAt: normalizeLedgerTime(text(source.paidAt, 40)), method: text(source.method, 80),
      differenceReason: text(source.differenceReason, 1000, true) };
  } catch {
    throw new LedgerFailure("LEDGER_REJECTED", "本次尚未送出；請核對保母實付金額、時間、方式與差異原因", 422);
  }
  // Actor, payee and remuneration are never accepted from client payload.
  const saved = record(await store.append(entry, actor.userId, orderVersion, itemVersion));
  if (saved.recorded !== true || saved.requestId !== entry.requestId || typeof saved.replayed !== "boolean") {
    throw new LedgerFailure("LEDGER_OUTCOME_UNKNOWN", "保母付款結果未確認；請保留原識別碼核對", 503);
  }
  return { requestId: entry.requestId, recorded: true, replayed: saved.replayed };
}
