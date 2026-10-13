import crypto from 'node:crypto';
import {PLATFORMS,verifyEnvelope} from './policy.mjs';
export async function recordMarketObservation(db,envelope,key){
 const o=verifyEnvelope(envelope,key,'content-control:pod:market');
 let url;try{url=new URL(o.source_url);}catch{throw Error('MARKET_SOURCE_INVALID');}
 if(!PLATFORMS.includes(o.platform)||url.protocol!=='https:'||url.username||url.password||
  !/^[A-Z]{2}$/.test(o.country)||typeof o.category!=='string'||!o.category||
  !Number.isFinite(Date.parse(o.observed_at))||Date.parse(o.observed_at)>Date.now()||
  !/^[a-f0-9]{64}$/.test(o.source_sha256)||o.collection_authorized!==true)throw Error('MARKET_EVIDENCE_INVALID');
 if(o.price_minor!=null&&(!Number.isSafeInteger(o.price_minor)||o.price_minor<0||!/^[A-Z]{3}$/.test(o.currency||'')))throw Error('PRICE_EVIDENCE_INVALID');
 if(o.observed_rank!=null&&(!Number.isInteger(o.observed_rank)||o.observed_rank<=0||!o.rank_evidence_sha256))throw Error('RANK_EVIDENCE_INVALID');
 return db.tx(async c=>{
  const r=await c.query(`INSERT INTO pod_market_intelligence(id,platform,source_url,observed_at,country,category,image_sha256,price_minor,currency,observed_rank,source_sha256,observations)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(platform,source_url,observed_at) DO NOTHING RETURNING id`,
   [crypto.randomUUID(),o.platform,o.source_url,o.observed_at,o.country,o.category,o.image_sha256||null,o.price_minor??null,o.currency||null,o.observed_rank??null,o.source_sha256,o.observations||{}]);
  return {inserted:r.rowCount===1,id:r.rows[0]?.id||null};
 });
}
