import crypto from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {PLATFORMS,verifyEnvelope} from './policy.mjs';
import {assertStoredEvidence} from './stored-evidence.mjs';
import {validEvidenceTime} from './evidence-time.mjs';
import {validPostgresText} from './text-identity.mjs';
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function validObservationJson(value){
 const pending=[value];
 while(pending.length){
  const current=pending.pop();
  if(typeof current==='string'){if(!validPostgresText(current))return false;continue;}
  if(Array.isArray(current)){pending.push(...current);continue;}
  if(current&&typeof current==='object'){
   for(const [key,nested] of Object.entries(current)){
    if(!validPostgresText(key))return false;
    pending.push(nested);
   }
  }
 }
 return true;
}
export async function recordMarketObservation(db,envelope,key){
 const o=verifyEnvelope(envelope,key,'content-control:pod:market');
 if(!validPostgresText(o.source_url))throw Error('MARKET_SOURCE_INVALID');
 let url;try{url=new URL(o.source_url);}catch{throw Error('MARKET_SOURCE_INVALID');}
 if(!PLATFORMS.includes(o.platform)||url.protocol!=='https:'||url.username||url.password||
  (typeof o.country!=='string'||!/^[A-Z]{2}$/.test(o.country))||!validPostgresText(o.category)||!o.category||
  !validEvidenceTime(o.observed_at)||
  !hash(o.source_sha256)||o.collection_authorized!==true)throw Error('MARKET_EVIDENCE_INVALID');
 if(o.price_minor!=null&&(!Number.isSafeInteger(o.price_minor)||o.price_minor<0||typeof o.currency!=='string'||!/^[A-Z]{3}$/.test(o.currency)))throw Error('PRICE_EVIDENCE_INVALID');
 if(o.observed_rank!=null&&(!Number.isInteger(o.observed_rank)||o.observed_rank<=0||o.observed_rank>2147483647||!hash(o.rank_evidence_sha256)))throw Error('RANK_EVIDENCE_INVALID');
 if(o.observed_rank==null&&o.rank_evidence_sha256!=null)throw Error('RANK_EVIDENCE_INVALID');
 if((o.image_sha256!=null&&!hash(o.image_sha256))||
  (o.observations!=null&&(typeof o.observations!=='object'||Array.isArray(o.observations)||!validObservationJson(o.observations))))throw Error('MARKET_EVIDENCE_INVALID');
 if(o.price_minor==null&&o.currency!=null)throw Error('PRICE_EVIDENCE_INVALID');
 const observations=o.observations??{};
 return db.tx(async c=>{
  // Evidence blobs are immutable. Do not persist unresolvable proof references.
  const hashes=[...new Set([o.source_sha256,o.image_sha256,o.rank_evidence_sha256].filter(v=>v!=null))];
  await assertStoredEvidence(c,hashes,'MARKET_EVIDENCE_MISSING');
  db.active();
  const r=await c.query(`INSERT INTO pod_market_intelligence(id,platform,source_url,observed_at,country,category,image_sha256,price_minor,currency,observed_rank,source_sha256,observations,rank_evidence_sha256)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(platform,source_url,observed_at) DO NOTHING RETURNING id`,
   [crypto.randomUUID(),o.platform,o.source_url,o.observed_at,o.country,o.category,o.image_sha256??null,o.price_minor??null,o.currency??null,o.observed_rank??null,o.source_sha256,observations,o.rank_evidence_sha256??null]);
  db.active();
  if(r.rowCount===1){verifyEnvelope(envelope,key,'content-control:pod:market');return {inserted:true,id:r.rows[0].id};}
  // ON CONFLICT waits for concurrent writers. A following statement sees the
  // committed immutable row; refreshed envelope times do not change its identity.
  const previous=(await c.query('SELECT * FROM pod_market_intelligence WHERE platform=$1 AND source_url=$2 AND observed_at=$3',[o.platform,o.source_url,o.observed_at])).rows[0];
  db.active();
  if(!previous||!['country','category','image_sha256','currency','observed_rank','source_sha256','rank_evidence_sha256'].every(k=>(previous[k]??null)===(o[k]??null))||
   (previous.price_minor==null?null:String(previous.price_minor))!==(o.price_minor==null?null:String(o.price_minor))||
   !isDeepStrictEqual(previous.observations,observations))throw Error('MARKET_REPLAY_CONFLICT');
  verifyEnvelope(envelope,key,'content-control:pod:market');
  return {inserted:false,id:previous.id};
 });
}

