import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {seal,unseal,parseArchiveJSON,readBounded,writeNew,openArchiveDirectory,createArchiveDirectory,
 assertArchiveDirectory,syncArchiveDirectory,closeArchiveDirectory} from './archive-codec.mjs';
import {artifactBudgetBytes} from './storage-budget.mjs';
import {ARTIFACT_MEDIA_TYPES} from './artifacts.mjs';

// Dependency order is fixed in code, never taken from an archive or request.
const TABLES=Object.freeze({
 pod_artifacts:'sha256',pod_concepts:'id',pod_accounts:'id',
 pod_daily_concept_budget:'business_id,day',pod_market_intelligence:'id',
 pod_production_queue:'id',pod_quota_reservations:'job_id,attempt',
 pod_events:'id',pod_provider_inbox:'provider,account_id,provider_event_id',pod_financial_events:'id'
});
const NAMES=Object.keys(TABLES),MIGRATIONS=['001_pod.sql','002_pod.sql','003_pod.sql','004_pod.sql','005_pod.sql'];
const MAX_ROW=40*1024*1024,MAX_TOTAL=320*1024*1024,MAX_ROWS=10000,MAX_CATALOG=4*1024*1024;
const ARTIFACT_TYPES=new Set(ARTIFACT_MEDIA_TYPES);
const hash=body=>crypto.createHash('sha256').update(body).digest('hex');
const recordFile=index=>String(index).padStart(5,'0')+'.pod';
const aad=(id,item)=>`pod:state:v1:${id}:${item.table}:${item.index}:${item.sha256}:${item.bytes}`;
function disabled(env,restoring=false){
 if(env.PUBLICATION_ENABLED!=='false'||env.POD_PUBLICATION_ENABLED!=='false'||
  (restoring&&(env.POD_PRODUCTION_ENABLED!=='false'||env.POD_OUTBOX_ENABLED!=='false')))
  throw Error('STATE_ARCHIVE_WORKERS_MUST_BE_DISABLED');
}
function config(directory,key){
 if(typeof directory!=='string'||!path.isAbsolute(directory)||!Buffer.isBuffer(key)||key.length!==32)
  throw Error('STATE_ARCHIVE_CONFIG_INVALID');
}
async function expectedVersions(){
 const directory=new URL('../../migrations/',import.meta.url);
 const names=(await fs.readdir(directory)).filter(n=>/^\d+_pod\.sql$/.test(n)).sort();
 if(JSON.stringify(names)!==JSON.stringify(MIGRATIONS))throw Error('STATE_ARCHIVE_SCHEMA_UNSUPPORTED');
 return Promise.all(names.map(async version=>({version,sha256:hash(await fs.readFile(new URL(version,directory)))})));
}
async function schema(client){
 const versions=(await client.query('SELECT version,sha256 FROM public.pod_schema_version ORDER BY version')).rows;
 if(JSON.stringify(versions)!==JSON.stringify(await expectedVersions()))throw Error('STATE_ARCHIVE_SCHEMA_MISMATCH');
 const columns={};
 for(const table of NAMES){
  columns[table]=(await client.query(`SELECT a.attname AS name,format_type(a.atttypid,a.atttypmod) AS type,
   a.attnotnull AS required FROM pg_attribute a WHERE a.attrelid=$1::regclass AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`,['public.'+table])).rows;
  if(!columns[table].length)throw Error('STATE_ARCHIVE_SCHEMA_MISMATCH');
 }
 return {versions,columns};
}
function inspectRecord(body,table,columns){
 const row=parseArchiveJSON(body,'STATE_ARCHIVE_RECORD_INVALID');
 if(!row||Array.isArray(row)||JSON.stringify(Object.keys(row))!==JSON.stringify(columns.map(c=>c.name)))throw Error('STATE_ARCHIVE_RECORD_INVALID');
 if(table!=='pod_artifacts')return 0;
 if(typeof row.body!=='string'||!/^\\x(?:[a-f0-9]{2})+$/.test(row.body)||row.body.length>2+2*16777216||
  !ARTIFACT_TYPES.has(row.media_type))throw Error('STATE_ARCHIVE_ARTIFACT_INVALID');
 const binary=Buffer.from(row.body.slice(2),'hex');
 if(hash(binary)!==row.sha256)throw Error('STATE_ARCHIVE_ARTIFACT_INVALID');
 return binary.length;
}
async function catalogFor(options){
 const {directory,key,signal,base}=options;config(directory,key);signal?.throwIfAborted();
 const encrypted=await readBounded(path.join(base,'catalog.pod'),MAX_CATALOG+36,signal);
 const catalog=parseArchiveJSON(unseal(encrypted,key,'pod:state-catalog:v1'),'STATE_ARCHIVE_CATALOG_INVALID');
 if(catalog?.schema_version!==1||catalog.scope!=='pod_tables_only'||
  !/^[a-f0-9-]{36}$/.test(catalog.snapshot_id||'')||!Number.isFinite(Date.parse(catalog.created_at))||
  JSON.stringify(catalog.tables)!==JSON.stringify(NAMES)||
  JSON.stringify(catalog.versions)!==JSON.stringify(await expectedVersions())||
  !catalog.columns||JSON.stringify(Object.keys(catalog.columns))!==JSON.stringify(NAMES)||
  !Array.isArray(catalog.items)||catalog.items.length>MAX_ROWS)throw Error('STATE_ARCHIVE_CATALOG_INVALID');
 for(const table of NAMES){
  const cols=catalog.columns[table];
  if(!Array.isArray(cols)||!cols.length||cols.length>64||new Set(cols.map(c=>c.name)).size!==cols.length||
   cols.some(c=>!c||typeof c.name!=='string'||typeof c.type!=='string'||typeof c.required!=='boolean'))throw Error('STATE_ARCHIVE_CATALOG_INVALID');
 }
 let bytes=0,lastTable=-1;
 for(const [i,item] of catalog.items.entries()){
  const order=NAMES.indexOf(item?.table);
  if(item?.index!==i||order<lastTable||order<0||!Number.isSafeInteger(item.bytes)||item.bytes<2||item.bytes>MAX_ROW||
   !/^[a-f0-9]{64}$/.test(item.sha256||''))throw Error('STATE_ARCHIVE_CATALOG_INVALID');
  lastTable=order;bytes+=item.bytes;
 }
 if(bytes>MAX_TOTAL)throw Error('STATE_ARCHIVE_BUDGET_EXCEEDED');
 return {catalog,archive_sha256:hash(encrypted),bytes};
}
async function recordFor(item,catalog,{base,key,signal}){
 const body=unseal(await readBounded(path.join(base,recordFile(item.index)),MAX_ROW+36,signal),key,aad(catalog.snapshot_id,item));
 if(body.length!==item.bytes||hash(body)!==item.sha256)throw Error('STATE_ARCHIVE_RECORD_INVALID');
 return {body,artifactBytes:inspectRecord(body,item.table,catalog.columns[item.table])};
}
async function verifyStateArchiveAt({directory,key,signal,budgetBytes,base}){
 if(!Number.isSafeInteger(budgetBytes)||budgetBytes<1||budgetBytes>134217728)throw Error('STATE_ARCHIVE_CONFIG_INVALID');
 const options={directory,key,signal,base},result=await catalogFor(options);let artifacts=0;
 for(const item of result.catalog.items){artifacts+=(await recordFor(item,result.catalog,options)).artifactBytes;
  if(artifacts>budgetBytes)throw Error('STATE_ARCHIVE_BUDGET_EXCEEDED');}
 signal?.throwIfAborted();
 return {status:'VERIFIED',scope:'pod_tables_only',archive_sha256:result.archive_sha256,
  snapshot_id:result.catalog.snapshot_id,records:result.catalog.items.length,bytes:result.bytes,artifact_bytes:artifacts,publication_enabled:false};
}
export async function verifyStateArchive({directory,key,signal,budgetBytes=134217728}={}){
 config(directory,key);signal?.throwIfAborted();const opened=await openArchiveDirectory(directory);
 try{
  const result=await verifyStateArchiveAt({directory,key,signal,budgetBytes,base:opened.base});
  await assertArchiveDirectory(directory,opened);return result;
 }
 finally{await closeArchiveDirectory(opened);}
}

