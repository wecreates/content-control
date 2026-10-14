import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertBridge} from '../integrations/pod/policy.mjs';

const TABLES=['pod_concepts','pod_market_intelligence','pod_daily_concept_budget','pod_accounts','pod_production_queue','pod_quota_reservations','pod_events','pod_provider_inbox','pod_artifacts','pod_financial_events'];
export async function preflight({env=process.env,connect,readFile=fs.readFile,now=Date.now(),directory=new URL('../migrations/',import.meta.url)}={}) {
 const checks=[];
 const check=(code,ok)=>checks.push({code,status:ok?'PASS':'BLOCKED'});
 for(const key of ['POD_UPSTREAM_KEY','POD_QA_KEY','INTERNAL_OPERATIONS_KEY'])check(key,typeof env[key]==='string'&&Buffer.byteLength(env[key])>=32);
 check('PUBLICATION_DISABLED',env.PUBLICATION_ENABLED!=='true'&&env.POD_PUBLICATION_ENABLED!=='true');
 check('STORAGE_LIFETIME',Number.isFinite(Date.parse(env.POD_STORAGE_EXPIRES_AT))&&Date.parse(env.POD_STORAGE_EXPIRES_AT)-now>86400000);
 try{assertBridge(JSON.parse(await readFile(env.POD_BRIDGE_PATH,'utf8')));check('BRIDGE_CONTRACT',true);}catch{check('BRIDGE_CONTRACT',false);}
 check('DEDICATED_DATABASE_CONFIGURED',!!env.POD_DATABASE_URL);
 let pool,client;
 if(env.POD_DATABASE_URL)try{
  const factory=connect|| (async e=>(await import('../pod-db-bridge.js')).createPodPool(e));
  pool=await factory(env);client=await pool.connect();
  await client.query('BEGIN READ ONLY');
  await client.query("SET LOCAL statement_timeout='5s'");
  await client.query("SET LOCAL lock_timeout='2s'");
  const role=(await client.query(`SELECT r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolreplication,r.rolbypassrls,
   has_database_privilege(current_user,current_database(),'CREATE') AS db_create,
   EXISTS(SELECT 1 FROM pg_roles p WHERE (p.rolsuper OR p.rolcreatedb OR p.rolcreaterole OR p.rolreplication OR p.rolbypassrls)
    AND pg_has_role(current_user,p.oid,'MEMBER')) AS elevated_membership,
   EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema'
    AND has_schema_privilege(current_user,n.oid,'CREATE')) AS schema_create
   FROM pg_roles r WHERE r.rolname=current_user`)).rows[0];
  check('RESTRICTED_RUNTIME_ROLE',!!role&&Object.values(role).every(v=>v===false));
  const tls=(await client.query('SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()')).rows[0];
  check('DATABASE_TLS',tls?.ssl===true);
  const tables=(await client.query(`SELECT c.relname,
   pg_has_role(current_user,c.relowner,'MEMBER') AS owns,
   has_table_privilege(current_user,c.oid,'SELECT') AS can_select,
   has_table_privilege(current_user,c.oid,'INSERT') AS can_insert,
   has_table_privilege(current_user,c.oid,'UPDATE') AS can_update,
   has_table_privilege(current_user,c.oid,'DELETE,TRUNCATE,REFERENCES,TRIGGER') AS excess
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname=ANY($1::text[])`,[[...TABLES,'pod_schema_version']])).rows;
  check('POD_TABLE_PRIVILEGES',[...TABLES,'pod_schema_version'].every(name=>{
   const t=tables.find(r=>r.relname===name);
   return t&&t.owns===false&&t.excess===false&&t.can_select===true&&
    (name==='pod_schema_version'?t.can_insert===false&&t.can_update===false:t.can_insert===true&&t.can_update===true);
  }));
  const vault=(await client.query(`SELECT has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS access,
   has_any_column_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES') AS column_access,
   pg_has_role(current_user,c.relowner,'MEMBER') AS owns
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='cyzor_social_vault'`)).rows;
  check('SOCIAL_VAULT_ISOLATED',vault.every(r=>r.access===false&&r.column_access===false&&r.owns===false));
  const versions=(await client.query('SELECT version,sha256 FROM public.pod_schema_version')).rows;
  let matching=versions.length===2;
  for(const name of ['001_pod.sql','002_pod.sql']){
   const sql=await readFile(new URL(name,directory),'utf8');
   matching&&=versions.find(r=>r.version===name)?.sha256===crypto.createHash('sha256').update(sql).digest('hex');
  }
  check('SCHEMA_CHECKSUMS',matching);
  check('DATABASE_READABLE',true);
 }catch{check('DATABASE_READABLE',false);}
 finally{
  if(client){await client.query('ROLLBACK').catch(()=>{});client.release();}
  if(pool)await pool.end().catch(()=>{});
 }
 return {schema_version:1,status:checks.every(c=>c.status==='PASS')?'CONFIGURATION_VERIFIED':'BLOCKED',
  publication_enabled:false,scope:'configuration_only',checks,
  unverified:['production_dependencies','production_resolvers','rights_and_editorial_review','authorized_platform_adapters','upstream_revenue_events']};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=await preflight();console.log(JSON.stringify(result));process.exitCode=result.status==='BLOCKED'?1:0;
}
