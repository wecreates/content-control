import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';

const MAGIC=Buffer.from('CYZPOD1\n'),MAX_OBJECT=16777216,MAX_CATALOG=2097152,MAX_ITEMS=10000;
const TYPES=new Set(['image/png','application/pdf','application/json','font/ttf']);
const digest=body=>crypto.createHash('sha256').update(body).digest('hex');
function config(directory,key,budgetBytes){
 if(typeof directory!=='string'||!path.isAbsolute(directory)||!Buffer.isBuffer(key)||key.length!==32||
  !Number.isSafeInteger(budgetBytes)||budgetBytes<1||budgetBytes>134217728)throw Error('ARCHIVE_CONFIG_INVALID');
}
function seal(body,key,aad){
 const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
 cipher.setAAD(Buffer.from(aad));const data=Buffer.concat([cipher.update(body),cipher.final()]);
 return Buffer.concat([MAGIC,iv,cipher.getAuthTag(),data]);
}
function unseal(body,key,aad){
 if(body.length<36||!body.subarray(0,8).equals(MAGIC))throw Error('ARCHIVE_INVALID');
 const cipher=crypto.createDecipheriv('aes-256-gcm',key,body.subarray(8,20));
 cipher.setAAD(Buffer.from(aad));cipher.setAuthTag(body.subarray(20,36));
 try{return Buffer.concat([cipher.update(body.subarray(36)),cipher.final()]);}catch{throw Error('ARCHIVE_AUTH_FAILED');}
}
async function readBounded(file,max){
 const handle=await fs.open(file,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{
  const stat=await handle.stat();if(!stat.isFile()||stat.size>max||stat.size<36)throw Error('ARCHIVE_SIZE_INVALID');
  const body=Buffer.alloc(stat.size);let offset=0;
  while(offset<body.length){const {bytesRead}=await handle.read(body,offset,body.length-offset,null);if(!bytesRead)throw Error('ARCHIVE_TRUNCATED');offset+=bytesRead;}
  if((await handle.read(Buffer.alloc(1),0,1,null)).bytesRead)throw Error('ARCHIVE_SIZE_INVALID');
  return body;
 }finally{await handle.close();}
}
async function writeNew(file,body){
 const handle=await fs.open(file,'wx',0o600);
 try{await handle.writeFile(body);await handle.sync();}finally{await handle.close();}
}
const aad=item=>`pod:artifact:v1:${item.sha256}:${item.media_type}:${item.bytes}`;

// Reads only the dedicated artifact table, never queue envelopes or the social vault.
// A repeatable-read snapshot keeps the final catalog tied to the exported bytes.
export async function exportArtifactLibrary(db,{directory,key,budgetBytes=134217728,signal}={}){
 config(directory,key,budgetBytes);signal?.throwIfAborted();
 await fs.mkdir(directory,{mode:0o700}); // No overwrite or reuse of an existing directory.
 const client=await db.pool.connect();const items=[];let bytes=0;
 try{
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await client.query("SET LOCAL statement_timeout='10s'");
  await client.query('DECLARE pod_artifact_export NO SCROLL CURSOR FOR SELECT sha256,media_type,body FROM public.pod_artifacts ORDER BY sha256');
  while(true){
   signal?.throwIfAborted();const {rows}=await client.query('FETCH FORWARD 1 FROM pod_artifact_export');if(!rows.length)break;
   const row=rows[0];
   if(!Buffer.isBuffer(row.body)||!row.body.length||row.body.length>MAX_OBJECT||digest(row.body)!==row.sha256||!TYPES.has(row.media_type))throw Error('ARCHIVE_ARTIFACT_INVALID');
   bytes+=row.body.length;if(bytes>budgetBytes||items.length>=MAX_ITEMS)throw Error('ARCHIVE_BUDGET_EXCEEDED');
   const item={sha256:row.sha256,media_type:row.media_type,bytes:row.body.length};
   await writeNew(path.join(directory,item.sha256+'.pod'),seal(row.body,key,aad(item)));items.push(item);
  }
  const catalog=Buffer.from(JSON.stringify({schema_version:1,scope:'artifacts_only',created_at:new Date().toISOString(),items}));
  if(catalog.length>MAX_CATALOG)throw Error('ARCHIVE_CATALOG_TOO_LARGE');
  await client.query('COMMIT');signal?.throwIfAborted();
  // Written last: an interrupted export without this catalog is not restorable.
  await writeNew(path.join(directory,'catalog.pod'),seal(catalog,key,'pod:artifact-catalog:v1'));
  const dirHandle=await fs.open(directory,'r');try{await dirHandle.sync();}finally{await dirHandle.close();}
  return {status:'EXPORTED',scope:'artifacts_only',objects:items.length,bytes,publication_enabled:false};
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
 finally{client.release();}
}

export async function restoreArtifactLibrary(db,{directory,key,budgetBytes=134217728,env=process.env,signal}={}){
 config(directory,key,budgetBytes);signal?.throwIfAborted();
 if(env.PUBLICATION_ENABLED!=='false'||env.POD_PUBLICATION_ENABLED!=='false')throw Error('ARCHIVE_PUBLICATION_MUST_BE_DISABLED');
 const catalog=JSON.parse(unseal(await readBounded(path.join(directory,'catalog.pod'),MAX_CATALOG+36),key,'pod:artifact-catalog:v1'));
 if(catalog?.schema_version!==1||catalog.scope!=='artifacts_only'||!Array.isArray(catalog.items)||catalog.items.length>MAX_ITEMS)throw Error('ARCHIVE_CATALOG_INVALID');
 const seen=new Set();let bytes=0;
 for(const item of catalog.items){
  if(typeof item?.sha256!=='string'||!/^[a-f0-9]{64}$/.test(item.sha256)||seen.has(item.sha256)||!TYPES.has(item.media_type)||
   !Number.isSafeInteger(item.bytes)||item.bytes<1||item.bytes>MAX_OBJECT)throw Error('ARCHIVE_CATALOG_INVALID');
  seen.add(item.sha256);bytes+=item.bytes;
 }
 if(bytes>budgetBytes)throw Error('ARCHIVE_BUDGET_EXCEEDED');
 return db.tx(async client=>{
  await client.query('SELECT pg_advisory_xact_lock($1)',[543211]);
  let used=BigInt((await client.query('SELECT COALESCE(sum(octet_length(body)),0)::text AS bytes FROM public.pod_artifacts')).rows[0].bytes),inserted=0;
  for(const item of catalog.items){
   signal?.throwIfAborted();
   const body=unseal(await readBounded(path.join(directory,item.sha256+'.pod'),MAX_OBJECT+36),key,aad(item));
   if(body.length!==item.bytes||digest(body)!==item.sha256)throw Error('ARCHIVE_ARTIFACT_INVALID');
   const existing=(await client.query('SELECT body,media_type FROM public.pod_artifacts WHERE sha256=$1',[item.sha256])).rows[0];
   if(existing){if(existing.media_type!==item.media_type||!Buffer.isBuffer(existing.body)||!existing.body.equals(body))throw Error('ARCHIVE_RESTORE_CONFLICT');continue;}
   used+=BigInt(body.length);if(used>BigInt(budgetBytes))throw Error('ARCHIVE_BUDGET_EXCEEDED');
   await client.query('INSERT INTO public.pod_artifacts(sha256,body,media_type) VALUES($1,$2,$3)',[item.sha256,body,item.media_type]);inserted++;
  }
  signal?.throwIfAborted();
  if(env.PUBLICATION_ENABLED!=='false'||env.POD_PUBLICATION_ENABLED!=='false')throw Error('ARCHIVE_PUBLICATION_MUST_BE_DISABLED');
  return {status:'RESTORED',scope:'artifacts_only',objects:catalog.items.length,inserted,bytes,publication_enabled:false};
 });
}
