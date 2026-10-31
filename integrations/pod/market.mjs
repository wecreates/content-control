import crypto from 'node:crypto';
import {isDeepStrictEqual,types as utilTypes} from 'node:util';
import {PLATFORMS,verifyEnvelope} from './policy.mjs';
import {assertStoredEvidence} from './stored-evidence.mjs';
import {validEvidenceTime} from './evidence-time.mjs';
import {validPostgresText} from './text-identity.mjs';
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const REPLAY_FIELDS=Object.freeze(['id','country','category','image_sha256','price_minor','currency',
 'observed_rank','source_sha256','observations','rank_evidence_sha256']);
function dataProperty(target,key){
 try{
  if(target===null||(typeof target!=='object'&&typeof target!=='function')||utilTypes.isProxy(target))return {valid:false};
  const descriptor=Object.getOwnPropertyDescriptor(target,key);
  return descriptor&&Object.hasOwn(descriptor,'value')?{valid:true,value:descriptor.value}:{valid:false};
 }catch{return {valid:false};}
}
function ordinaryRecord(value){
 try{
  return value!==null&&(typeof value==='object'||typeof value==='function')&&!utilTypes.isProxy(value)&&
   [Object.prototype,null].includes(Object.getPrototypeOf(value));
 }catch{return false;}
}
function snapshotRows(result,fields,maxRows){
 if(result===null||(typeof result!=='object'&&typeof result!=='function')||utilTypes.isProxy(result))
  throw Error('MARKET_QUERY_UNVERIFIED');
 const rows=dataProperty(result,'rows');
 if(!rows.valid||!Array.isArray(rows.value)||utilTypes.isProxy(rows.value))throw Error('MARKET_QUERY_UNVERIFIED');
 let length;
 try{
  const descriptor=Object.getOwnPropertyDescriptor(rows.value,'length');
  if(!descriptor||!Object.hasOwn(descriptor,'value')||!Number.isInteger(descriptor.value)||descriptor.value<0||
   descriptor.value>maxRows)throw Error();
  length=descriptor.value;
 }catch{throw Error('MARKET_QUERY_UNVERIFIED');}
 const snapshots=[];
 for(let index=0;index<length;index++){
  let element;
  try{element=Object.getOwnPropertyDescriptor(rows.value,String(index));}
  catch{throw Error('MARKET_QUERY_UNVERIFIED');}
  if(!element||!Object.hasOwn(element,'value')||!ordinaryRecord(element.value))throw Error('MARKET_QUERY_UNVERIFIED');
  const snapshot={};
  for(const field of fields){
   const capability=dataProperty(element.value,field);
   if(!capability.valid||utilTypes.isProxy(capability.value))throw Error('MARKET_QUERY_UNVERIFIED');
   snapshot[field]=capability.value;
  }
  snapshots.push(Object.freeze(snapshot));
 }
 return Object.freeze(snapshots);
}
function snapshotInsertResult(result){
 const count=dataProperty(result,'rowCount');
 if(!count.valid||!Number.isSafeInteger(count.value)||count.value<0||count.value>1)
  throw Error('MARKET_QUERY_UNVERIFIED');
 const rows=snapshotRows(result,['id'],1);
 if(rows.length!==count.value||(count.value===1&&!validPostgresText(rows[0].id)))
  throw Error('MARKET_QUERY_UNVERIFIED');
 return Object.freeze({count:count.value,id:rows[0]?.id});
}
function snapshotJson(value,depth=0,state={nodes:0}){
 if(depth>64||++state.nodes>10000)throw Error('MARKET_QUERY_UNVERIFIED');
 const type=typeof value;
 if(value===null||type==='boolean')return value;
 if(type==='string'){
  if(!validPostgresText(value))throw Error('MARKET_QUERY_UNVERIFIED');
  return value;
 }
 if(type==='number'){
  if(!Number.isFinite(value))throw Error('MARKET_QUERY_UNVERIFIED');
  return value;
 }
 if(type!=='object'||utilTypes.isProxy(value))throw Error('MARKET_QUERY_UNVERIFIED');
 let prototype,keys,descriptors;
 try{prototype=Object.getPrototypeOf(value);keys=Reflect.ownKeys(value);descriptors=Object.getOwnPropertyDescriptors(value);}
 catch{throw Error('MARKET_QUERY_UNVERIFIED');}
 if(Array.isArray(value)){
  const length=descriptors.length;
  if(prototype!==Array.prototype||!Object.hasOwn(length||{},'value')||!Number.isInteger(length.value)||
   length.value<0||length.value>10000||keys.length!==length.value+1)throw Error('MARKET_QUERY_UNVERIFIED');
  const copy=[];
  for(let index=0;index<length.value;index++){
   const descriptor=descriptors[String(index)];
   if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value'))throw Error('MARKET_QUERY_UNVERIFIED');
   copy.push(snapshotJson(descriptor.value,depth+1,state));
  }
  return Object.freeze(copy);
 }
 if((prototype!==Object.prototype&&prototype!==null)||keys.length>10000||keys.some(key=>typeof key!=='string'||!validPostgresText(key)))
  throw Error('MARKET_QUERY_UNVERIFIED');
 const copy={};
 for(const key of keys){
  const descriptor=descriptors[key];
  if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value'))throw Error('MARKET_QUERY_UNVERIFIED');
  Object.defineProperty(copy,key,{value:snapshotJson(descriptor.value,depth+1,state),enumerable:true});
 }
 return Object.freeze(copy);
}
function snapshotReplayRows(result){
 return Object.freeze(snapshotRows(result,REPLAY_FIELDS,1).map(row=>{
  const priceValid=row.price_minor===null||Number.isSafeInteger(row.price_minor)&&row.price_minor>=0||
   typeof row.price_minor==='string'&&/^(0|[1-9][0-9]{0,15})$/.test(row.price_minor)&&
    Number.isSafeInteger(Number(row.price_minor));
  if(!validPostgresText(row.id)||!row.id||typeof row.country!=='string'||!/^[A-Z]{2}$/.test(row.country)||
   !validPostgresText(row.category)||!row.category||(row.image_sha256!==null&&!hash(row.image_sha256))||!priceValid||
   !(row.currency===null||typeof row.currency==='string'&&/^[A-Z]{3}$/.test(row.currency))||
   !(row.observed_rank===null||Number.isInteger(row.observed_rank)&&row.observed_rank>0&&row.observed_rank<=2147483647)||
   !hash(row.source_sha256)||(row.rank_evidence_sha256!==null&&!hash(row.rank_evidence_sha256)))
   throw Error('MARKET_QUERY_UNVERIFIED');
  return Object.freeze({...row,observations:snapshotJson(row.observations)});
 }));
}
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
  const inserted=snapshotInsertResult(await c.query(`INSERT INTO pod_market_intelligence(id,platform,source_url,observed_at,country,category,image_sha256,price_minor,currency,observed_rank,source_sha256,observations,rank_evidence_sha256)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(platform,source_url,observed_at) DO NOTHING RETURNING id`,
   [crypto.randomUUID(),o.platform,o.source_url,o.observed_at,o.country,o.category,o.image_sha256??null,o.price_minor??null,o.currency??null,o.observed_rank??null,o.source_sha256,observations,o.rank_evidence_sha256??null]));
  db.active();
  if(inserted.count===1){verifyEnvelope(envelope,key,'content-control:pod:market');return {inserted:true,id:inserted.id};}
  // ON CONFLICT waits for concurrent writers. A following statement sees the
  // committed immutable row; refreshed envelope times do not change its identity.
  const previous=snapshotReplayRows(await c.query(`SELECT id,country,category,image_sha256,price_minor,currency,
   observed_rank,source_sha256,observations,rank_evidence_sha256 FROM pod_market_intelligence
   WHERE platform=$1 AND source_url=$2 AND observed_at=$3`,[o.platform,o.source_url,o.observed_at]))[0];
  db.active();
  if(!previous||!['country','category','image_sha256','currency','observed_rank','source_sha256','rank_evidence_sha256'].every(k=>(previous[k]??null)===(o[k]??null))||
   (previous.price_minor==null?null:String(previous.price_minor))!==(o.price_minor==null?null:String(o.price_minor))||
   !isDeepStrictEqual(previous.observations,observations))throw Error('MARKET_REPLAY_CONFLICT');
  verifyEnvelope(envelope,key,'content-control:pod:market');
  return {inserted:false,id:previous.id};
 });
}

