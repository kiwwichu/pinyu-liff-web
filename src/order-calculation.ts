export const ORDER_CALCULATION_VERSION = "orders-v2.1";

const MONEY_SCALE = 10_000n;
const RATE_SCALE = 1_000_000n;

export type DecimalInput = number | string;
export type OrderItemType = "service" | "travel_fee" | "home_visit_fee" | "tip";
export type OrderItemStatus = "active" | "cancelled";
export type ProviderType = "owner" | "sitter" | "unassigned";

export type DiscountRule =
  | { type: "none" }
  | { type: "rate"; value: DecimalInput }
  | { type: "fixed"; value: DecimalInput };

export type DepositRule =
  | { type: "default_rate"; defaultRate?: DecimalInput; lockedAmount?: DecimalInput | null }
  | { type: "custom_rate"; rate: DecimalInput; lockedAmount?: DecimalInput | null }
  | { type: "custom_amount"; amount: DecimalInput; lockedAmount?: DecimalInput | null }
  | { type: "waived"; lockedAmount?: DecimalInput | null };

export type PlatformSnapshotInput = {
  name?: string | null;
  orderRef?: string | null;
  payoutStatus?: "not_applicable" | "pending" | "received";
  actualPayout?: DecimalInput | null;
};

export type OrderCalculationItemInput = {
  key: string;
  itemType: OrderItemType;
  itemStatus?: OrderItemStatus;
  displayOrder?: number;
  servicePlanId?: string | null;
  itemName: string;
  durationMinutes?: number | null;
  standardUnitPrice?: DecimalInput;
  customUnitPrice?: DecimalInput | null;
  chargedUnitPrice: DecimalInput;
  quantity?: DecimalInput;
  serviceDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  specifiedTimeNote?: string | null;
  assignedSitterId?: number | null;
  providerType?: ProviderType;
  commissionRate?: DecimalInput | null;
  sitterAllocationAmount?: DecimalInput | null;
  companyAllocationAmount?: DecimalInput | null;
  homeVisitExecutionMode?: "pinyu_self" | "sitter_independent" | "training" | "custom" | null;
  allocationNote?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
};

export type OrderCalculationInput = {
  items: OrderCalculationItemInput[];
  discount?: DiscountRule;
  deposit?: DepositRule;
  platform?: PlatformSnapshotInput | null;
};

export type CalculatedOrderItem = {
  key: string;
  itemType: OrderItemType;
  itemStatus: OrderItemStatus;
  displayOrder: number;
  servicePlanId: string | null;
  itemNameSnapshot: string;
  durationMinutesSnapshot: number | null;
  standardUnitPriceSnapshot: number;
  customUnitPrice: number | null;
  chargedUnitPrice: number;
  quantity: number;
  lineAmount: number;
  serviceDate: string | null;
  startTime: string | null;
  endTime: string | null;
  specifiedTimeNote: string | null;
  assignedSitterId: number | null;
  providerTypeSnapshot: ProviderType;
  commissionRateSnapshot: number | null;
  commissionBaseAmount: number;
  companyShareAmount: number;
  sitterEarningsAmount: number;
  companyDiscountAbsorbedAmount: number;
  homeVisitExecutionMode: OrderCalculationItemInput["homeVisitExecutionMode"];
  allocationNote: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
};

export type OrderCalculationResult = {
  calculationVersion: string;
  items: CalculatedOrderItem[];
  serviceSubtotal: number;
  travelFeeTotal: number;
  homeVisitFeeTotal: number;
  tipTotal: number;
  totalBeforeDiscount: number;
  discountType: DiscountRule["type"];
  discountValue: number;
  discountAmount: number;
  customerTotal: number;
  depositRuleType: DepositRule["type"];
  depositRateSnapshot: number | null;
  customDepositAmount: number | null;
  suggestedDepositAmount: number;
  depositAmountDue: number;
  balanceAmountDue: number;
  suggestedAdditionalDeposit: number;
  ownerEarningsTotal: number;
  sitterEarningsTotal: number;
  companyServiceShareTotal: number;
  companyDiscountAbsorbed: number;
  companyEarningsBeforePlatform: number;
  platformName: string | null;
  platformOrderRef: string | null;
  platformPayoutStatus: "not_applicable" | "pending" | "received";
  platformActualPayout: number | null;
  platformDifference: number | null;
  warnings: string[];
};

