import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import {seal,unseal,readBounded,writeNew,syncArchiveDirectory} from './archive-codec.mjs';
import path from 'node:path';
import {artifactBudgetBytes} from './storage-budget.mjs';
import {ARTIFACT_MEDIA_TYPES} from './artifacts.mjs';

const MAX_OBJECT=16777216,MAX_CATALOG=2097152,MAX_ITEMS=10000;
const TYPES=new Set(ARTIFACT_MEDIA_TYPES);
const digest=body=>crypto.createHash('sha256').update(body).digest('hex');
function config(directory,key,budgetBytes){
 if(typeof directory!=='string'||!path.isAbsolute(directory)||!Buffer.isBuffer(key)||key.length!==32||
  !Number.isSafeInteger(budgetBytes)||budgetBytes<1||budgetBytes>134217728)throw Error('ARCHIVE_CONFIG_INVALID');
}
const aad=item=>`pod:artifact:v1:${item.sha256}:${item.media_type}:${item.bytes}`;

async function readCatalog({directory,key,budgetBytes,signal}){
 config(directory,key,budgetBytes);signal?.throwIfAborted();
 if(!(await fs.lstat(directory)).isDirectory())throw Error('ARCHIVE_DIRECTORY_INVALID');
 const encrypted=await readBounded(path.join(directory,'catalog.pod'),MAX_CATALOG+36,signal);
 const catalog=JSON.parse(unseal(encrypted,key,'pod:artifact-catalog:v1'));
 if(catalog?.schema_version!==1||catalog.scope!=='artifacts_only'||!Array.isArray(catalog.items)||catalog.items.length>MAX_ITEMS||
  typeof catalog.created_at!=='string'||!Number.isFinite(Date.parse(catalog.created_at)))throw Error('ARCHIVE_CATALOG_INVALID');
 const seen=new Set();let bytes=0;
 for(const item of catalog.items){
  if(typeof item?.sha256!=='string'||!/^[a-f0-9]{64}$/.test(item.sha256)||seen.has(item.sha256)||!TYPES.has(item.media_type)||
   !Number.isSafeInteger(item.bytes)||item.bytes<1||item.bytes>MAX_OBJECT)throw Error('ARCHIVE_CATALOG_INVALID');
  seen.add(item.sha256);bytes+=item.bytes;
 }
 if(bytes>budgetBytes)throw Error('ARCHIVE_BUDGET_EXCEEDED');
 return {catalog,bytes,archive_sha256:digest(encrypted)};
}
async function readArtifact(item,{directory,key,signal}){
 const body=unseal(await readBounded(path.join(directory,item.sha256+'.pod'),MAX_OBJECT+36,signal),key,aad(item));
 if(body.length!==item.bytes||digest(body)!==item.sha256)throw Error('ARCHIVE_ARTIFACT_INVALID');
 return body;
}
async function verifyItems(catalog,options){
 for(const item of catalog.items)await readArtifact(item,options);
 options.signal?.throwIfAborted();
}

// Offline and read-only: no database, credentials, authority renewal or uploads.
export async function verifyArtifactLibrary({directory,key,budgetBytes=134217728,signal}={}){
 const options={directory,key,budgetBytes,signal};
 const {catalog,bytes,archive_sha256}=await readCatalog(options);
 await verifyItems(catalog,options);
 return {status:'VERIFIED',scope:'artifacts_only',archive_sha256,created_at:catalog.created_at,
  verified_at:new Date().toISOString(),objects:catalog.items.length,bytes,publication_enabled:false};
}

