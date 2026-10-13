# Step 3.13B Dev sitter ledger / Admin checkpoint — 2026-09-12

HANDOFF_STATUS: READY_FOR_CHATGPT
HANDOFF_ID: step-3.13b-sitter-ledger-admin-20260912-e86b0d37e0ae432b984dc7e6ed9a2930

## Scope and result

Partial; Step 3.13B is NOT complete. Continue the same milestone after the four reporting decisions currently with Pinyu. This checkpoint supersedes the prior draft-only status; do not reapply the sitter migration. Scope remains Dev-only, no deploy/commit/push, no historical backfill, no actual PII or LINE sends.

Sources: latest CURRENT and its 2026-09-12 ChatGPT evidence review, common memory and Roadmap; Pinyu's actual user messages authorizing specified Dev migration, last-service-month order counts, net customer family spending, and platform-only net company income. The four new reporting questions were sent directly to ChatGPT (thread “追蹤 Plus 開放 Astra”), reviewed there and recorded in CURRENT/Roadmap. Suggestions are NOT Pinyu decisions.

## Dev migration and verification

- Target confirmed pet-sitter-dev / zzkdmenxlucgxirwxayb, ACTIVE_HEALTHY, PostgreSQL 17.6.
- Original approved SHA256: 1CABE00B12988111077717D8640CA9394FF70A1BAA052D58BF089F7A16BB3179.
- Only DRAFT_ONLY guard removed; applied SHA256: 927FF883BB3FBCEFFFB373F5822B4248D0887139C9CB8B1EDCD9C22775DA61DA.
- Applied successfully as remote 20260912045136_draft_sitter_payment_ledger. Migration history 20 → 21. Local filename timestamp differs; no history repair/reapply.
- Added sitter_payment_entries, four FK indexes, RLS, immutable UPDATE/DELETE trigger, private security-invoker append_sitter_payment_v2. Service role SELECT/INSERT and RPC execute; anon/authenticated denied; service UPDATE/DELETE/TRUNCATE denied.
- Existing SQL header remains historical draft wording intentionally: only guard removal was authorized; this checkpoint records the actual approval/apply state.
- Real SQL RPC tests: 13 groups PASS, including append (also under actual SET LOCAL ROLE service_role), same-key stale-CAS replay once, five payload mismatches, actor denial, order/item CAS, invalid amounts, partial-payment reason, 300+500 across two payment months, immutable snapshots, mutation rejection and changed-sitter fail-closed behavior.
- Real SQL role tests: 7 groups PASS (anon/authenticated table/RPC denied; service UPDATE/DELETE denied; nonexistent actor rejected).
- First fixture attempt used an explicit generated-always sitter ID and failed; transaction rolled back. Fixture corrected to generated ID RETURNING, no migration/schema workaround.
- Concurrency: attempted two MCP SQL transactions with advisory lock plus delayed try-lock. Did NOT establish overlapping sessions; contender acquired lock, so this is NOT a concurrency pass or proof of a race. A safely isolated real concurrent-RPC harness remains unverified. Do not claim full live E2E.
- Cleanup readback: orders 104, order_items 0, sitter_payment_entries 0, order_financial_entries 0, synthetic actors 0, synthetic sitters 0. Main SQL also compared old-order content hash before/after. All synthetic transactions rolled back; schema retained.

## Implementation completed this increment

- Backend getSitterPaymentV2 / appendSitterPaymentV2 use verified Owner/Admin actor, Dev target and money/edit permissions. Client cannot choose payee, actor or remuneration snapshot. Write keeps exact CAS timestamps; RPC captures immutable financial source.
- Read returns minimal financial identifiers, due/current snapshot and actual payment history. Missing/truncated histories fail, not fake zero. Changed/cancelled source produces review flag and null payable difference; historical payee remains intact. No separate sitter-facing finance access was added.
- Desktop finance navigation and mobile “我的” secondary entry lead to 保母結算／合作報酬. Select V2 order/item, read due and actual history, manually confirm past payment. No actual transfer, no batch payout.
- Lost response keeps the exact request ID/payload, locks selectors/inputs and allows readback. Exact validation failures can be corrected; CAS/source/review/key failures cannot be blindly retried. Successful writes are read back before updating payment history.
- Customer/platform ledger error classification distinguishes validation, source change, key conflict, permission, review and unknown outcome. Only exact P0001 known messages classified; raw DB errors not returned/logged.
- Financial export basis (pure function only): separate per-order receivable, receipts, refunds, customer net paid, sitter due snapshot, company snapshot, actual cash and platform settlement. Taipei cash-month and family net-spending totals tested. No cancellation/order-count policy chosen, no settlement-completion inference or platform fee estimate.
- Notification synthetic tests remain passing; latest ChatGPT checkpoint permits synthetic dry-run/fake-transport scope and defers durable outbox, actual event/trigger/templates and binding-change retry policy. No real notification system claimed.