type InternalItem = CalculatedOrderItem & {
  lineUnits: bigint;
  companyShareUnits: bigint;
  sitterEarningsUnits: bigint;
  discountUnits: bigint;
};

function parseScaled(value: DecimalInput, scale: bigint, field: string): bigint {
  const source = typeof value === "number" ? value.toString() : value.trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(source)) throw new Error(`${field} must be a finite decimal`);
  const negative = source.startsWith("-");
  const unsigned = negative ? source.slice(1) : source;
  const [whole, fraction = ""] = unsigned.split(".");
  const scaleDigits = scale.toString().length - 1;
  const padded = (fraction + "0".repeat(scaleDigits + 1)).slice(0, scaleDigits + 1);
  const kept = padded.slice(0, scaleDigits) || "0";
  const roundDigit = Number(padded[scaleDigits] || "0");
  let units = BigInt(whole) * scale + BigInt(kept);
  if (roundDigit >= 5) units += 1n;
  return negative ? -units : units;
}

function moneyUnits(value: DecimalInput, field: string): bigint {
  return parseScaled(value, MONEY_SCALE, field);
}

function rateUnits(value: DecimalInput, field: string): bigint {
  const units = parseScaled(value, RATE_SCALE, field);
  if (units < 0n || units > RATE_SCALE) throw new Error(`${field} must be between 0 and 1`);
  return units;
}

function divideRounded(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error("denominator must be positive");
  if (numerator < 0n) return -divideRounded(-numerator, denominator);
  return (numerator + denominator / 2n) / denominator;
}

function multiplyMoneyByRate(amount: bigint, rate: bigint): bigint {
  return divideRounded(amount * rate, RATE_SCALE);
}

function toNumber(units: bigint): number {
  return Number(units) / Number(MONEY_SCALE);
}

function optionalMoney(value: DecimalInput | null | undefined, field: string): bigint | null {
  return value === null || value === undefined ? null : moneyUnits(value, field);
}

function assertNonnegative(value: bigint, field: string): void {
  if (value < 0n) throw new Error(`${field} cannot be negative`);
}

function assertItemBasics(item: OrderCalculationItemInput): void {
  if (!item.key.trim()) throw new Error("item key is required");
  if (!item.itemName.trim()) throw new Error(`${item.key}.itemName is required`);
  if (item.itemType === "service" && !item.serviceDate) {
    throw new Error(`${item.key}.serviceDate is required for a service item`);
  }
  if (item.durationMinutes !== null && item.durationMinutes !== undefined && item.durationMinutes < 0) {
    throw new Error(`${item.key}.durationMinutes cannot be negative`);
  }
}

