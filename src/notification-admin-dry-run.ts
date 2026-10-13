import { createNotificationDryRun, type DryRunActor } from './notification-dry-run';
/** A complete isolated simulation per request. Accepts no recipient, template, or order payload. */
export function notificationAdminDryRun(actor:DryRunActor,env:Pick<Env,'APP_ENV'|'SUPABASE_URL'>) {
  if(env.APP_ENV!=='development'||new URL(env.SUPABASE_URL).origin!=='https://zzkdmenxlucgxirwxayb.supabase.co') throw new Error('通知模擬僅限指定 Dev');
  const simulator=createNotificationDryRun();
  const event={eventId:'synthetic-event',familyId:'synthetic-family',orderFamilyId:'synthetic-family',templateVersion:'synthetic-v1'};
  const bindings=['synthetic-member-a','synthetic-member-b'].map(recipientId=>({familyId:event.familyId,recipientId,status:'bound',enabled:true}));
  const first=simulator.run(actor,event,bindings,{'synthetic-member-a':{status:200,accepted:true},'synthetic-member-b':{status:503,accepted:false}});
  const retry=simulator.run(actor,event,bindings,{'synthetic-member-b':{status:200,accepted:true}});
  return {first,retry,boundary:'純 synthetic；未送 LINE、未建立 outbox 或正式通知紀錄；冪等僅限本次模擬，不代表正式通知已完成'};
}
