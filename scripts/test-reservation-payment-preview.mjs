import assert from 'node:assert/strict';
import {test} from 'node:test';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,n){return n(c.parentURL?.startsWith(new URL('../src/',import.meta.url).href)&&s.startsWith('.')&&!/\.[a-z]+$/i.test(s)?s+'.ts':s,c);}});
const {reservationPaymentPreview:p}=await import('../src/reservation-payment-preview.ts');
test('new customer full payment, refunds reduce net, no automatic reservation',()=>{
 const input={customerType:'new',customerTotal:'1000',customerNetPaid:'500',approvedReturningRequirement:'0'};
 assert.deepEqual(p(input),{status:'insufficient_recorded_payment',requiredAmount:'1000.0000',shortfall:'500.0000',canReserve:false});
 assert.equal(p({...input,customerNetPaid:'1000'}).status,'awaiting_manual_atomic_confirmation');
 assert.equal(p({...input,customerNetPaid:'900'}).shortfall,'100.0000');
});
test('returning flag is not exception approval; approved deposit or waived does not create fake payment',()=>{
 const input={customerType:'returning',customerTotal:'1000',customerNetPaid:'0',approvedReturningRequirement:null};
 assert.equal(p(input).status,'needs_individual_terms');
 assert.equal(p({...input,approvedReturningRequirement:'500'}).shortfall,'500.0000');
 assert.equal(p({...input,approvedReturningRequirement:'0'}).status,'awaiting_manual_atomic_confirmation');
 assert.equal(p({...input,approvedReturningRequirement:'0'}).canReserve,false);
 assert.equal(p({...input,customerType:'unknown'}).status,'needs_customer_type');
 assert.throws(()=>p({...input,approvedReturningRequirement:'1001'}));
});