function calculateAllocation(
  item: OrderCalculationItemInput,
  lineUnits: bigint,
  providerType: ProviderType,
  status: OrderItemStatus,
  warnings: string[],
): { commissionRate: bigint | null; commissionBase: bigint; companyShare: bigint; sitterEarnings: bigint } {
  if (status === "cancelled") {
    return { commissionRate: null, commissionBase: 0n, companyShare: 0n, sitterEarnings: 0n };
  }

  if (item.itemType === "service") {
    if (providerType === "owner") {
      if (!item.assignedSitterId) throw new Error(`${item.key}.assignedSitterId is required`);
      return { commissionRate: null, commissionBase: lineUnits, companyShare: 0n, sitterEarnings: lineUnits };
    }
    if (providerType === "sitter") {
      if (!item.assignedSitterId) throw new Error(`${item.key}.assignedSitterId is required`);
      if (item.commissionRate === null || item.commissionRate === undefined) {
        throw new Error(`${item.key}.commissionRate is required for a collaborating sitter`);
      }
      const commissionRate = rateUnits(item.commissionRate, `${item.key}.commissionRate`);
      const companyShare = multiplyMoneyByRate(lineUnits, commissionRate);
      return {
        commissionRate,
        commissionBase: lineUnits,
        companyShare,
        sitterEarnings: lineUnits - companyShare,
      };
    }
    warnings.push(`${item.key}: sitter is not assigned; the full line is provisionally allocated to the company`);
    return { commissionRate: null, commissionBase: lineUnits, companyShare: lineUnits, sitterEarnings: 0n };
  }

  if (item.itemType === "tip") {
    if (providerType === "unassigned" || !item.assignedSitterId) {
      throw new Error(`${item.key}: tip requires the actual recipient sitter`);
    }
    const requestedCompany = optionalMoney(item.companyAllocationAmount, `${item.key}.companyAllocationAmount`);
    if (requestedCompany !== null && requestedCompany !== 0n) {
      throw new Error(`${item.key}: tip is 100% assigned to the actual sitter`);
    }
    const requestedSitter = optionalMoney(item.sitterAllocationAmount, `${item.key}.sitterAllocationAmount`);
    if (requestedSitter !== null && requestedSitter !== lineUnits) {
      throw new Error(`${item.key}: tip sitter allocation must equal the full tip`);
    }
    return { commissionRate: null, commissionBase: 0n, companyShare: 0n, sitterEarnings: lineUnits };
  }

  const sitterAllocation = optionalMoney(item.sitterAllocationAmount, `${item.key}.sitterAllocationAmount`);
  const companyAllocation = optionalMoney(item.companyAllocationAmount, `${item.key}.companyAllocationAmount`);
  if (sitterAllocation === null || companyAllocation === null) {
    throw new Error(`${item.key}: travel and home-visit allocations must be explicitly saved`);
  }
  assertNonnegative(sitterAllocation, `${item.key}.sitterAllocationAmount`);
  assertNonnegative(companyAllocation, `${item.key}.companyAllocationAmount`);
  if (sitterAllocation + companyAllocation !== lineUnits) {
    throw new Error(`${item.key}: sitter and company allocations must equal the line amount`);
  }
  if (sitterAllocation > 0n && (providerType === "unassigned" || !item.assignedSitterId)) {
    throw new Error(`${item.key}: a positive sitter allocation requires an assigned sitter`);
  }
  return {
    commissionRate: null,
    commissionBase: 0n,
    companyShare: companyAllocation,
    sitterEarnings: sitterAllocation,
  };
}

function calculateDiscount(serviceSubtotal: bigint, discount: DiscountRule): { value: bigint; amount: bigint } {
  if (discount.type === "none") return { value: 0n, amount: 0n };
  if (discount.type === "rate") {
    const payRate = rateUnits(discount.value, "discount.value");
    return { value: payRate, amount: serviceSubtotal - multiplyMoneyByRate(serviceSubtotal, payRate) };
  }
  const fixed = moneyUnits(discount.value, "discount.value");
  assertNonnegative(fixed, "discount.value");
  if (fixed > serviceSubtotal) throw new Error("fixed discount cannot exceed the active service subtotal");
  return { value: fixed, amount: fixed };
}

function allocateDiscount(items: InternalItem[], serviceSubtotal: bigint, discountAmount: bigint): void {
  const services = items.filter((item) => item.itemStatus === "active" && item.itemType === "service");
  if (!services.length || discountAmount === 0n) return;
  let remaining = discountAmount;
  services.forEach((item, index) => {
    const proportional = index === services.length - 1
      ? remaining
      : divideRounded(item.lineUnits * discountAmount, serviceSubtotal);
    const allocated = proportional > remaining ? remaining : proportional;
    item.discountUnits = allocated;
    item.companyDiscountAbsorbedAmount = toNumber(allocated);
    remaining -= allocated;
  });
}

function calculateDeposit(
  rule: DepositRule,
  depositBase: bigint,
  customerTotal: bigint,
  warnings: string[],
): {
  rate: bigint | null;
  customAmount: bigint | null;
  suggested: bigint;
  due: bigint;
  balance: bigint;
  additional: bigint;
} {
  let rate: bigint | null = null;
  let customAmount: bigint | null = null;
  let suggested = 0n;

  if (rule.type === "default_rate") {
    rate = rateUnits(rule.defaultRate ?? 0.5, "deposit.defaultRate");
    suggested = multiplyMoneyByRate(depositBase, rate);
  } else if (rule.type === "custom_rate") {
    rate = rateUnits(rule.rate, "deposit.rate");
    suggested = multiplyMoneyByRate(depositBase, rate);
  } else if (rule.type === "custom_amount") {
    customAmount = moneyUnits(rule.amount, "deposit.amount");
    assertNonnegative(customAmount, "deposit.amount");
    if (customAmount > depositBase) throw new Error("custom deposit cannot exceed the current deposit base");
    suggested = customAmount;
  }

  const locked = optionalMoney(rule.lockedAmount, "deposit.lockedAmount");
  if (locked !== null) assertNonnegative(locked, "deposit.lockedAmount");
  const due = locked ?? suggested;
  if (due > customerTotal) warnings.push("locked deposit is greater than the current customer total");
  return {
    rate,
    customAmount,
    suggested,
    due,
    balance: customerTotal > due ? customerTotal - due : 0n,
    additional: locked === null || suggested <= locked ? 0n : suggested - locked,
  };
}