// Reads only the dedicated artifact table, never queue envelopes or the social vault.
// A repeatable-read snapshot keeps the final catalog tied to the exported bytes.
export async function exportArtifactLibrary(db,{directory,key,budgetBytes=134217728,signal}={}){
 config(directory,key,budgetBytes);signal?.throwIfAborted();
 await fs.mkdir(directory,{mode:0o700}); // No overwrite or reuse of an existing directory.
 const client=await db.pool.connect();const items=[];let bytes=0,bad=false;
 try{
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await client.query("SET LOCAL statement_timeout='10s'");
  // Keep invalid rows visible so export fails, but do not transfer an oversized
  // legacy body into the low-memory process before checking its bound.
  await client.query(`DECLARE pod_artifact_export NO SCROLL CURSOR FOR SELECT sha256,media_type,
   CASE WHEN octet_length(body) BETWEEN 1 AND ${MAX_OBJECT} THEN body ELSE NULL END AS body
   FROM public.pod_artifacts ORDER BY sha256`);
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
  await syncArchiveDirectory(directory);
  // Cancellation may arrive while the catalog or directory entries are
  // being flushed. Completed writes do not authorize a success receipt.
  signal?.throwIfAborted();
  return {status:'EXPORTED',scope:'artifacts_only',objects:items.length,bytes,publication_enabled:false};
 }catch(error){
  // An unsuccessful rollback leaves transaction state unknown. Never return
  // that connection to the pool, and preserve the original export failure.
  try{await client.query('ROLLBACK');}catch{bad=true;}throw error;
 }finally{client.release(bad);}
}

export async function restoreArtifactLibrary(db,{directory,key,budgetBytes=134217728,env=process.env,signal}={}){
 config(directory,key,budgetBytes);signal?.throwIfAborted();
 budgetBytes=Math.min(budgetBytes,artifactBudgetBytes(env));
 if(env.PUBLICATION_ENABLED!=='false'||env.POD_PUBLICATION_ENABLED!=='false')throw Error('ARCHIVE_PUBLICATION_MUST_BE_DISABLED');
 const options={directory,key,budgetBytes,signal};
 const {catalog,bytes}=await readCatalog(options);
 // Reject an already broken backup before acquiring a database connection/lock.
 // Read and authenticate again during insertion to catch intervening changes.
 await verifyItems(catalog,options);
 if(env.PUBLICATION_ENABLED!=='false'||env.POD_PUBLICATION_ENABLED!=='false')throw Error('ARCHIVE_PUBLICATION_MUST_BE_DISABLED');
 const restored=await db.tx(async client=>{
  await client.query('SELECT pg_advisory_xact_lock($1)',[543211]);
  let used=BigInt((await client.query('SELECT COALESCE(sum(octet_length(body)),0)::text AS bytes FROM public.pod_artifacts')).rows[0].bytes),inserted=0;
  for(const item of catalog.items){
   signal?.throwIfAborted();
   const body=await readArtifact(item,options);
   // Compare immutable identity in PostgreSQL without downloading existing
   // bytes. A length mismatch also skips hashing an oversized corrupt row.
   const existing=(await client.query(`SELECT media_type,octet_length(body) AS bytes,
    CASE WHEN octet_length(body)=$2 THEN encode(sha256(body),'hex') ELSE NULL END AS body_sha256
    FROM public.pod_artifacts WHERE sha256=$1`,[item.sha256,item.bytes])).rows[0];
   if(existing){if(existing.media_type!==item.media_type||existing.bytes!==item.bytes||existing.body_sha256!==item.sha256)throw Error('ARCHIVE_RESTORE_CONFLICT');continue;}
   used+=BigInt(body.length);if(used>BigInt(budgetBytes))throw Error('ARCHIVE_BUDGET_EXCEEDED');
   await client.query('INSERT INTO public.pod_artifacts(sha256,body,media_type) VALUES($1,$2,$3)',[item.sha256,body,item.media_type]);inserted++;
  }
  signal?.throwIfAborted();
  if(env.PUBLICATION_ENABLED!=='false'||env.POD_PUBLICATION_ENABLED!=='false')throw Error('ARCHIVE_PUBLICATION_MUST_BE_DISABLED');
  return {status:'RESTORED',scope:'artifacts_only',objects:catalog.items.length,inserted,bytes,publication_enabled:false};
 });
 // COMMIT and pool release are asynchronous. A completed transaction cannot
 // be undone here; reject late cancellation/flag changes without claiming rollback.
 signal?.throwIfAborted();
 if(env.PUBLICATION_ENABLED!=='false'||env.POD_PUBLICATION_ENABLED!=='false')throw Error('ARCHIVE_PUBLICATION_MUST_BE_DISABLED');
 return restored;
}