export async function exportStateArchive(db,{directory,key,signal,env=process.env}={}){
 config(directory,key);disabled(env);signal?.throwIfAborted();const budget=artifactBudgetBytes(env);
 const opened=await createArchiveDirectory(directory);let client,bytes=0,artifacts=0,bad=false;
 try{
  client=await db.pool.connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await client.query("SET LOCAL statement_timeout='10s'");await client.query("SET LOCAL lock_timeout='2s'");
  await client.query("SET LOCAL timezone='UTC'");await client.query("SET LOCAL datestyle='ISO, YMD'");await client.query("SET LOCAL bytea_output='hex'");
  const structure=await schema(client);
  const catalog={schema_version:1,scope:'pod_tables_only',snapshot_id:crypto.randomUUID(),created_at:new Date().toISOString(),
   tables:NAMES,...structure,items:[]};
  for(const table of NAMES){
   await client.query(`DECLARE pod_state_export NO SCROLL CURSOR FOR SELECT CASE WHEN octet_length(row_to_json(t)::text)<=${MAX_ROW}
    THEN row_to_json(t)::text ELSE NULL END AS record FROM public.${table} t ORDER BY ${TABLES[table]}`);
   while(true){
    signal?.throwIfAborted();const {rows}=await client.query('FETCH FORWARD 1 FROM pod_state_export');if(!rows.length)break;
    if(typeof rows[0].record!=='string')throw Error('STATE_ARCHIVE_BUDGET_EXCEEDED');
    const body=Buffer.from(rows[0].record);bytes+=body.length;
    if(body.length>MAX_ROW||bytes>MAX_TOTAL||catalog.items.length>=MAX_ROWS)throw Error('STATE_ARCHIVE_BUDGET_EXCEEDED');
    artifacts+=inspectRecord(body,table,structure.columns[table]);if(artifacts>budget)throw Error('STATE_ARCHIVE_BUDGET_EXCEEDED');
    const item={index:catalog.items.length,table,sha256:hash(body),bytes:body.length};
    await writeNew(path.join(opened.base,recordFile(item.index)),seal(body,key,aad(catalog.snapshot_id,item)));catalog.items.push(item);
   }
   await client.query('CLOSE pod_state_export');
  }
  const body=Buffer.from(JSON.stringify(catalog));if(body.length>MAX_CATALOG)throw Error('STATE_ARCHIVE_BUDGET_EXCEEDED');
  disabled(env);signal?.throwIfAborted();await client.query('COMMIT');
  signal?.throwIfAborted();disabled(env);
  const encrypted=seal(body,key,'pod:state-catalog:v1');
  await writeNew(path.join(opened.base,'catalog.pod'),encrypted);
  await assertArchiveDirectory(directory,opened);await syncArchiveDirectory(directory,opened);
  // Late cancellation can leave valid bytes, but must not report EXPORTED.
  signal?.throwIfAborted();disabled(env);await assertArchiveDirectory(directory,opened);
  return {status:'EXPORTED',scope:catalog.scope,snapshot_id:catalog.snapshot_id,archive_sha256:hash(encrypted),
   records:catalog.items.length,bytes,artifact_bytes:artifacts,publication_enabled:false};
 }catch(error){
  // Failed rollback makes the connection unsafe for subsequent pooled work.
  if(client)try{await client.query('ROLLBACK');}catch{bad=true;}throw error;
 }finally{client?.release(bad);await closeArchiveDirectory(opened);}
}