export function calculateOrder(input: OrderCalculationInput): OrderCalculationResult {
  if (!Array.isArray(input.items) || input.items.length === 0) throw new Error("at least one order item is required");
  const seenKeys = new Set<string>();
  const warnings: string[] = [];

  const items: InternalItem[] = input.items.map((item, index) => {
    assertItemBasics(item);
    if (seenKeys.has(item.key)) throw new Error(`duplicate item key: ${item.key}`);
    seenKeys.add(item.key);
    const status = item.itemStatus ?? "active";
    const providerType = item.providerType ?? "unassigned";
    const unitUnits = moneyUnits(item.chargedUnitPrice, `${item.key}.chargedUnitPrice`);
    const standardUnits = moneyUnits(item.standardUnitPrice ?? item.chargedUnitPrice, `${item.key}.standardUnitPrice`);
    const customUnits = optionalMoney(item.customUnitPrice, `${item.key}.customUnitPrice`);
    const quantityUnits = moneyUnits(item.quantity ?? 1, `${item.key}.quantity`);
    assertNonnegative(unitUnits, `${item.key}.chargedUnitPrice`);
    assertNonnegative(standardUnits, `${item.key}.standardUnitPrice`);
    if (customUnits !== null) assertNonnegative(customUnits, `${item.key}.customUnitPrice`);
    if (quantityUnits <= 0n) throw new Error(`${item.key}.quantity must be positive`);
    const lineUnits = divideRounded(unitUnits * quantityUnits, MONEY_SCALE);
    const allocation = calculateAllocation(item, lineUnits, providerType, status, warnings);
    return {
      key: item.key,
      itemType: item.itemType,
      itemStatus: status,
      displayOrder: item.displayOrder ?? index,
      servicePlanId: item.servicePlanId ?? null,
      itemNameSnapshot: item.itemName.trim(),
      durationMinutesSnapshot: item.durationMinutes ?? null,
      standardUnitPriceSnapshot: toNumber(standardUnits),
      customUnitPrice: customUnits === null ? null : toNumber(customUnits),
      chargedUnitPrice: toNumber(unitUnits),
      quantity: toNumber(quantityUnits),
      lineAmount: status === "active" ? toNumber(lineUnits) : toNumber(lineUnits),
      serviceDate: item.serviceDate ?? null,
      startTime: item.startTime ?? null,
      endTime: item.endTime ?? null,
      specifiedTimeNote: item.specifiedTimeNote ?? null,
      assignedSitterId: item.assignedSitterId ?? null,
      providerTypeSnapshot: providerType,
      commissionRateSnapshot: allocation.commissionRate === null
        ? null
        : Number(allocation.commissionRate) / Number(RATE_SCALE),
      commissionBaseAmount: toNumber(allocation.commissionBase),
      companyShareAmount: toNumber(allocation.companyShare),
      sitterEarningsAmount: toNumber(allocation.sitterEarnings),
      companyDiscountAbsorbedAmount: 0,
      homeVisitExecutionMode: item.homeVisitExecutionMode ?? null,
      allocationNote: item.allocationNote ?? null,
      cancelledAt: status === "cancelled" ? item.cancelledAt ?? null : null,
      cancellationReason: status === "cancelled" ? item.cancellationReason ?? null : null,
      lineUnits: status === "active" ? lineUnits : 0n,
      companyShareUnits: allocation.companyShare,
      sitterEarningsUnits: allocation.sitterEarnings,
      discountUnits: 0n,
    };
  });

  const sumByType = (type: OrderItemType): bigint => items
    .filter((item) => item.itemStatus === "active" && item.itemType === type)
    .reduce((sum, item) => sum + item.lineUnits, 0n);
  const serviceSubtotal = sumByType("service");
  const travelFeeTotal = sumByType("travel_fee");
  const homeVisitFeeTotal = sumByType("home_visit_fee");
  const tipTotal = sumByType("tip");
  const totalBeforeDiscount = serviceSubtotal + travelFeeTotal + homeVisitFeeTotal + tipTotal;
  const discount = input.discount ?? { type: "none" as const };
  const calculatedDiscount = calculateDiscount(serviceSubtotal, discount);
  allocateDiscount(items, serviceSubtotal, calculatedDiscount.amount);
  const customerTotal = totalBeforeDiscount - calculatedDiscount.amount;

  const ownerEarnings = items
    .filter((item) => item.itemStatus === "active" && item.providerTypeSnapshot === "owner")
    .reduce((sum, item) => sum + item.sitterEarningsUnits, 0n);
  const sitterEarnings = items
    .filter((item) => item.itemStatus === "active" && item.providerTypeSnapshot === "sitter")
    .reduce((sum, item) => sum + item.sitterEarningsUnits, 0n);
  const companyServiceShare = items
    .filter((item) => item.itemStatus === "active" && item.itemType === "service")
    .reduce((sum, item) => sum + item.companyShareUnits, 0n);
  const companyAllShares = items
    .filter((item) => item.itemStatus === "active")
    .reduce((sum, item) => sum + item.companyShareUnits, 0n);
  const companyEarnings = ownerEarnings + companyAllShares - calculatedDiscount.amount;

  const depositRule = input.deposit ?? { type: "default_rate" as const, defaultRate: 0.5 };
  const deposit = calculateDeposit(depositRule, customerTotal - tipTotal, customerTotal, warnings);
  const platform = input.platform ?? null;
  const platformStatus = platform?.payoutStatus ?? "not_applicable";
  const actualPlatformUnits = optionalMoney(platform?.actualPayout, "platform.actualPayout");
  if (actualPlatformUnits !== null) assertNonnegative(actualPlatformUnits, "platform.actualPayout");

  return {
    calculationVersion: ORDER_CALCULATION_VERSION,
    items: items.map(({ lineUnits: _line, companyShareUnits: _company, sitterEarningsUnits: _sitter, discountUnits: _discount, ...item }) => item),
    serviceSubtotal: toNumber(serviceSubtotal),
    travelFeeTotal: toNumber(travelFeeTotal),
    homeVisitFeeTotal: toNumber(homeVisitFeeTotal),
    tipTotal: toNumber(tipTotal),
    totalBeforeDiscount: toNumber(totalBeforeDiscount),
    discountType: discount.type,
    discountValue: discount.type === "none"
      ? 0
      : discount.type === "rate"
        ? Number(calculatedDiscount.value) / Number(RATE_SCALE)
        : toNumber(calculatedDiscount.value),
    discountAmount: toNumber(calculatedDiscount.amount),
    customerTotal: toNumber(customerTotal),
    depositRuleType: depositRule.type,
    depositRateSnapshot: deposit.rate === null ? null : Number(deposit.rate) / Number(RATE_SCALE),
    customDepositAmount: deposit.customAmount === null ? null : toNumber(deposit.customAmount),
    suggestedDepositAmount: toNumber(deposit.suggested),
    depositAmountDue: toNumber(deposit.due),
    balanceAmountDue: toNumber(deposit.balance),
    suggestedAdditionalDeposit: toNumber(deposit.additional),
    ownerEarningsTotal: toNumber(ownerEarnings),
    sitterEarningsTotal: toNumber(sitterEarnings),
    companyServiceShareTotal: toNumber(companyServiceShare),
    companyDiscountAbsorbed: toNumber(calculatedDiscount.amount),
    companyEarningsBeforePlatform: toNumber(companyEarnings),
    platformName: platform?.name?.trim() || null,
    platformOrderRef: platform?.orderRef?.trim() || null,
    platformPayoutStatus: platformStatus,
    platformActualPayout: actualPlatformUnits === null ? null : toNumber(actualPlatformUnits),
    platformDifference: actualPlatformUnits === null ? null : toNumber(customerTotal - actualPlatformUnits),
    warnings,
  };
}
