import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createNotificationDryRun, resolveDryRunRecipients } from '../src/notification-dry-run.ts';
import { calculateOrder } from '../src/order-calculation.ts';
import { summarizeOrderLedger } from '../src/order-ledger.ts';

const actor = { role: 'OWNER', canSendNotifications: true };
const event = { eventId: 'synthetic-event', familyId: 'synthetic-family', orderFamilyId: 'synthetic-family', templateVersion: 'synthetic-template-v1' };
const binding = (recipientId, extra = {}) => ({ familyId: event.familyId, recipientId, status: 'bound', enabled: true, ...extra });
const bindings = [binding('synthetic-a'), binding('synthetic-b'), binding('synthetic-a'),
  binding('synthetic-c', { enabled: false }), binding('synthetic-d', { status: 'unbound' }),
  binding('synthetic-other', { familyId: 'synthetic-other-family' })];

test('all bound enabled members, deduplicated; no single-user assumption', () => {
  assert.deepEqual(resolveDryRunRecipients(actor, event, bindings), ['synthetic-a', 'synthetic-b']);
});
for (const role of ['SITTER', 'MEMBER', 'PUBLIC']) test(`${role} cannot simulate other-family notifications`, () => {
  assert.throws(() => resolveDryRunRecipients({ ...actor, role }, event, bindings), /denied/);
});
test('permission, relation, and synthetic boundary fail closed', () => {
  assert.throws(() => resolveDryRunRecipients({ ...actor, canSendNotifications: false }, event, bindings), /denied/);
  assert.throws(() => resolveDryRunRecipients(actor, { ...event, orderFamilyId: 'synthetic-other' }, bindings), /Cross-family/);
  assert.throws(() => resolveDryRunRecipients(actor, event, [binding('not-a-synthetic-identifier')]), /Synthetic/);
});
test('fake response checked per recipient; retry only failed; caller cannot mutate stored results', () => {
  const simulator = createNotificationDryRun();
  const first = simulator.run(actor, event, bindings, {
    'synthetic-a': { status: 200, accepted: true }, 'synthetic-b': { status: 503, accepted: true },
  });
  assert.equal(first.status, 'partial'); assert.equal(first.sentToLine, false); assert.equal(first.durable, false);
  assert.ok(!JSON.stringify(first).includes('synthetic-a'));
  first.results[0].attempts = 100;
  const second = simulator.run(actor, event, bindings, { 'synthetic-b': { status: 200, accepted: true } });
  assert.equal(second.status, 'accepted'); assert.deepEqual(second.results.map(r => r.attempts), [1, 2]);
  assert.deepEqual(simulator.run(actor, event, bindings).results, second.results);
});
test('HTTP 200 with negative response is failure, empty is not success', () => {
  assert.equal(createNotificationDryRun().run(actor, event, [bindings[0]], { 'synthetic-a': { status: 200, accepted: false } }).status, 'failed');
  assert.equal(createNotificationDryRun().run(actor, event, []).status, 'no_recipients');
});
test('same event with changed template/family/recipient set cannot silently retry', () => {
  const s = createNotificationDryRun(); s.run(actor, event, bindings);
  assert.throws(() => s.run(actor, { ...event, templateVersion: 'synthetic-v2' }, bindings), /changed/);
  assert.throws(() => s.run(actor, event, [bindings[0]]), /changed/);
  assert.throws(() => s.run(actor, { ...event, familyId: 'synthetic-f2', orderFamilyId: 'synthetic-f2' }, []), /changed/);
});
test('simulation has no persistent idempotency or network claim', () => {
  assert.equal(createNotificationDryRun().run(actor, event, bindings).results[0].attempts, 1);
  assert.equal(createNotificationDryRun().run(actor, event, bindings).results[0].attempts, 1);
  const source = readFileSync(new URL('../src/notification-dry-run.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bfetch\s*\(|https:\/\/api\.line/);
});

for (const [label, deposit, amounts] of [
  ['full amount', { type: 'custom_amount', amount: 1000 }, ['1000']],
  ['repeat deposit and balance', { type: 'default_rate', defaultRate: 0.5 }, ['500', '500']],
  ['waived deposit is not a zero payment', { type: 'waived' }, []],
]) test(`ledger projection: ${label} (not order-confirmation policy)`, () => {
  const c = calculateOrder({ items: [{ key: 'synthetic-service', itemType: 'service', itemName: 'Synthetic',
    serviceDate: '2026-09-12', chargedUnitPrice: 1000, quantity: 1, providerType: 'sitter', assignedSitterId: 2, commissionRate: 0.2 }], deposit });
  const order = { orderId: 'synthetic-order', updatedAt: '2026-09-12T00:00:00Z', customerTotal: String(c.customerTotal),
    ownerEarningsTotal: String(c.ownerEarningsTotal), sitterEarningsTotal: String(c.sitterEarningsTotal),
    companyEarningsBeforePlatform: String(c.companyEarningsBeforePlatform), platformName: null };
  const entries = amounts.map((amount, i) => ({ requestId: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
    orderId: order.orderId, ledger: 'payments', kind: 'receipt', amount, occurredAt: '2026-09-12T00:00:00Z', channel: 'direct', method: 'synthetic', note: '' }));
  const s = summarizeOrderLedger(order, entries);
  assert.equal(s.entryCount, amounts.length);
  assert.equal(s.customerNetPaid, amounts.length ? '1000.0000' : '0.0000');
  assert.equal(s.sitterEarningsSnapshot, '800.0000'); assert.equal(s.companyIncomeBeforePlatform, '200.0000');
  if (!amounts.length) { assert.equal(c.depositAmountDue, 0); assert.equal(s.receivableLessNetPaid, '1000.0000'); }
});

test('authorized migration hash/ACL/immutable/foreign-key/snapshot checks (NOT SQL execution)', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20260912045136_draft_sitter_payment_ledger.sql', import.meta.url), 'utf8');
  // Pinyu approved this exact draft on 2026-09-12; only DRAFT_ONLY guard was removed.
  // Remote applied version is 20260912045136; local filename is not a reason to reapply.
  assert.equal(createHash('sha256').update(sql).digest('hex'), '927ff883bb3fbcefffb373f5822b4248d0887139c9cb8b1edcd9c22775da61da');
  assert.doesNotMatch(sql, /raise exception 'DRAFT_ONLY/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /grant select, insert on public\.sitter_payment_entries to service_role/);
  assert.match(sql, /before update or delete/);
  assert.doesNotMatch(sql, /security definer|grant[^;]+to (?:anon|authenticated)|\b(?:update|delete from) public\.(?:orders|order_items)\b/i);
  for (const field of ['order_id', 'order_item_id', 'sitter_id_snapshot', 'recorded_by']) {
    assert.match(sql, new RegExp(`create index[^;]+\\(${field}[,)]`));
  }
  assert.ok(sql.indexOf('if found then') < sql.indexOf('p_expected_order_updated_at is null'), 'idempotent retry precedes CAS');
  assert.match(sql, /pg_advisory_xact_lock/); assert.match(sql, /historical payment source changed/);
  assert.match(sql, /difference reason required/);
  const snapshot = sql.slice(sql.indexOf('v_snapshot := jsonb_build_object'), sql.indexOf('if exists (select 1 from public.sitter_payment_entries'));
  assert.doesNotMatch(snapshot, /owner_name|address|phone|line_user_id|allocation_note|item_name|notes/);
});
