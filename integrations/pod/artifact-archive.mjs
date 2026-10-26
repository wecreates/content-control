import crypto from 'node:crypto';
import {seal,unseal,parseArchiveJSON,validArchiveTimestamp,readBounded,writeNew,openArchiveDirectory,createArchiveDirectory,
 assertArchiveDirectory,syncArchiveDirectory,closeArchiveDirectory} from './archive-codec.mjs';
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
function assertPublicationDisabled(env){
 if(env.PUBLICATION_ENABLED!=='false'||env.POD_PUBLICATION_ENABLED!=='false')throw Error('ARCHIVE_PUBLICATION_MUST_BE_DISABLED');
}
const aad=item=>`pod:artifact:v1:${item.sha256}:${item.media_type}:${item.bytes}`;

async function readCatalog({directory,key,budgetBytes,signal,base}){
 config(directory,key,budgetBytes);signal?.throwIfAborted();
 const encrypted=await readBounded(path.join(base,'catalog.pod'),MAX_CATALOG+36,signal);
 const catalog=parseArchiveJSON(unseal(encrypted,key,'pod:artifact-catalog:v1'),'ARCHIVE_CATALOG_INVALID');
 if(catalog?.schema_version!==1||catalog.scope!=='artifacts_only'||!Array.isArray(catalog.items)||catalog.items.length>MAX_ITEMS||
  !validArchiveTimestamp(catalog.created_at))throw Error('ARCHIVE_CATALOG_INVALID');
 const seen=new Set();let bytes=0;
 for(const item of catalog.items){
  if(typeof item?.sha256!=='string'||!/^[a-f0-9]{64}$/.test(item.sha256)||seen.has(item.sha256)||!TYPES.has(item.media_type)||
   !Number.isSafeInteger(item.bytes)||item.bytes<1||item.bytes>MAX_OBJECT)throw Error('ARCHIVE_CATALOG_INVALID');
  seen.add(item.sha256);bytes+=item.bytes;
 }
 if(bytes>budgetBytes)throw Error('ARCHIVE_BUDGET_EXCEEDED');
 return {catalog,bytes,archive_sha256:digest(encrypted)};
}
async function readArtifact(item,{base,key,signal}){
 const body=unseal(await readBounded(path.join(base,item.sha256+'.pod'),MAX_OBJECT+36,signal),key,aad(item));
 if(body.length!==item.bytes||digest(body)!==item.sha256)throw Error('ARCHIVE_ARTIFACT_INVALID');
 return body;
}
async function verifyItems(catalog,options){
 for(const item of catalog.items)await readArtifact(item,options);
 options.signal?.throwIfAborted();
}

// Offline and read-only: no database, credentials, authority renewal or uploads.
export async function verifyArtifactLibrary({directory,key,budgetBytes=134217728,signal}={}){
 config(directory,key,budgetBytes);signal?.throwIfAborted();const opened=await openArchiveDirectory(directory);
 try{
  const options={directory,key,budgetBytes,signal,base:opened.base};
  const {catalog,bytes,archive_sha256}=await readCatalog(options);
  await verifyItems(catalog,options);
  await assertArchiveDirectory(directory,opened);
  return {status:'VERIFIED',scope:'artifacts_only',archive_sha256,created_at:catalog.created_at,
   verified_at:new Date().toISOString(),objects:catalog.items.length,bytes,publication_enabled:false};
 }finally{await closeArchiveDirectory(opened);}
}