export async function restoreStateArchive(db,{directory,key,signal,env=process.env}={}){
 disabled(env,true);signal?.throwIfAborted();const budgetBytes=artifactBudgetBytes(env),opened=await openArchiveDirectory(directory),options={directory,key,signal,base:opened.base};
 try{
 const verified=await verifyStateArchiveAt({...options,budgetBytes});
 const {catalog,archive_sha256}=await catalogFor(options);
 if(archive_sha256!==verified.archive_sha256)throw Error('STATE_ARCHIVE_CHANGED');
 const restored=await db.tx(async client=>{
  // Locks also protect the empty-target decision from normal writers. No
  // DELETE/TRUNCATE/DDL privileges or immutability-trigger bypass is needed.
  await client.query(`LOCK TABLE ${NAMES.map(t=>'public.'+t).join(',')} IN SHARE ROW EXCLUSIVE MODE`);
  disabled(env,true);signal?.throwIfAborted();
  const structure=await schema(client);
  if(JSON.stringify(structure.columns)!==JSON.stringify(catalog.columns))throw Error('STATE_ARCHIVE_SCHEMA_MISMATCH');
  for(const table of NAMES)if((await client.query(`SELECT 1 FROM public.${table} LIMIT 1`)).rows.length)throw Error('STATE_ARCHIVE_TARGET_NOT_EMPTY');
  for(const item of catalog.items){
   const {body}=await recordFor(item,catalog,options);
   // Send original JSON text to PostgreSQL: parsing/re-serializing bigint
   // fields in JavaScript would round financial amounts and fencing tokens.
   await client.query(`INSERT INTO public.${item.table} SELECT * FROM json_populate_record(NULL::public.${item.table},$1::json)`,[body.toString('utf8')]);
  }
  const accounts=(await client.query("UPDATE public.pod_accounts SET state='DISABLED' WHERE state<>'DISABLED'")).rowCount;
  const production=(await client.query(`UPDATE public.pod_production_queue SET state='blocked',reason_code='PRODUCTION_LEASE_EXPIRED',
   lease_until=clock_timestamp()-interval '1 second',fencing_token=fencing_token+1,updated_at=clock_timestamp() WHERE state='processing'`)).rowCount;
  const publishing=(await client.query(`UPDATE public.pod_production_queue SET state='ambiguous',reason_code='RECOVERY_RECONCILIATION_REQUIRED',
   lease_until=NULL,fencing_token=fencing_token+1,updated_at=clock_timestamp() WHERE state='publishing'`)).rowCount;
  const receipt={...verified,status:'RESTORED',accounts_disabled:accounts,production_held:production,publishing_ambiguous:publishing};
  await client.query('INSERT INTO public.pod_events(id,kind,payload) VALUES($1,$2,$3)',[crypto.randomUUID(),'pod.recovery.restored',receipt]);
  disabled(env,true);signal?.throwIfAborted();return receipt;
 });
 // COMMIT and pool release are asynchronous. A completed transaction cannot
 // be undone here; reject late cancellation/flag changes without claiming rollback.
 signal?.throwIfAborted();
 disabled(env,true);
 return restored;
 }finally{await closeArchiveDirectory(opened);}
}
