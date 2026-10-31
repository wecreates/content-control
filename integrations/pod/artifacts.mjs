import crypto from 'node:crypto';
import {types as utilTypes} from 'node:util';
export const MAX_PACKAGE_BYTES=64*1024*1024;
export const ARTIFACT_MEDIA_TYPES=Object.freeze([
 'image/png','application/pdf','application/json','font/ttf','text/plain','application/zip',
]);
const artifactMediaTypes=new Set(ARTIFACT_MEDIA_TYPES);
const INSERT_FIELDS=Object.freeze(['body_sha256','media_type','sha256']);
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
function snapshotArtifactInputs(artifacts){
 if(!Array.isArray(artifacts))throw Error('ARTIFACT_BATCH_INVALID');
 if(utilTypes.isProxy(artifacts))throw Error('ARTIFACT_BATCH_UNVERIFIED');
 let length;
 try{
  const descriptor=Object.getOwnPropertyDescriptor(artifacts,'length');
  if(!Object.hasOwn(descriptor||{},'value')||!Number.isInteger(descriptor.value)||descriptor.value<0)throw Error();
  length=descriptor.value;
 }catch{throw Error('ARTIFACT_BATCH_UNVERIFIED');}
 if(length>32)throw Error('ARTIFACT_BATCH_INVALID');
 const result=[];
 for(let index=0;index<length;index++){
  let descriptor;
  try{descriptor=Object.getOwnPropertyDescriptor(artifacts,String(index));}
  catch{throw Error('ARTIFACT_BATCH_UNVERIFIED');}
  if(descriptor&&!Object.hasOwn(descriptor,'value'))throw Error('ARTIFACT_BATCH_UNVERIFIED');
  const artifact=descriptor?.value;
  if(artifact===null||(typeof artifact!=='object'&&typeof artifact!=='function')){
   result.push(Object.freeze({body:undefined,mediaType:undefined}));continue;
  }
  const body=dataProperty(artifact,'body'),mediaType=dataProperty(artifact,'mediaType');
  if(!body.valid||!mediaType.valid||utilTypes.isProxy(body.value))throw Error('ARTIFACT_INPUT_UNVERIFIED');
  result.push(Object.freeze({body:body.value,mediaType:mediaType.value}));
 }
 return Object.freeze(result);
}
function snapshotArtifactRow(result){
 const rows=dataProperty(result,'rows');
 if(!rows.valid||!Array.isArray(rows.value)||utilTypes.isProxy(rows.value))throw Error('ARTIFACT_ROW_UNVERIFIED');
 let descriptor;
 try{descriptor=Object.getOwnPropertyDescriptor(rows.value,'0');}
 catch{throw Error('ARTIFACT_ROW_UNVERIFIED');}
 if(!descriptor)return null;
 if(!Object.hasOwn(descriptor,'value'))throw Error('ARTIFACT_ROW_UNVERIFIED');
 const row=descriptor.value;
 if(row===null||(typeof row!=='object'&&typeof row!=='function'))return Object.freeze({body:undefined,media_type:undefined});
 const body=dataProperty(row,'body'),mediaType=dataProperty(row,'media_type');
 if(!body.valid||!mediaType.valid||utilTypes.isProxy(body.value))throw Error('ARTIFACT_ROW_UNVERIFIED');
 return Object.freeze({body:body.value,media_type:mediaType.value});
}
function snapshotQueryRows(result,fields,{maxRows,exactRows}={}){
 const rows=dataProperty(result,'rows');
 if(!rows.valid||!Array.isArray(rows.value)||utilTypes.isProxy(rows.value))throw Error('ARTIFACT_QUERY_UNVERIFIED');
 let length;
 try{
  const descriptor=Object.getOwnPropertyDescriptor(rows.value,'length');
  if(!Object.hasOwn(descriptor||{},'value')||!Number.isInteger(descriptor.value)||descriptor.value<0)throw Error();
  length=descriptor.value;
 }catch{throw Error('ARTIFACT_QUERY_UNVERIFIED');}
 if((Number.isInteger(maxRows)&&length>maxRows)||(Number.isInteger(exactRows)&&length!==exactRows))throw Error('ARTIFACT_QUERY_UNVERIFIED');
 const snapshots=[];
 for(let index=0;index<length;index++){
  let descriptor;
  try{descriptor=Object.getOwnPropertyDescriptor(rows.value,String(index));}
  catch{throw Error('ARTIFACT_QUERY_UNVERIFIED');}
  if(!descriptor||!Object.hasOwn(descriptor,'value'))throw Error('ARTIFACT_QUERY_UNVERIFIED');
  const row=descriptor.value;
  if(row===null||(typeof row!=='object'&&typeof row!=='function')||utilTypes.isProxy(row))throw Error('ARTIFACT_QUERY_UNVERIFIED');
  const snapshot={};
  for(const field of fields){
   const capability=dataProperty(row,field);
   if(!capability.valid||utilTypes.isProxy(capability.value))throw Error('ARTIFACT_QUERY_UNVERIFIED');
   snapshot[field]=capability.value;
  }
  snapshots.push(Object.freeze(snapshot));
 }
 return Object.freeze(snapshots);
}
function assertArtifactInsert(result,{sha256,mediaType}){
 if(result===null||(typeof result!=='object'&&typeof result!=='function')||utilTypes.isProxy(result))
  throw Error('ARTIFACT_INSERT_UNVERIFIED');
 let countDescriptor,rowsDescriptor,lengthDescriptor,rowDescriptor,row,keys,descriptors,prototype;
 try{
  countDescriptor=Object.getOwnPropertyDescriptor(result,'rowCount');
  rowsDescriptor=Object.getOwnPropertyDescriptor(result,'rows');
  if(!countDescriptor||!Object.hasOwn(countDescriptor,'value')||countDescriptor.value!==1||
   !rowsDescriptor||!Object.hasOwn(rowsDescriptor,'value')||!Array.isArray(rowsDescriptor.value)||utilTypes.isProxy(rowsDescriptor.value))throw Error();
  lengthDescriptor=Object.getOwnPropertyDescriptor(rowsDescriptor.value,'length');
  rowDescriptor=Object.getOwnPropertyDescriptor(rowsDescriptor.value,'0');
  if(!lengthDescriptor||!Object.hasOwn(lengthDescriptor,'value')||lengthDescriptor.value!==1||
   !rowDescriptor?.enumerable||!Object.hasOwn(rowDescriptor,'value'))throw Error();
  row=rowDescriptor.value;
  if(row===null||(typeof row!=='object'&&typeof row!=='function')||utilTypes.isProxy(row))throw Error();
  prototype=Object.getPrototypeOf(row);keys=Reflect.ownKeys(row);descriptors=Object.getOwnPropertyDescriptors(row);
 }catch{throw Error('ARTIFACT_INSERT_UNVERIFIED');}
 if((prototype!==Object.prototype&&prototype!==null)||keys.length!==INSERT_FIELDS.length||
  !INSERT_FIELDS.every(field=>keys.includes(field)&&descriptors[field]?.enumerable&&Object.hasOwn(descriptors[field],'value'))||
  descriptors.sha256.value!==sha256||descriptors.media_type.value!==mediaType||descriptors.body_sha256.value!==sha256)
  throw Error('ARTIFACT_INSERT_UNVERIFIED');
}