## Tests and self-review

PASS:
- npm.cmd run typecheck
- npm.cmd run test:ledger (19)
- npm.cmd run test:orders (calculation and V2 boundaries)
- node scripts/test-availability-core.mjs (10)
- node --test scripts/test-step313b.mjs (13)
- node --test scripts/test-sitter-payment.mjs (5)
- node --test scripts/test-sitter-payment-admin.mjs (1 integrated handler test, HTTP dependencies mocked)
- node --test scripts/test-finance-export-basis.mjs (2)
- node scripts/smoke-order-ledger-ui.mjs (1440 and 390 widths, real headless browser with local synthetic/mock API). Existing ledger recovery plus new sitter retries, editable validation rejection, CAS stays blocked and permission UI.
- JS syntax checks, git diff --check (existing CRLF warnings only).

Self-review fixed the case where readback could re-enable retries after a known source rejection. Finance read uses explicit count and rejects incomplete results; no accidental customer/sitter payment mixing, no client-trusted actor/payee, no ordinary external-platform 80% fee logic added. Worker API type reference uses installed workers-types 5.20260823.1 fallback; no new bindings/config.

Not verified / not finished:
- Real simultaneous RPC contention, deployed HTTP/UI end-to-end, full Admin navigation smoke (panel interactions tested only).
- Full financial server report query, completed XLSX writer/download/readback/format verification; financial basis is NOT a downloadable report.
- All required monthly/order/family/sitter aggregate tables, sitter-facing finance summary, notification Admin dry-run integration beyond the existing isolated simulator.
- New customer full-payment reservation workflow is not newly enforced by this increment; existing calculation tests do not prove that lifecycle policy.
- No build/deploy dry-run performed in this increment; no actual deployment.

## Genuine reporting decisions — already routed to ChatGPT

1. Whether whole cancelled orders count in family/monthly order counts.
2. Whether cancelled items are excluded when finding last service date for partial-cancel cross-month reports.
3. Per-sitter order count: unique participating orders or service-item visits.
4. Per-sitter month: own last valid service date or entire order's last service date.

ChatGPT reviewed existing common memory/Roadmap/confirmed pages and found no explicit decisions. Do not select its recommendations for Pinyu. Already approved last-service-month / family net-payment / specified migration rules must not be reasked.

Immediate next: receive Pinyu's four decisions via ChatGPT/CURRENT, then continue this same milestone from report query/XLSX and remaining integration/acceptance gaps; do not reapply migration or start 3.13C. Resolve real concurrency validation without bypassing tool restrictions or committing synthetic business fixtures outside authorized rollback scope.

## Attributable changed files (20)

- supabase/migrations/20260912045136_draft_sitter_payment_ledger.sql
- src/admin.ts
- src/database.types.ts
- src/order-ledger-service.ts
- src/ledger-failure.ts
- src/sitter-payment-service.ts
- src/sitter-payment-read.ts
- src/finance-export-basis.ts
- admin/app.js
- admin/index.html
- admin/order-ledger-ui.js
- admin/sitter-finance-ui.js
- scripts/test-step313b.mjs
- scripts/test-sitter-payment.mjs
- scripts/test-sitter-payment-admin.mjs
- scripts/test-finance-export-basis.mjs
- scripts/smoke-order-ledger-ui.mjs
- scripts/verify-sitter-payment-rpc.sql
- scripts/verify-sitter-payment-acl.sql
- docs/step-3.13b-dev-sitter-ledger-checkpoint.md

Preexisting large dirty/untracked worktree retained. Git's total diff includes unrelated earlier changes and is not this increment's diff. No stage/reset or cleanup of unrelated files.

## Safety

Production queried/changed: NO.
Supabase schema changed: YES, only the explicitly approved Dev migration above.
Migration executed: YES, exactly specified sitter ledger; no others/history repair.
Dev deployed / formal deploy: NO.
Commit / push: NO / NO.
Old orders backfill/cleanup/rewrite: NO.
Formal Excel changed: NO.
Real PII / real LINE sends / formal scheduler enabled: NO / NO / NO.
Synthetic business cleanup: PASS, rollback and zero readback.
Step complete: NO.
Pinyu confirmation needed: YES, four reporting decisions, already asked by ChatGPT.
