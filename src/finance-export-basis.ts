import { cashAmount, cashMonth, moneyText, moneyUnits, parseLedgerEntry, summarizeOrderLedger } from "./order-ledger";
import type { LedgerEntryInput, OrderMoneySnapshot } from "./order-ledger";
import { financeServiceCounts, type CountItem } from "./finance-service-counts";

export type FinanceSource = { order: OrderMoneySnapshot; familyId: string; entries: readonly LedgerEntryInput[] };
/** Financial basis; use financeOperationalBasis for the confirmed service-count projection.
 * Call only after server auth and complete bounded reads. Never accept this source from a client.
 * XLSX adapter must write typed literal values, never execute user text as formulas.
 */
export function financeExportBasis(sources: readonly FinanceSource[]) {
  const seenOrders = new Set<string>(), seenEntries = new Set<string>();
  const months = new Map<string, bigint>(), families = new Map<string, bigint>();
  const orders = sources.map(source => {
    if (!source.familyId || seenOrders.has(source.order.orderId)) throw new Error("財務來源缺少家庭或重複訂單");
    seenOrders.add(source.order.orderId);
    const summary = summarizeOrderLedger(source.order, source.entries);
    for (const raw of source.entries) {
      const e = parseLedgerEntry(raw);
      if (seenEntries.has(e.requestId)) throw new Error("財務流水識別碼重複");
      seenEntries.add(e.requestId);
      const month = cashMonth(e.occurredAt);
      months.set(month, (months.get(month) ?? 0n) + cashAmount(e));
    }
    families.set(source.familyId, (families.get(source.familyId) ?? 0n) + moneyUnits(summary.customerNetPaid));
    return {
      orderId: source.order.orderId, familyId: source.familyId,
      customerReceivable: summary.customerReceivable, customerReceipts: summary.customerReceipts,
      customerRefunds: summary.customerRefunds, customerNetPaid: summary.customerNetPaid,
      sitterEarningsSnapshot: summary.sitterEarningsSnapshot,
      companyIncomeBeforePlatform: summary.companyIncomeBeforePlatform,
      actualCashNet: summary.actualCashNet, platformSettlementNet: summary.platformSettlementNet,
      // No settlement-completion inference, fee estimate, or payer/receipt double count.
      platformName: source.order.platformName,
    };
  });
  return {
    orders,
    monthlyCash: [...months].sort(([a],[b])=>a.localeCompare(b)).map(([month,amount])=>({month,actualCashNet:moneyText(amount)})),
    familySpending: [...families].sort(([a],[b])=>a.localeCompare(b)).map(([familyId,amount])=>({familyId,customerNetPaid:moneyText(amount)})),
    basis: { cashMonth:"Asia/Taipei actual receipt/refund/settlement date",
      familySpending:"customer receipts minus refunds, including customer payments to platforms",
      companyIncome:"calculation snapshot includes owner once; not cash or actual sitter payment",
      orderCounts:"use financeOperationalBasis: confirmed 2026-09-13 active service-item counts, not order counts",
      platformNetCompanyIncome:"not inferred from incomplete settlements",
      availability:"export data basis only; no XLSX download or server query integration yet" },
  };
}

export type OperationalFinanceSource = FinanceSource & { orderStatus: string; items: readonly CountItem[] };
/** Combine two different clocks. Cancelled orders retain real receipts/refunds, but zero visits.
 * Pure projection only; not a server query or downloadable workbook.
 */
export function financeOperationalBasis(sources: readonly OperationalFinanceSource[]) {
  const money = financeExportBasis(sources);
  const counts = financeServiceCounts(sources.map(s => ({ orderId: s.order.orderId, familyId: s.familyId, orderStatus: s.orderStatus, items: s.items })));
  const countsByOrder = new Map(counts.orders.map(row => [row.orderId, row]));
  const countsByFamily = new Map(counts.families.map(row => [row.familyId, row.serviceCount]));
  const cashByMonth = new Map(money.monthlyCash.map(row => [row.month, row.actualCashNet]));
  const countByMonth = new Map(counts.monthly.map(row => [row.month, row.serviceCount]));
  return {
    orders: money.orders.map(row => ({ ...row, ...countsByOrder.get(row.orderId)! })),
    monthly: [...new Set([...cashByMonth.keys(), ...countByMonth.keys()])].sort().map(month => ({
      month, actualCashNet: cashByMonth.get(month) ?? '0.0000', serviceCount: countByMonth.get(month) ?? 0,
    })),
    families: money.familySpending.map(row => ({ ...row, serviceCount: countsByFamily.get(row.familyId)! })),
    sitters: counts.sitters, sitterMonths: counts.sitterMonths,
    basis: { ...money.basis, serviceCounts: counts.basis,
      zeroes: 'zero means no matching events/items in a complete supplied source; incomplete reads must fail before projection',
      availability: 'pure financial/service-count projection; server query, sitter monetary aggregates and XLSX still separate' },
  };
}