// Reads only the dedicated artifact table, never queue envelopes or the social vault.
// A repeatable-read snapshot keeps the final catalog tied to the exported bytes.
export async function exportArtifactLibrary(db,{directory,key,budgetBytes=134217728,env=process.env,signal}={}){
 config(directory,key,budgetBytes);signal?.throwIfAborted();assertPublicationDisabled(env);
 const opened=await createArchiveDirectory(directory); // No overwrite or reuse of an existing directory.
 let client;const items=[];let bytes=0,bad=false;
 try{
  client=await db.pool.connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await client.query("SET LOCAL statement_timeout='10s'");
  // Keep invalid rows visible so export fails, but do not transfer an oversized
  // legacy body into the low-memory process before checking its bound.
  await client.query(`DECLARE pod_artifact_export NO SCROLL CURSOR FOR SELECT sha256,media_type,
   CASE WHEN octet_length(body) BETWEEN 1 AND ${MAX_OBJECT} THEN body ELSE NULL END AS body
   FROM public.pod_artifacts ORDER BY sha256`);
  while(true){
   signal?.throwIfAborted();assertPublicationDisabled(env);
   const {rows}=await client.query('FETCH FORWARD 1 FROM pod_artifact_export');
   signal?.throwIfAborted();assertPublicationDisabled(env);if(!rows.length)break;
   const row=rows[0];
   if(!Buffer.isBuffer(row.body)||!row.body.length||row.body.length>MAX_OBJECT||digest(row.body)!==row.sha256||!TYPES.has(row.media_type))throw Error('ARCHIVE_ARTIFACT_INVALID');
   bytes+=row.body.length;if(bytes>budgetBytes||items.length>=MAX_ITEMS)throw Error('ARCHIVE_BUDGET_EXCEEDED');
   const item={sha256:row.sha256,media_type:row.media_type,bytes:row.body.length};
   await writeNew(path.join(opened.base,item.sha256+'.pod'),seal(row.body,key,aad(item)));items.push(item);
  }
  const catalog=Buffer.from(JSON.stringify({schema_version:1,scope:'artifacts_only',created_at:new Date().toISOString(),items}));
  if(catalog.length>MAX_CATALOG)throw Error('ARCHIVE_CATALOG_TOO_LARGE');
  assertPublicationDisabled(env);await client.query('COMMIT');signal?.throwIfAborted();assertPublicationDisabled(env);
  // Written last: an interrupted export without this catalog is not restorable.
  const encryptedCatalog=seal(catalog,key,'pod:artifact-catalog:v1');
  await writeNew(path.join(opened.base,'catalog.pod'),encryptedCatalog);
  signal?.throwIfAborted();assertPublicationDisabled(env);
  await assertArchiveDirectory(directory,opened);await syncArchiveDirectory(directory,opened);
  signal?.throwIfAborted();assertPublicationDisabled(env);
  // Re-authenticate the durable bytes through the pinned directory. A flush
  // can succeed even if another actor replaces a closed object before the
  // receipt, so directory identity alone cannot authorize EXPORTED.
  signal?.throwIfAborted();await assertArchiveDirectory(directory,opened);
  const verified=await readCatalog({directory,key,budgetBytes,signal,base:opened.base});
  if(verified.archive_sha256!==digest(encryptedCatalog))throw Error('ARCHIVE_CHANGED');
  await verifyItems(verified.catalog,{directory,key,budgetBytes,signal,base:opened.base});
  signal?.throwIfAborted();assertPublicationDisabled(env);await assertArchiveDirectory(directory,opened);
  assertPublicationDisabled(env);
  return {status:'EXPORTED',scope:'artifacts_only',objects:items.length,bytes,publication_enabled:false};
 }catch(error){
  // An unsuccessful rollback leaves transaction state unknown. Never return
  // that connection to the pool, and preserve the original export failure.
  if(client)try{await client.query('ROLLBACK');}catch{bad=true;}throw error;
 }finally{client?.release(bad);await closeArchiveDirectory(opened);}
}

export async function restoreArtifactLibrary(db,{directory,key,budgetBytes=134217728,env=process.env,signal}={}){
 const checkpoint=()=>{signal?.throwIfAborted();assertPublicationDisabled(env);};
 config(directory,key,budgetBytes);checkpoint();
 budgetBytes=Math.min(budgetBytes,artifactBudgetBytes(env));
 const opened=await openArchiveDirectory(directory),options={directory,key,budgetBytes,signal,base:opened.base};
 try{
 checkpoint();
 const {catalog,bytes}=await readCatalog(options);
 checkpoint();
 // Reject an already broken backup before acquiring a database connection/lock.
 // Read and authenticate again during insertion to catch intervening changes.
 await verifyItems(catalog,options);
 checkpoint();
 const restored=await db.tx(async client=>{
  checkpoint();
  await client.query('SELECT pg_advisory_xact_lock($1)',[543211]);
  checkpoint();
  const usage=await client.query('SELECT COALESCE(sum(octet_length(body)),0)::text AS bytes FROM public.pod_artifacts');
  checkpoint();
  let used=BigInt(usage.rows[0].bytes),inserted=0;
  for(const item of catalog.items){
   checkpoint();
   const body=await readArtifact(item,options);
   checkpoint();
   // Compare immutable identity in PostgreSQL without downloading existing
   // bytes. A length mismatch also skips hashing an oversized corrupt row.
   const existingResult=await client.query(`SELECT media_type,octet_length(body) AS bytes,
    CASE WHEN octet_length(body)=$2 THEN encode(sha256(body),'hex') ELSE NULL END AS body_sha256
    FROM public.pod_artifacts WHERE sha256=$1`,[item.sha256,item.bytes]);
   checkpoint();
   const existing=existingResult.rows[0];
   if(existing){if(existing.media_type!==item.media_type||existing.bytes!==item.bytes||existing.body_sha256!==item.sha256)throw Error('ARCHIVE_RESTORE_CONFLICT');continue;}
   used+=BigInt(body.length);if(used>BigInt(budgetBytes))throw Error('ARCHIVE_BUDGET_EXCEEDED');
   await client.query('INSERT INTO public.pod_artifacts(sha256,body,media_type) VALUES($1,$2,$3)',[item.sha256,body,item.media_type]);
   checkpoint();inserted++;
  }
  // The held descriptor prevents redirecting authenticated reads, but the
  // requested pathname must still identify that same archive at commit time.
  // Keep this inside the transaction so a replacement rolls back all inserts.
  await assertArchiveDirectory(directory,opened);
  checkpoint();
  return {status:'RESTORED',scope:'artifacts_only',objects:catalog.items.length,inserted,bytes,publication_enabled:false};
 });
 // COMMIT and pool release are asynchronous. A completed transaction cannot
 // be undone here; reject a late source replacement, cancellation or flag
 // change without claiming rollback or encouraging a blind retry.
 checkpoint();
 await assertArchiveDirectory(directory,opened);
 checkpoint();
 return restored;
 }finally{await closeArchiveDirectory(opened);}
}

