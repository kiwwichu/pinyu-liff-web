import assert from 'node:assert/strict';
import { test } from 'node:test';
import { financeServiceCounts } from '../src/finance-service-counts.ts';
const item = (id, date, sitter = 1, extra = {}) => ({ id, serviceDate: date, assignedSitterId: sitter, itemType: 'service', itemStatus: 'active', ...extra });
const order = (items, extra = {}) => ({ orderId: 'synthetic-order', familyId: 'synthetic-family', orderStatus: 'confirmed', items, ...extra });
test('visits count once regardless of minutes/quantity; five daily or ten twice-daily visits', () => {
  for (const size of [1, 5, 10]) {
    const items = Array.from({length:size}, (_, i) => item(`i${i}`, `2026-09-${String(1 + (size === 10 ? Math.floor(i/2) : i)).padStart(2,'0')}`, 1, {durationMinutes: i % 2 ? 30 : 120, quantity: 4}));
    const source = [order(items)], before = structuredClone(source), result = financeServiceCounts(source);
    assert.equal(result.orders[0].serviceCount, size); assert.equal(result.sitters[0].serviceCount, size); assert.deepEqual(source, before);
  }
});
test('partial cancellation excludes final date; fees do not count; sitter months use own last date', () => {
  const result = financeServiceCounts([order([item('a','2026-08-31',1), item('b','2026-09-01',2), item('c','2026-10-01',1,{itemStatus:'cancelled'}), item('d','2026-11-01',1,{itemType:'home_visit_fee'}), item('e',null,1,{itemType:'travel_fee'}), item('f',null,1,{itemType:'tip'})])]);
  assert.deepEqual(result.monthly, [{month:'2026-09', serviceCount:2}]);
  assert.deepEqual(result.sitterMonths,[{sitterId:1,month:'2026-08',serviceCount:1},{sitterId:2,month:'2026-09',serviceCount:1}]);
});
test('whole cancellation and all-cancelled have zero counts and no service month', () => {
  for (const source of [order([item('a',null)],{orderStatus:'cancelled'}),order([item('a',null,1,{itemStatus:'cancelled'})])]) {
    const result=financeServiceCounts([source]);assert.equal(result.orders[0].serviceCount,0);assert.equal(result.orders[0].serviceMonth,null);assert.deepEqual(result.monthly,[]);
  }
});
test('multi-family aggregation, unassigned kept separate, same sitter grouped across orders', () => {
  const result=financeServiceCounts([order([item('a','2026-09-01',null)]),order([item('b','2026-09-02')],{orderId:'b',familyId:'f2'}),order([item('c','2026-09-03')],{orderId:'c',familyId:'f2'})]);
  assert.equal(result.orders[0].unassignedServiceCount,1);assert.deepEqual(result.sitters,[{sitterId:1,serviceCount:2}]);assert.equal(result.monthly[0].serviceCount,3);assert.equal(result.families.find(x=>x.familyId==='f2').serviceCount,2);
});
test('empty succeeds; missing dates, impossible dates, unknown types/status, duplicate sources fail closed', () => {
  assert.deepEqual(financeServiceCounts([]).orders,[]);
  for(const date of [null,'2026-02-30','2026-13-01']) assert.throws(()=>financeServiceCounts([order([item('a',date)])]));
  for(const extra of [{itemStatus:'unknown'},{itemType:'unknown'},{assignedSitterId:NaN},{assignedSitterId:[1,2]}]) assert.throws(()=>financeServiceCounts([order([item('a','2026-09-01',1,extra)])]));
  assert.throws(()=>financeServiceCounts([order([]),order([])]));assert.throws(()=>financeServiceCounts([order([item('a','2026-09-01'),item('a','2026-09-01')])]));
});
