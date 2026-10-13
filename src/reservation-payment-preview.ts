import { moneyText, moneyUnits } from './order-ledger';

/** Advisory only. No reservation, status update, zero payment, or automatic money confirmation.
 * A future atomic RPC must re-read ledger and policy while holding the shared order lock.
 * An exception must be an explicitly approved per-order condition, not just customerType=returning.
 */
export function reservationPaymentPreview(input:{customerType:string;customerTotal:string;customerNetPaid:string;approvedReturningRequirement:string|null}) {
  const total=moneyUnits(input.customerTotal),paid=moneyUnits(input.customerNetPaid);
  if(total<0n)throw new Error('應收金額不可為負');
  let required=total;
  if(input.customerType==='returning') {
    if(input.approvedReturningRequirement===null)return {status:'needs_individual_terms',requiredAmount:null,shortfall:null,canReserve:false};
    required=moneyUnits(input.approvedReturningRequirement);
    if(required<0n||required>total)throw new Error('個別付款條件不正確');
  } else if(input.customerType!=='new') return {status:'needs_customer_type',requiredAmount:null,shortfall:null,canReserve:false};
  const shortfall=required>paid?required-paid:0n;
  return {status:shortfall>0n?'insufficient_recorded_payment':'awaiting_manual_atomic_confirmation',requiredAmount:moneyText(required),shortfall:moneyText(shortfall),canReserve:false};
}
