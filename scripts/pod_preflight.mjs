import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertBridge} from '../integrations/pod/policy.mjs';
import {parseBridgeJSON,readBridgeFile} from '../integrations/pod/bridge-file.mjs';
import {artifactBudgetBytes} from '../integrations/pod/storage-budget.mjs';
import {isolatedRuntimeKeys,REQUIRED_RUNTIME_KEYS} from '../integrations/pod/key-policy.mjs';
import {parseStorageExpiry,validDateMs} from '../integrations/pod/storage-expiry.mjs';

const TABLES=['pod_concepts','pod_market_intelligence','pod_daily_concept_budget','pod_accounts','pod_production_queue','pod_quota_reservations','pod_events','pod_provider_inbox','pod_artifacts','pod_financial_events'];
export async function preflight({env=process.env,connect,readFile=fs.readFile,readBridge,now=Date.now,directory=new URL('../migrations/',import.meta.url)}={}) {
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
  const bridge=readBridge?await readBridge(env.POD_BRIDGE_PATH):
   readFile===fs.readFile?await readBridgeFile(env.POD_BRIDGE_PATH):parseBridgeJSON(await readFile(env.POD_BRIDGE_PATH,'utf8'));
  assertBridge(bridge);check('BRIDGE_CONTRACT',true);
 }catch{check('BRIDGE_CONTRACT',false);}
 check('DEDICATED_DATABASE_CONFIGURED',!!env.POD_DATABASE_URL);
 let pool,client,readable=false,bad=false;
 if(env.POD_DATABASE_URL)try{
  const factory=connect|| (async e=>(await import('../pod-db-bridge.js')).createPodPool(e));
  pool=await factory(env);client=await pool.connect();
  await client.query('BEGIN READ ONLY');
  await client.query("SET LOCAL statement_timeout='5s'");
  await client.query("SET LOCAL lock_timeout='2s'");
  const searchPath=(await client.query('SELECT current_schemas(false) AS search_path')).rows[0]?.search_path;
  check('DATABASE_SEARCH_PATH',Array.isArray(searchPath)&&
   JSON.stringify(searchPath)===JSON.stringify(['pg_catalog','public']));
  const role=(await client.query(`SELECT r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolreplication,r.rolbypassrls,
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
   FROM pg_roles r WHERE r.rolname=current_user`)).rows[0];
  check('RESTRICTED_RUNTIME_ROLE',!!role&&Object.values(role).every(v=>v===false));
  const tls=(await client.query('SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()')).rows[0];
  check('DATABASE_TLS',tls?.ssl===true);
  // NOINHERIT does not remove membership/SET ROLE capabilities. Conservatively
  // inspect every member role, including indirect memberships, and column ACLs.
  // Required data access never includes permission to delegate it to others or
  // perform table maintenance. MAINTAIN was introduced in PostgreSQL 17;
  // keep older servers readable without evaluating an unknown privilege.
  const tables=(await client.query(`SELECT c.relname,
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
   WHERE n.nspname='public' AND c.relname=ANY($1::text[])`,[[...TABLES,'pod_schema_version']])).rows;
  check('POD_TABLE_PRIVILEGES',[...TABLES,'pod_schema_version'].every(name=>{
   const t=tables.find(r=>r.relname===name);
   return t&&t.owns===false&&t.excess===false&&t.can_select===true&&
    (name==='pod_schema_version'?t.can_insert===false&&t.can_update===false:t.can_insert===true&&t.can_update===true);
  }));
  const vault=(await client.query(`SELECT EXISTS(SELECT 1 FROM pg_roles p WHERE pg_has_role(current_user,p.oid,'MEMBER')
    AND has_table_privilege(p.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) AS access,
   EXISTS(SELECT 1 FROM pg_roles p WHERE pg_has_role(current_user,p.oid,'MEMBER')
    AND has_any_column_privilege(p.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')) AS column_access,
   pg_has_role(current_user,c.relowner,'MEMBER') AS owns
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='cyzor_social_vault'`)).rows;
  check('SOCIAL_VAULT_ISOLATED',vault.every(r=>r.access===false&&r.column_access===false&&r.owns===false));
  const versions=(await client.query('SELECT version,sha256 FROM public.pod_schema_version')).rows;
  const requiredMigrations=['001_pod.sql','002_pod.sql','003_pod.sql','004_pod.sql','005_pod.sql'];
  let matching=versions.length===requiredMigrations.length;
  for(const name of requiredMigrations){
   const sql=await readFile(new URL(name,directory),'utf8');
   matching&&=versions.find(r=>r.version===name)?.sha256===crypto.createHash('sha256').update(sql).digest('hex');
  }
  check('SCHEMA_CHECKSUMS',matching);
  readable=true;
 }catch{readable=false;}
 finally{
  if(client){
   // Startup borrows a service-owned pool. A failed rollback must invalidate
   // the report as well as discard the connection with unknown transaction state.
   try{await client.query('ROLLBACK');}catch{readable=false;bad=true;}
   client.release(bad);
  }
  if(pool)await pool.end().catch(()=>{});
 }
 if(env.POD_DATABASE_URL)check('DATABASE_READABLE',readable);
 // Downgrade stale evidence without duplicating checks or clearing an earlier
 // failure. A completed read-only query is not a current safety guarantee.
 for(const [code,ok] of safety())if(!ok)checks.find(c=>c.code===code).status='BLOCKED';
 return {schema_version:1,status:checks.every(c=>c.status==='PASS')?'CONFIGURATION_VERIFIED':'BLOCKED',
  publication_enabled:false,scope:'configuration_only',checks,
  unverified:['production_dependencies','production_resolvers','rights_and_editorial_review','authorized_platform_adapters','upstream_revenue_events']};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=await preflight();console.log(JSON.stringify(result));process.exitCode=result.status==='BLOCKED'?1:0;
}


