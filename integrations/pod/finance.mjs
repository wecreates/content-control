import crypto from 'node:crypto';
import {verifyEnvelope} from './policy.mjs';

export async function recordFinancialEvent(db,envelope,key){
 const e=verifyEnvelope(envelope,key,'content-control:pod:finance');
 if(e.verified!==true||!['authority_event_id','provider_event_id','provider','job_id'].every(k=>typeof e[k]==='string'&&e[k].trim().length>0&&e[k].length<=256)||
  !Number.isSafeInteger(e.amount_minor)||!['royalty','refund','fee','production_cost','generation_cost','tax','adjustment'].includes(e.kind)||
  !/^[A-Z]{3}$/.test(e.currency)||typeof e.occurred_at!=='string'||!Number.isFinite(Date.parse(e.occurred_at))||Date.parse(e.occurred_at)>Date.now()||
  typeof e.evidence_sha256!=='string'||!/^[a-f0-9]{64}$/.test(e.evidence_sha256))throw Error('FINANCIAL_EVIDENCE_REQUIRED');
 if((e.kind==='royalty'&&e.amount_minor<0)||(['refund','fee','production_cost','generation_cost','tax'].includes(e.kind)&&e.amount_minor>0))throw Error('FINANCIAL_SIGN_INVALID');
 return db.tx(async c=>{
  const id=crypto.randomUUID();
  const result=await c.query(`INSERT INTO pod_financial_events(id,job_id,provider,provider_event_id,kind,amount_minor,currency,occurred_at,evidence_sha256,authority_event_id)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING RETURNING id`,
   [id,e.job_id,e.provider,e.provider_event_id,e.kind,e.amount_minor,e.currency,e.occurred_at,e.evidence_sha256,e.authority_event_id]);
  if(!result.rowCount){
   // Both identities must resolve to exactly the same immutable event. A new
   // provider ID cannot turn one authoritative event into additional income.
   const matches=(await c.query('SELECT * FROM pod_financial_events WHERE (provider=$1 AND provider_event_id=$2) OR authority_event_id=$3',[e.provider,e.provider_event_id,e.authority_event_id])).rows;
   const previous=matches[0];
   if(matches.length!==1||!['job_id','provider','provider_event_id','kind','currency','evidence_sha256','authority_event_id'].every(k=>previous[k]===e[k])||
    String(previous.amount_minor)!==String(e.amount_minor)||Date.parse(previous.occurred_at)!==Date.parse(e.occurred_at))throw Error('FINANCIAL_REPLAY_CONFLICT');
   return {id:previous.id,duplicate:true};
  }
  await c.query('INSERT INTO pod_events(id,job_id,kind,payload) VALUES($1,$2,$3,$4)',[crypto.randomUUID(),e.job_id,'pod.finance.verified',{financial_event_id:id,authority_event_id:e.authority_event_id}]);
  return {id,duplicate:false};
 });
}
export async function financialTotals(db){
 db.active();
 return (await db.pool.query(`SELECT currency,sum(amount_minor)::text AS verified_net_recorded_minor,count(*)::text AS evidence_count
  FROM pod_financial_events GROUP BY currency ORDER BY currency`)).rows;
}
