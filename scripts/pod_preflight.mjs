import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {types as utilTypes} from 'node:util';
import {assertBridge} from '../integrations/pod/policy.mjs';
import {parseBridgeJSON,readBridgeFile} from '../integrations/pod/bridge-file.mjs';
import {artifactBudgetBytes} from '../integrations/pod/storage-budget.mjs';
import {isolatedRuntimeKeys,REQUIRED_RUNTIME_KEYS} from '../integrations/pod/key-policy.mjs';
import {parseStorageExpiry,validDateMs} from '../integrations/pod/storage-expiry.mjs';
import {diagnosticDeadline,diagnosticStep,isDiagnosticDeadline} from '../integrations/pod/diagnostic-deadline.mjs';

const TABLES=['pod_concepts','pod_market_intelligence','pod_daily_concept_budget','pod_accounts','pod_production_queue','pod_quota_reservations','pod_events','pod_provider_inbox','pod_artifacts','pod_financial_events'];
function dataProperty(target,key){
 try{
  if(target===null||(typeof target!=='object'&&typeof target!=='function')||utilTypes.isProxy(target))return {valid:false};
  const descriptor=Object.getOwnPropertyDescriptor(target,key);
  return descriptor&&Object.hasOwn(descriptor,'value')?{valid:true,value:descriptor.value}:{valid:false};
 }catch{return {valid:false};}
}
function queryRows(result,fields,limit){
 const rows=dataProperty(result,'rows');
 if(!rows.valid||!Array.isArray(rows.value)||utilTypes.isProxy(rows.value))throw Error('POD_PREFLIGHT_QUERY_UNVERIFIED');
 let keys,length,descriptors;
 try{
  keys=Reflect.ownKeys(rows.value);length=Object.getOwnPropertyDescriptor(rows.value,'length');
  descriptors=Object.getOwnPropertyDescriptors(rows.value);
 }catch{throw Error('POD_PREFLIGHT_QUERY_UNVERIFIED');}
 if(!Object.hasOwn(length||{},'value')||!Number.isInteger(length.value)||length.value<0||length.value>limit||
  keys.length!==length.value+1||keys.some((key,index)=>index<length.value?key!==String(index):key!=='length'))
  throw Error('POD_PREFLIGHT_QUERY_UNVERIFIED');
 const expected=[...fields].sort(),snapshots=[];
 for(let index=0;index<length.value;index++){
  const item=descriptors[String(index)];
  if(!item?.enumerable||!Object.hasOwn(item,'value'))throw Error('POD_PREFLIGHT_QUERY_UNVERIFIED');
  const row=item.value;let prototype,rowKeys,rowDescriptors;
  try{
   if(row===null||(typeof row!=='object'&&typeof row!=='function')||utilTypes.isProxy(row))throw Error();
   prototype=Object.getPrototypeOf(row);rowKeys=Reflect.ownKeys(row);rowDescriptors=Object.getOwnPropertyDescriptors(row);
  }catch{throw Error('POD_PREFLIGHT_QUERY_UNVERIFIED');}
  if((prototype!==Object.prototype&&prototype!==null)||rowKeys.length!==expected.length||
   rowKeys.some(key=>typeof key!=='string')||rowKeys.map(String).sort().some((key,offset)=>key!==expected[offset])||
   expected.some(field=>!rowDescriptors[field]?.enumerable||!Object.hasOwn(rowDescriptors[field],'value')))
   throw Error('POD_PREFLIGHT_QUERY_UNVERIFIED');
  snapshots.push(Object.fromEntries(expected.map(field=>[field,rowDescriptors[field].value])));
 }
 return snapshots;
}
function queryRow(result,fields){
 const rows=queryRows(result,fields,1);
 return rows.length===1?rows[0]:null;
}
function stringArraySnapshot(value,limit){
 if(!Array.isArray(value)||utilTypes.isProxy(value))throw Error('POD_PREFLIGHT_QUERY_UNVERIFIED');
 let keys,length,descriptors;
 try{
  keys=Reflect.ownKeys(value);length=Object.getOwnPropertyDescriptor(value,'length');descriptors=Object.getOwnPropertyDescriptors(value);
 }catch{throw Error('POD_PREFLIGHT_QUERY_UNVERIFIED');}
 if(Object.getPrototypeOf(value)!==Array.prototype||!Object.hasOwn(length||{},'value')||
  !Number.isInteger(length.value)||length.value<0||length.value>limit||keys.length!==length.value+1||
  keys.some((key,index)=>index<length.value?key!==String(index):key!=='length'))throw Error('POD_PREFLIGHT_QUERY_UNVERIFIED');
 const snapshot=[];
 for(let index=0;index<length.value;index++){
  const item=descriptors[String(index)];
  if(!item?.enumerable||!Object.hasOwn(item,'value')||typeof item.value!=='string')throw Error('POD_PREFLIGHT_QUERY_UNVERIFIED');
  snapshot.push(item.value);
 }
 return snapshot;
}
async function preflightChecks({env=process.env,connect,readFile=fs.readFile,readBridge,now=Date.now,signal,directory=new URL('../migrations/',import.meta.url)}={}) {
 const deadline=diagnosticDeadline(signal);
 const step=(operation,options)=>diagnosticStep(operation,deadline,options);
 const checks=[];
 const check=(code,ok)=>checks.push({code,status:ok?'PASS':'BLOCKED'});
 // Numeric time remains a fixed test hook; the default clock is sampled again
 // after all asynchronous checks and owned-pool cleanup have completed.
 const clock=typeof now==='function'?now:()=>now;
 const safety=()=>{
  const observedAt=clock(),expiresAt=parseStorageExpiry(env.POD_STORAGE_EXPIRES_AT);
  return [
   ['PUBLICATION_DISABLED',env.PUBLICATION_ENABLED!=='true'&&env.POD_PUBLICATION_ENABLED!=='true'],
   ['STORAGE_LIFETIME',validDateMs(observedAt)&&validDateMs(expiresAt)&&expiresAt-observedAt>86400000],
  ];
 };
 try{artifactBudgetBytes(env);check('ARTIFACT_STORAGE_BUDGET',true);}catch{check('ARTIFACT_STORAGE_BUDGET',false);}
 for(const key of REQUIRED_RUNTIME_KEYS)check(key,typeof env[key]==='string'&&Buffer.byteLength(env[key])>=32);
 check('POD_KEY_ISOLATION',isolatedRuntimeKeys(env));
 for(const [code,ok] of safety())check(code,ok);
 try{
  const bridge=await step(async()=>readBridge?await readBridge(env.POD_BRIDGE_PATH):
   readFile===fs.readFile?await readBridgeFile(env.POD_BRIDGE_PATH):parseBridgeJSON(await readFile(env.POD_BRIDGE_PATH,'utf8')));
  assertBridge(bridge);check('BRIDGE_CONTRACT',true);
 }catch{check('BRIDGE_CONTRACT',false);}
 check('DEDICATED_DATABASE_CONFIGURED',!!env.POD_DATABASE_URL);
 let pool,client,readable=false,bad=false,began=false,beginAttempted=false;
 if(env.POD_DATABASE_URL)try{
  const factory=connect|| (async e=>(await import('../pod-db-bridge.js')).createPodPool(e));
  pool=await step(()=>factory(env),{onLate:late=>{try{Promise.resolve(late.end()).catch(()=>{});}catch{}}});
  client=await step(()=>pool.connect(),{onLate:late=>{
   try{Promise.resolve(late.release(true)).catch(()=>{});}catch{}
  }});
  const acquired=client;
  client={query:(...args)=>step(()=>acquired.query(...args)),release:bad=>acquired.release(bad)};
  beginAttempted=true;await client.query('BEGIN READ ONLY');began=true;
  await client.query("SET LOCAL statement_timeout='5s'");
  await client.query("SET LOCAL lock_timeout='2s'");
  const searchPathRow=queryRow(await client.query('SELECT current_schemas(false)::text[] AS search_path'),['search_path']);
  const searchPath=searchPathRow===null?null:stringArraySnapshot(searchPathRow.search_path,16);
  check('DATABASE_SEARCH_PATH',Array.isArray(searchPath)&&
   JSON.stringify(searchPath)===JSON.stringify(['pg_catalog','public']));
  const role=queryRow(await client.query(`SELECT r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolreplication,r.rolbypassrls,
   EXISTS(SELECT 1 FROM pg_roles p WHERE pg_has_role(current_user,p.oid,'MEMBER')
    AND has_database_privilege(p.oid,current_database(),'CREATE')) AS db_create,
   EXISTS(SELECT 1 FROM pg_roles p WHERE pg_has_role(current_user,p.oid,'MEMBER')
    AND has_database_privilege(p.oid,current_database(),'TEMP')) AS db_temp,
   EXISTS(SELECT 1 FROM pg_roles p WHERE (p.rolsuper OR p.rolcreatedb OR p.rolcreaterole OR p.rolreplication OR p.rolbypassrls
    OR p.rolname IN ('pg_read_server_files','pg_write_server_files','pg_execute_server_program',
      'pg_signal_backend','pg_signal_autovacuum_worker','pg_checkpoint','pg_maintain'))
    AND pg_has_role(current_user,p.oid,'MEMBER')) AS elevated_membership,
   EXISTS(SELECT 1 FROM pg_namespace n CROSS JOIN pg_roles p
    WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema'
    AND pg_has_role(current_user,p.oid,'MEMBER') AND has_schema_privilege(p.oid,n.oid,'CREATE')) AS schema_create
   FROM pg_roles r WHERE r.rolname=current_user`),['rolsuper','rolcreatedb','rolcreaterole','rolreplication','rolbypassrls',
   'db_create','db_temp','elevated_membership','schema_create']);
  check('RESTRICTED_RUNTIME_ROLE',!!role&&Object.values(role).every(v=>v===false));
  const tls=queryRow(await client.query('SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()'),['ssl']);
  check('DATABASE_TLS',tls?.ssl===true);
  // NOINHERIT does not remove membership/SET ROLE capabilities. Conservatively
  // inspect every member role, including indirect memberships, and column ACLs.
  // Required data access never includes permission to delegate it to others or
  // perform table maintenance. MAINTAIN was introduced in PostgreSQL 17;
  // keep older servers readable without evaluating an unknown privilege.
  const tables=queryRows(await client.query(`SELECT c.relname,
   pg_has_role(current_user,c.relowner,'MEMBER') AS owns,
   has_table_privilege(current_user,c.oid,'SELECT') AS can_select,
   has_table_privilege(current_user,c.oid,'INSERT') AS can_insert,
   has_table_privilege(current_user,c.oid,'UPDATE') AS can_update,
   EXISTS(SELECT 1 FROM pg_roles p WHERE pg_has_role(current_user,p.oid,'MEMBER') AND
    (has_table_privilege(p.oid,c.oid,CASE WHEN c.relname='pod_schema_version'
      THEN 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER' ELSE 'DELETE,TRUNCATE,REFERENCES,TRIGGER' END)
     OR has_any_column_privilege(p.oid,c.oid,CASE WHEN c.relname='pod_schema_version'
      THEN 'INSERT,UPDATE,REFERENCES' ELSE 'REFERENCES' END)
     OR has_any_column_privilege(p.oid,c.oid,'SELECT WITH GRANT OPTION,INSERT WITH GRANT OPTION,UPDATE WITH GRANT OPTION')
     OR CASE WHEN current_setting('server_version_num')::int>=170000
      THEN has_table_privilege(p.oid,c.oid,'MAINTAIN') ELSE false END)) AS excess
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname=ANY($1::text[])`,[[...TABLES,'pod_schema_version']]),
   ['relname','owns','can_select','can_insert','can_update','excess'],TABLES.length+1);
  check('POD_TABLE_PRIVILEGES',[...TABLES,'pod_schema_version'].every(name=>{
   const t=tables.find(r=>r.relname===name);
   return t&&t.owns===false&&t.excess===false&&t.can_select===true&&
    (name==='pod_schema_version'?t.can_insert===false&&t.can_update===false:t.can_insert===true&&t.can_update===true);
  }));
  const vault=queryRows(await client.query(`SELECT EXISTS(SELECT 1 FROM pg_roles p WHERE pg_has_role(current_user,p.oid,'MEMBER')
    AND has_table_privilege(p.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) AS access,
   EXISTS(SELECT 1 FROM pg_roles p WHERE pg_has_role(current_user,p.oid,'MEMBER')
    AND has_any_column_privilege(p.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')) AS column_access,
   pg_has_role(current_user,c.relowner,'MEMBER') AS owns
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='cyzor_social_vault'`),
   ['access','column_access','owns'],1);
  check('SOCIAL_VAULT_ISOLATED',vault.every(r=>r.access===false&&r.column_access===false&&r.owns===false));
  const requiredMigrations=['001_pod.sql','002_pod.sql','003_pod.sql','004_pod.sql','005_pod.sql'];
  const versions=queryRows(await client.query('SELECT version,sha256 FROM public.pod_schema_version'),
   ['version','sha256'],requiredMigrations.length);
  let matching=versions.length===requiredMigrations.length;
  for(const name of requiredMigrations){
   const sql=await step(()=>readFile(new URL(name,directory),'utf8'));
   matching&&=versions.find(r=>r.version===name)?.sha256===crypto.createHash('sha256').update(sql).digest('hex');
  }
  check('SCHEMA_CHECKSUMS',matching);
  readable=true;
 }catch(error){readable=false;if(isDiagnosticDeadline(error))bad=true;}
 finally{
  if(client){
   // Startup may borrow a service-owned pool. Never probe a client again after
   // BEGIN rejects; its protocol state is uncertain. A confirmed transaction
   // still uses rollback, whose failure also invalidates and destroys it.
   if(began&&!bad)try{await client.query('ROLLBACK');}catch{readable=false;bad=true;}
   else if(beginAttempted)bad=true;
   try{
    // Release must run even after cancellation. Its outcome still belongs to
    // the preflight: a failed or stalled release cannot verify configuration,
    // expose backend detail, or prevent owned-pool shutdown below.
    const releasing=Promise.resolve(client.release(bad));releasing.catch(()=>{});
    await step(()=>releasing);
   }catch{readable=false;}
  }
  if(pool)try{
   // Initiate owned-pool shutdown even after expiry, but never wait forever
   // for a pending acquisition/query to let that shutdown settle.
   const ending=Promise.resolve(pool.end());ending.catch(()=>{});
   await step(()=>ending);
  }catch{readable=false;}
 }
 if(env.POD_DATABASE_URL)check('DATABASE_READABLE',readable);
 // Downgrade stale evidence without duplicating checks or clearing an earlier
 // failure. A completed read-only query is not a current safety guarantee.
 for(const [code,ok] of safety())if(!ok)checks.find(c=>c.code===code).status='BLOCKED';
 return {schema_version:1,status:checks.every(c=>c.status==='PASS')?'CONFIGURATION_VERIFIED':'BLOCKED',
  publication_enabled:false,scope:'configuration_only',checks,
  unverified:['production_dependencies','production_resolvers','rights_and_editorial_review','authorized_platform_adapters','upstream_revenue_events']};
}
export async function preflight(options={}){
 // AbortSignal.timeout is unreferenced. Keep the standalone CLI alive until
 // it can emit its bounded, redacted BLOCKED result even with stalled I/O.
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),40000);
 try{return await preflightChecks({...options,signal:options.signal===undefined?controller.signal:
  AbortSignal.any([options.signal,controller.signal])});}
 finally{clearTimeout(timer);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=await preflight();console.log(JSON.stringify(result));process.exitCode=result.status==='BLOCKED'?1:0;
}


