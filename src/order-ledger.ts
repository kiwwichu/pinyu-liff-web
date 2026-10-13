/** Actual cash events only; order receivables and earnings remain calculation snapshots.
 * Amounts are TWD decimal strings; keep four decimal places until settlement. */
export type LedgerKind = "receipt" | "refund" | "adjustment";
export type LedgerChannel = "direct" | "platform";

export type LedgerEntryInput = {
  requestId: string;
  orderId: string;
  ledger: "payments" | "platform_settlements";
  kind: LedgerKind;
  amount: string;
  occurredAt: string;
  channel: LedgerChannel;
  method: string;
  note: string;
};

export function moneyUnits(value: unknown): bigint {
  if (typeof value !== "string" && typeof value !== "number") throw new Error("金額格式不正確");
  const normalized = String(value);
  if (!/^-?\d{1,10}(?:\.\d{1,4})?$/.test(normalized)) throw new Error("金額最多保留四位小數");
  const negative = normalized.startsWith("-");
  const [whole, fraction = ""] = normalized.replace(/^-/, "").split(".");
  const units = BigInt(whole) * 10000n + BigInt(fraction.padEnd(4, "0"));
  return negative ? -units : units;
}

export function moneyText(units: bigint): string {
  const abs = units < 0n ? -units : units;
  return `${units < 0n ? "-" : ""}${abs / 10000n}.${String(abs % 10000n).padStart(4, "0")}`;
}

export function parseLedgerEntry(raw: unknown): LedgerEntryInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("流水格式不正確");
  const source = raw as Record<string, unknown>;
  const field = (key: string, max: number, required = true): string => {
    const value = source[key];
    if (value === undefined && !required) return "";
    if (typeof value !== "string" || value.trim().length > max || (required && !value.trim())) {
      throw new Error(`${key} 格式不正確`);
    }
    return value.trim();
  };
  const requestId = field("requestId", 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    throw new Error("請重新載入流水表單");
  }
  const ledger = field("ledger", 30);
  if (ledger !== "payments" && ledger !== "platform_settlements") throw new Error("流水類別不支援");
  const kind = field("kind", 20);
  if (kind !== "receipt" && kind !== "refund" && kind !== "adjustment") throw new Error("流水事件不支援");
  if (ledger === "payments" && kind === "adjustment") throw new Error("客戶流水只接受實際收款或退款");
  const units = moneyUnits(source.amount);
  if (units === 0n || (kind !== "adjustment" && units < 0n)) throw new Error("收款／退款請填正金額，調整金額不可為零");
  const occurredAt = field("occurredAt", 40);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(occurredAt)
      || !Number.isFinite(Date.parse(occurredAt))) throw new Error("請提供含時區的實際收付款時間");
  const channel = field("channel", 20);
  if (channel !== "direct" && channel !== "platform") throw new Error("收款對象不支援");
  if (ledger === "platform_settlements" && channel !== "platform") throw new Error("平台流水的收款來源必須是平台");
  const note = field("note", 1000, false);
  if (kind !== "receipt" && !note) throw new Error("退款／調整需填寫原因");
  return { requestId: requestId.toLowerCase(), orderId: field("orderId", 100), ledger, kind, amount: moneyText(units),
    occurredAt: normalizeLedgerTime(occurredAt), channel, method: field("method", 80), note };
}

export function signedAmount(entry: { kind: LedgerKind; amount: string | number }): bigint {
  const units = moneyUnits(entry.amount);
  return entry.kind === "refund" ? -units : units;
}

/** Customer money held by a platform is NOT a second cash receipt by Pinyu. */
export function cashAmount(entry: Pick<LedgerEntryInput, "ledger" | "channel" | "kind" | "amount">): bigint {
  return entry.ledger === "payments" && entry.channel === "platform" ? 0n : signedAmount(entry);
}

export function cashMonth(occurredAt: string): string {
  const time = Date.parse(normalizeLedgerTime(occurredAt));
  return new Date(time + 8 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

/** Date.parse alone normalizes impossible calendar dates such as February 31. */
export function normalizeLedgerTime(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,3})?(Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) throw new Error("流水時間不正確");
  const day = new Date(`${match[1]}T00:00:00Z`);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== match[1]
      || /[+-]14:(?!00)/.test(match[5])) throw new Error("流水時間不正確");
  return new Date(value).toISOString();
}

export type OrderMoneySnapshot = {
  orderId: string;
  updatedAt: string;
  customerTotal: string;
  ownerEarningsTotal: string;
  sitterEarningsTotal: string;
  companyEarningsBeforePlatform: string;
  platformName: string | null;
};

/** This is a projection, never an order repricing or a receipt inferred from a quote. */
export function summarizeOrderLedger(order: OrderMoneySnapshot, entries: readonly LedgerEntryInput[]) {
  const receivable = moneyUnits(order.customerTotal);
  const sitter = moneyUnits(order.sitterEarningsTotal);
  const company = moneyUnits(order.companyEarningsBeforePlatform);
  const owner = moneyUnits(order.ownerEarningsTotal);
  if (receivable < 0n || sitter < 0n || owner < 0n || receivable !== sitter + company) {
    throw new Error("訂單金額快照不一致，請先核對；不得以流水重算報酬");
  }
  let receipts = 0n, refunds = 0n, platform = 0n, cash = 0n;
  const seen = new Set<string>();
  const months = new Map<string, bigint>();
  for (const raw of entries) {
    const entry = parseLedgerEntry(raw);
    if (entry.orderId !== order.orderId || seen.has(entry.requestId)) throw new Error("流水關聯或識別碼不一致");
    seen.add(entry.requestId);
    // Validate platform membership when recording, not against a later edited header.
    if (entry.ledger === "payments") {
      if (entry.kind === "receipt") receipts += moneyUnits(entry.amount);
      else refunds += moneyUnits(entry.amount);
    } else platform += signedAmount(entry);
    const actualCash = cashAmount(entry);
    cash += actualCash;
    const month = cashMonth(entry.occurredAt);
    months.set(month, (months.get(month) ?? 0n) + actualCash);
  }
  const net = receipts - refunds;
  return {
    customerReceivable: moneyText(receivable),
    ownerEarningsSnapshot: moneyText(owner),
    sitterEarningsSnapshot: moneyText(sitter),
    // Includes owner's execution earnings ONCE; do not add ownerEarningsSnapshot again.
    companyIncomeBeforePlatform: moneyText(company),
    customerReceipts: moneyText(receipts), customerRefunds: moneyText(refunds),
    customerNetPaid: moneyText(net),
    // Signed reconciliation difference, not a newly invented collectible/refund entitlement.
    receivableLessNetPaid: moneyText(receivable - net),
    platformSettlementNet: moneyText(platform),
    actualCashNet: moneyText(cash),
    cashByMonth: Object.fromEntries([...months].sort(([a], [b]) => a.localeCompare(b)).map(([m, n]) => [m, moneyText(n)])),
    entryCount: entries.length,
    warnings: [
      ...(net < 0n ? ["退款超過目前已記錄收款；請核對流水完整性"] : []),
      ...(net > receivable ? ["淨收款超過目前應收；差額不代表自動退款授權"] : []),
    ],
  };
}
