/** Pinyu CURRENT 2026-09-13: operational count = active service items, not orders.
 * Input must come from a complete, authorized server read. No money or PII needed.
 * Joint execution is not modeled: never infer individual allocation for two sitters.
 */
export type CountItem = {
  id: string; itemType: string; itemStatus: string; serviceDate: string | null;
  assignedSitterId: number | null;
};
export type CountOrder = { orderId: string; familyId: string; orderStatus: string; items: readonly CountItem[] };

function validDate(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value + 'T00:00:00Z')) ||
      new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value) throw new Error('有效服務缺少正確日期，不能推定歸月');
  return value;
}
export function financeServiceCounts(sources: readonly CountOrder[]) {
  const seenOrders = new Set<string>(), seenItems = new Set<string>();
  const monthly = new Map<string, number>(), families = new Map<string, number>();
  const sitters = new Map<number, number>(), sitterMonths = new Map<string, { sitterId: number; month: string; serviceCount: number }>();
  const orders = sources.map(source => {
    if (!source.orderId || !source.familyId || !['draft', 'awaiting_deposit', 'confirmed', 'in_service', 'completed', 'cancelled'].includes(source.orderStatus) || seenOrders.has(source.orderId)) throw new Error('單量來源不完整或訂單重複');
    seenOrders.add(source.orderId);
    const dates: string[] = [], bySitter = new Map<number, string[]>();
    let unassignedServiceCount = 0;
    for (const item of source.items) {
      if (!item.id || seenItems.has(item.id)) throw new Error('服務項目識別碼重複或缺少');
      seenItems.add(item.id);
      if (!['active', 'cancelled'].includes(item.itemStatus) || !['service', 'travel_fee', 'home_visit_fee', 'tip'].includes(item.itemType)) throw new Error('未知服務項目類型或狀態');
      if (source.orderStatus === 'cancelled' || item.itemStatus === 'cancelled' || item.itemType !== 'service') continue;
      const date = validDate(item.serviceDate);
      dates.push(date);
      if (item.assignedSitterId === null) { unassignedServiceCount++; continue; }
      if (!Number.isSafeInteger(item.assignedSitterId) || item.assignedSitterId <= 0) throw new Error('保母識別碼無效');
      const own = bySitter.get(item.assignedSitterId) ?? [];
      own.push(date); bySitter.set(item.assignedSitterId, own);
    }
    const lastServiceDate = dates.sort().at(-1) ?? null;
    const serviceMonth = lastServiceDate?.slice(0, 7) ?? null;
    if (serviceMonth) monthly.set(serviceMonth, (monthly.get(serviceMonth) ?? 0) + dates.length);
    families.set(source.familyId, (families.get(source.familyId) ?? 0) + dates.length);
    for (const [sitterId, own] of bySitter) {
      const month = own.sort().at(-1)!.slice(0, 7), key = `${sitterId}/${month}`;
      sitters.set(sitterId, (sitters.get(sitterId) ?? 0) + own.length);
      const row = sitterMonths.get(key) ?? { sitterId, month, serviceCount: 0 };
      row.serviceCount += own.length; sitterMonths.set(key, row);
    }
    return { orderId: source.orderId, familyId: source.familyId, serviceCount: dates.length, lastServiceDate, serviceMonth, unassignedServiceCount };
  });
  return {
    orders,
    monthly: [...monthly].sort(([a], [b]) => a.localeCompare(b)).map(([month, serviceCount]) => ({ month, serviceCount })),
    families: [...families].sort(([a], [b]) => a.localeCompare(b)).map(([familyId, serviceCount]) => ({ familyId, serviceCount })),
    sitters: [...sitters].sort(([a], [b]) => a - b).map(([sitterId, serviceCount]) => ({ sitterId, serviceCount })),
    sitterMonths: [...sitterMonths.values()].sort((a, b) => a.month.localeCompare(b.month) || a.sitterId - b.sitterId),
    basis: { unit: '有效 service item／服務次數；分鐘數與 quantity 不影響單量',
      monthly: '每張訂單最後有效服務日所在月份；取消整單及取消項目不計',
      sitterMonthly: '每張訂單中該保母自己的最後有效服務日所在月份',
      unassigned: '計入整體，不推定保母', jointExecution: '個人分配 deferred；現有單一 assigned sitter 模型不推定多人分配' },
  };
}
