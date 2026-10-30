import {ARTIFACT_MEDIA_TYPES} from './artifacts.mjs';
import {types as utilTypes} from 'node:util';

const artifactMediaTypes=new Set(ARTIFACT_MEDIA_TYPES);
const EVIDENCE_FIELDS=Object.freeze(['sha256','media_type','body_sha256']);
function dataProperty(target,key){
 try{
  if(target===null||(typeof target!=='object'&&typeof target!=='function')||utilTypes.isProxy(target))return {valid:false};
  let current=target;
  while(current!==null){
   if(utilTypes.isProxy(current))return {valid:false};
   const descriptor=Object.getOwnPropertyDescriptor(current,key);
   if(descriptor)return Object.hasOwn(descriptor,'value')?{valid:true,value:descriptor.value}:{valid:false};
   current=Object.getPrototypeOf(current);
  }
  return {valid:true,value:undefined};
 }catch{return {valid:false};}
}
function snapshotEvidenceRows(result,maxRows){
 const rows=dataProperty(result,'rows');
 if(!rows.valid||!Array.isArray(rows.value)||utilTypes.isProxy(rows.value))throw Error('EVIDENCE_QUERY_UNVERIFIED');
 let length;
 try{
  const descriptor=Object.getOwnPropertyDescriptor(rows.value,'length');
  if(!Object.hasOwn(descriptor||{},'value')||!Number.isInteger(descriptor.value)||descriptor.value<0||descriptor.value>maxRows)throw Error();
  length=descriptor.value;
 }catch{throw Error('EVIDENCE_QUERY_UNVERIFIED');}
 const snapshots=[];
 for(let index=0;index<length;index++){
  let descriptor,row,prototype,keys,descriptors;
  try{
   descriptor=Object.getOwnPropertyDescriptor(rows.value,String(index));
   if(!descriptor||!Object.hasOwn(descriptor,'value'))throw Error();
   row=descriptor.value;
   if(row===null||(typeof row!=='object'&&typeof row!=='function')||utilTypes.isProxy(row))throw Error();
   prototype=Object.getPrototypeOf(row);keys=Reflect.ownKeys(row);descriptors=Object.getOwnPropertyDescriptors(row);
  }catch{throw Error('EVIDENCE_QUERY_UNVERIFIED');}
  if((prototype!==Object.prototype&&prototype!==null)||keys.length!==EVIDENCE_FIELDS.length||
   keys.some(key=>typeof key!=='string'||!EVIDENCE_FIELDS.includes(key)||!descriptors[key]?.enumerable||!Object.hasOwn(descriptors[key],'value')))
   throw Error('EVIDENCE_QUERY_UNVERIFIED');
  snapshots.push(Object.freeze(Object.fromEntries(EVIDENCE_FIELDS.map(field=>[field,descriptors[field].value]))));
 }
 return Object.freeze(snapshots);
}

// Verify proof identity in PostgreSQL; never download evidence bodies merely to
// decide whether an intake/replay can refer to them. Call inside the writer's
// transaction. Artifact immutability prevents changes after verification.
export async function assertStoredEvidence(client,hashes,missingCode='EVIDENCE_ARTIFACT_MISSING'){
 if(!Array.isArray(hashes)||!hashes.length||hashes.length>32||
  hashes.some(sha=>typeof sha!=='string'||!/^[a-f0-9]{64}$/.test(sha)))throw Error('EVIDENCE_ARTIFACT_INVALID');
 const unique=[...new Set(hashes)];
 // Legacy/foreign rows are visible for an explicit media error, but unsupported
 // blobs are not hashed. No evidence body crosses into the application.
 const rows=snapshotEvidenceRows(await client.query(`SELECT sha256,media_type,CASE WHEN media_type=ANY($2::text[])
  THEN encode(sha256(body),'hex') ELSE NULL END AS body_sha256
  FROM pod_artifacts WHERE sha256=ANY($1::text[])`,[unique,ARTIFACT_MEDIA_TYPES]),unique.length);
 if(rows.some(row=>!unique.includes(row.sha256)))throw Error('EVIDENCE_ARTIFACT_CORRUPT');
 if(rows.some(row=>!artifactMediaTypes.has(row.media_type)))throw Error('EVIDENCE_ARTIFACT_MEDIA_INVALID');
 if(!unique.every(sha=>rows.some(row=>row.sha256===sha)))throw Error(missingCode);
 if(rows.some(row=>row.body_sha256!==row.sha256))throw Error('EVIDENCE_ARTIFACT_CORRUPT');
}