// Bounded PostgreSQL backend for the initial free-tier lane. Large libraries must
// use an independently verified durable object-store implementation of this contract.
export class ArtifactStore {
 constructor(db,{budgetBytes=128*1024*1024,maxObjectBytes=16*1024*1024,maxBatchBytes=MAX_PACKAGE_BYTES}={}){
  if(!Number.isSafeInteger(budgetBytes)||budgetBytes<1||!Number.isSafeInteger(maxObjectBytes)||maxObjectBytes<1||maxObjectBytes>16777216||
   !Number.isSafeInteger(maxBatchBytes)||maxBatchBytes<1||maxBatchBytes>MAX_PACKAGE_BYTES)throw Error('ARTIFACT_LIMIT_INVALID');
  Object.assign(this,{db,budgetBytes,maxObjectBytes,maxBatchBytes});
 }
 async put(body,mediaType){
  return (await this.putMany([{body,mediaType}]))[0];
 }
 async putMany(artifacts){
  const inputs=snapshotArtifactInputs(artifacts);
  const unique=new Map(),hashes=[];let total=0;
  for(const {body,mediaType} of inputs){
   if(!Buffer.isBuffer(body)||!body.length||body.length>this.maxObjectBytes||!artifactMediaTypes.has(mediaType))throw Error('ARTIFACT_INVALID');
   total+=body.length;if(total>this.maxBatchBytes)throw Error('ARTIFACT_BATCH_TOO_LARGE');
   // Callers retain ownership of their mutable buffers. Hash and persist one
   // private snapshot so a lock/connection wait cannot separate identity/bytes.
   const snapshot=Buffer.from(body);
   const sha=crypto.createHash('sha256').update(snapshot).digest('hex');hashes.push(sha);
   const previous=unique.get(sha);
   if(previous&&(previous.mediaType!==mediaType||!previous.body.equals(snapshot)))throw Error('ARTIFACT_CONFLICT');
   if(!previous)unique.set(sha,{body:snapshot,mediaType});
  }
  if(!hashes.length)return [];
  return this.db.tx(async c=>{
   await c.query('SELECT pg_advisory_xact_lock($1)',[543211]);
   this.db.active();
   const existing=new Set();
   // Hash presence alone is insufficient: legacy corrupt bytes or conflicting
   // immutable media metadata must not be reported as a successful replay.
   // Compute existing digests in PostgreSQL to avoid fetching duplicate blobs
   // into the low-memory Node process. No pgcrypto extension is required.
   const stored=snapshotQueryRows(await c.query("SELECT sha256,media_type,encode(sha256(body),'hex') AS body_sha256 FROM pod_artifacts WHERE sha256=ANY($1::text[])",[[...unique.keys()]]),
    ['sha256','media_type','body_sha256'],{maxRows:unique.size});
   this.db.active();
   for(const row of stored){
    const expected=unique.get(row.sha256);
    if(!expected||row.media_type!==expected.mediaType||row.body_sha256!==row.sha256)throw Error('ARTIFACT_CONFLICT');
    existing.add(row.sha256);
   }
   const missing=[...unique].filter(([sha])=>!existing.has(sha));
   if(!missing.length)return hashes;
   const usage=snapshotQueryRows(await c.query('SELECT COALESCE(sum(octet_length(body)),0)::text AS bytes FROM pod_artifacts'),
    ['bytes'],{maxRows:1,exactRows:1});
   this.db.active();
   if(typeof usage[0].bytes!=='string'||!/^(?:0|[1-9]\d*)$/.test(usage[0].bytes))throw Error('ARTIFACT_QUERY_INVALID');
   const used=BigInt(usage[0].bytes);
   const needed=missing.reduce((sum,[,artifact])=>sum+BigInt(artifact.body.length),0n);
   if(used+needed>BigInt(this.budgetBytes))throw Error('ARTIFACT_BUDGET_EXHAUSTED');
   for(const [sha,{body,mediaType}] of missing){
    const inserted=await c.query(`INSERT INTO pod_artifacts(sha256,body,media_type) VALUES($1,$2,$3)
     RETURNING sha256,media_type,encode(sha256(body),'hex') AS body_sha256`,[sha,body,mediaType]);
    assertArtifactInsert(inserted,{sha256:sha,mediaType});
    this.db.active();
   }
   return hashes;
  });
 }
 async get(sha){
  this.db.active();if(typeof sha!=='string'||!/^[a-f0-9]{64}$/.test(sha))throw Error('ARTIFACT_HASH_INVALID');
  // Reject oversized legacy/foreign rows in PostgreSQL before their bodies
  // cross into the low-memory process. Apply the same per-object read/write cap.
  const row=snapshotArtifactRow(await this.db.read(`SELECT body,media_type FROM pod_artifacts
   WHERE sha256=$1 AND octet_length(body) BETWEEN 1 AND $2 AND media_type=ANY($3::text[])`,
   [sha,this.maxObjectBytes,ARTIFACT_MEDIA_TYPES]));
  if(!row||!Buffer.isBuffer(row.body)||!row.body.length||row.body.length>this.maxObjectBytes||
   !artifactMediaTypes.has(row.media_type))throw Error('ARTIFACT_UNAVAILABLE');
  const body=Buffer.from(row.body);
  if(crypto.createHash('sha256').update(body).digest('hex')!==sha)throw Error('ARTIFACT_UNAVAILABLE');
  return Object.freeze({body,media_type:row.media_type});
 }
}
