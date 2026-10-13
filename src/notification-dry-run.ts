/** Isolated synthetic simulator, NOT a production delivery service or durable outbox.
 * No fetch, credentials, templates, scheduler, or real LINE IDs are accepted here. */
export type DryRunActor = { role: string; canSendNotifications: boolean };
export type SyntheticBinding = { familyId: string; recipientId: string; status: string; enabled: boolean };
export type DryRunEvent = { eventId: string; familyId: string; orderFamilyId: string; templateVersion: string };
type Result = { recipient: string; status: 'accepted' | 'failed'; attempts: number };

function synthetic(value: string) {
  if (!/^synthetic-[a-z0-9-]{1,100}$/.test(value)) throw new Error('Synthetic identifiers required');
}

export function resolveDryRunRecipients(actor: DryRunActor, event: DryRunEvent, bindings: readonly SyntheticBinding[]) {
  if (!['OWNER', 'ADMIN'].includes(actor.role) || !actor.canSendNotifications) throw new Error('Notification access denied');
  synthetic(event.familyId); synthetic(event.orderFamilyId); synthetic(event.eventId); synthetic(event.templateVersion);
  if (event.familyId !== event.orderFamilyId) throw new Error('Cross-family event denied');
  const recipients = new Set<string>();
  for (const binding of bindings) {
    // The future server adapter must derive orderFamilyId from the authorized order.
    if (binding.familyId !== event.familyId || binding.status !== 'bound' || !binding.enabled) continue;
    synthetic(binding.recipientId);
    recipients.add(binding.recipientId);
  }
  return [...recipients].sort();
}

/** Memory lasts only for this explicitly-created simulation. Never claim durable idempotency. */
export function createNotificationDryRun() {
  const events = new Map<string, { fingerprint: string; results: Result[] }>();
  return {
    run(actor: DryRunActor, event: DryRunEvent, bindings: readonly SyntheticBinding[],
      responses: Readonly<Record<string, { status: number; accepted: boolean }>> = {}) {
      const recipients = resolveDryRunRecipients(actor, event, bindings);
      const fingerprint = JSON.stringify([event.familyId, event.orderFamilyId, event.templateVersion, recipients]);
      let state = events.get(event.eventId);
      if (state && state.fingerprint !== fingerprint) throw new Error('Dry-run key/payload or recipients changed; explicit review required');
      if (!state) {
        state = { fingerprint, results: recipients.map((_, i) => ({ recipient: `recipient-${i + 1}`, status: 'failed', attempts: 0 })) };
        events.set(event.eventId, state);
      }
      state.results.forEach((result, i) => {
        if (result.status === 'accepted') return;
        result.attempts++;
        const response = responses[recipients[i]];
        result.status = response && response.status >= 200 && response.status < 300 && response.accepted === true ? 'accepted' : 'failed';
      });
      const accepted = state.results.filter(r => r.status === 'accepted').length;
      return {
        dryRun: true, durable: false, sentToLine: false,
        status: state.results.length === 0 ? 'no_recipients' : accepted === state.results.length ? 'accepted' : accepted ? 'partial' : 'failed',
        results: state.results.map(r => ({ ...r })),
      };
    },
  };
}
