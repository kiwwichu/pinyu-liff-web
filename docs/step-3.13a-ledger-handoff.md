# Step 3.13A — Dev ledger integration (2026-09-10)

## Status

Code and offline verification implemented. Migration remains an **unexecuted draft**.
Do not deploy, push, commit, apply SQL, or treat this as live Dev acceptance.
No Excel import, historical order cleanup, notification, payroll, or report export.

Pinyu confirmed on 2026-09-10: discount only the service subtotal; never discount
travel/home-visit/tip. Collaborating sitter receives 80% of pre-discount service fees
(the existing engine's commissionRate=0.2 is the COMPANY share). Travel/home-visit
use explicit allocation; tip goes 100% to the actual performer. Existing engine is
unchanged. Excel AD113/#REF and whole-total discount formulas are not financial inputs.

## Data contract

| Value | Source | Must not be mistaken for |
|---|---|---|
| Customer receivable | orders.customer_total, reconciled with V2 items | Cash collected |
| External sitter earnings | sitter_earnings_total | Money already paid to sitter |
| Owner execution earnings | owner_earnings_total | An extra amount to add to company income |
| Company/owner income before platform | company_earnings_before_platform (already includes owner ONCE) | Actual cash / final platform-adjusted profit |
| Customer net paid | payments receipt minus refunds | Platform payout |
| Platform settlement net | platform_settlements receipts/refunds/signed adjustments | Customer-paid amount |
| Actual cash net | direct customer events + platform settlements | Customer receipts held by platform |
| Receivable minus net paid | Signed reconciliation difference | Automatic refund entitlement or cancellation fee |

All API amounts are decimal strings, four fractional digits. No per-entry whole-TWD
rounding or legacy Excel multiplier. Cash month uses Asia/Taipei UTC+08; refunds use
the actual occurrence month. Empty ledger means no recorded events, not proof of no
real-world payment. Missing RPC/schema is an error, never a fabricated zero balance.

Existing manual payment_status, platform_actual_payout, deposit_amount_due and
balance_amount_due stay separate snapshots. This phase does not automatically
transition them or the order status. Cancelling/repricing an order does not invent
refunds, rewrite events, or change already-recorded cash. Platform name at recording
is retained in the ledger table even when the order header changes later.

## Integration

- Existing POST Admin dispatcher: getOrderLedgerV2 / appendOrderLedgerV2.
- Existing verified LINE login + active app_users Owner/Admin authorization.
- Read needs can_view_money; append additionally needs can_edit_orders.
- Both operations require development AND the existing explicit Dev project URL.
- Supabase adapter invokes get_order_ledger_v2 / append_order_ledger_v2.
- Order detail lazily opens the ledger panel; missing migration does not break the
  existing getOrderV2 route. No write form appears if read fails.
- User explicitly enters actual event time, method, amount and refund/adjustment
  reason, then confirms reconciliation. No money amount comes from order form input.
- Retry uses the SAME UUID and frozen payload after an uncertain response.
  Reopening/reloading after uncertainty requires reviewing that request ID before
  recording anything new; no cross-reload durable client retry queue in this phase.

## SQL draft review

supabase/migrations/20260909183359_add_order_financial_ledgers.sql now contains the
additive draft (previously empty). Never run a blanket migration apply yet.

- One order_financial_entries table with distinct stream discriminator; no new data
  copied from orders, wallet_transactions, Excel, or historical snapshots.
- FK to orders and recording actor; platform name snapshot for historical provenance.
- RLS enabled, public/anon/authenticated denied; service_role select/insert only.
- SECURITY INVOKER RPCs, empty search_path, explicit EXECUTE ACL.
- RPC additionally verifies active Owner/Admin and money/edit permissions.
- Append obtains the same order row lock as existing V2 saves; checks model version,
  expected updated_at (microseconds preserved), platform membership and reconciliation.
- Unique request_id; identical actor/event retry is idempotent; conflicting reuse
  rejects. Does not silently accept a mismatched payload.
- UPDATE/DELETE trigger rejects ledger mutation. Separate negative events preserve history.
- Read projects current order financial snapshot and event stream in one statement.
- No UPDATE of orders/order_items, no changes to existing RPCs, no backfill or DROP.

Remaining verification after explicit authorization: PostgreSQL execution/constraints,
FK/RLS/ACL tests, concurrent same/different-key retries, append-vs-order-edit races,
rollback checks, and real Dev RPC smoke. Static tests/mocks are NOT proof these work.

## Verification completed

- npm.cmd run typecheck — PASS.
- npm.cmd run test:orders — PASS (existing Step 3.10–3.12 calculation/Admin boundaries).
- node scripts/test-availability-core.mjs — PASS, 10 cases.
- npm.cmd run test:ledger — PASS, 19 tests, including all requested fee boundaries,
  owner double-count prevention, platform separation, refund/month edges, exact decimals,
  invalid calendar/#REF rejection, access gates, actual Admin handler with mocked
  outbound LINE/Supabase, and SQL static contract checks.
- node scripts/smoke-order-ledger-ui.mjs — PASS, headless Chrome + localhost +
  synthetic mock API. Retry identity, locked fields, refreshed totals, read-only panel,
  escaping and missing-migration behavior.
- node --check for both modified/new Admin UI modules — PASS.
- First browser attempt timed out in restricted launch; re-run with the established
  headless flags and approved local execution passed. Temporary browser profiles removed.
- No live database, migration application, remote business rows, or real PII used.

## Changed files (11, attributable to this round)

1. src/order-ledger.ts
2. src/order-ledger-service.ts
3. src/admin.ts
4. src/database.types.ts (draft RPC type declarations only; not regenerated from DB)
5. admin/order-ledger-ui.js
6. admin/order-v2-ui.js
7. supabase/migrations/20260909183359_add_order_financial_ledgers.sql
8. scripts/test-order-ledger.mjs
9. scripts/smoke-order-ledger-ui.mjs
10. package.json (test:ledger script only; no dependency installation)
11. docs/step-3.13a-ledger-handoff.md

Existing dirty worktree preserved. No Production/Dev business data, Supabase schema,
Excel, migration history, deployment, commit or push changed.
