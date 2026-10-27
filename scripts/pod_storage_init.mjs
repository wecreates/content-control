import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createPodPool} from '../pod-db-bridge.js';

export async function migrate(pool, runtimeRole, directory=new URL('../migrations/',import.meta.url), {provisionPassword,assertActive=()=>{}}={}) {
 if(!/^[a-z_][a-z0-9_]{0,62}$/.test(runtimeRole||''))throw Error('RUNTIME_ROLE_REQUIRED');
 if(provisionPassword!==undefined&&(!/^pod_[a-z0-9_]+$/.test(runtimeRole)||typeof provisionPassword!=='string'||Buffer.byteLength(provisionPassword)<32||provisionPassword.includes('\0')))throw Error('PROVISION_CONFIG_INVALID');
 const client=await pool.connect();
 let discard=false,began=false,beginAttempted=false,commitAttempted=false;
 try {
  beginAttempted=true;await client.query('BEGIN');began=true;
  await client.query("SET LOCAL lock_timeout='10s'");
  await client.query('SELECT pg_advisory_xact_lock($1)',[543210]);
  // Recheck deployment safety after connection and lock waits, before DDL.
  assertActive();
  if(provisionPassword!==undefined){
   const exists=(await client.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[runtimeRole])).rows.length>0;
   if(!exists){
    // format() quotes identifiers and values server-side; never print this statement.
    await client.query("SET LOCAL password_encryption='scram-sha-256'");
    const statement=(await client.query("SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD %L', $1::text, $2::text) AS sql",[runtimeRole,provisionPassword])).rows[0].sql;
    await client.query(statement);
   }
   // An existing role's password is never changed by a repeat deployment.
  }
  const role=(await client.query('SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=$1',[runtimeRole])).rows[0];
  if(!role||role.rolsuper||role.rolcreatedb||role.rolcreaterole||role.rolreplication||role.rolbypassrls)throw Error('RUNTIME_ROLE_PRIVILEGED');
  const current=(await client.query('SELECT current_user AS name')).rows[0].name;
  if(current===runtimeRole)throw Error('MIGRATION_ROLE_MUST_DIFFER');
  const inherited=(await client.query(`SELECT EXISTS(SELECT 1 FROM pg_roles p
   WHERE (p.rolsuper OR p.rolcreatedb OR p.rolcreaterole OR p.rolreplication OR p.rolbypassrls)
   AND pg_has_role($1,p.oid,'MEMBER')) AS elevated`,[runtimeRole])).rows[0];
  if(inherited.elevated)throw Error('RUNTIME_ROLE_PRIVILEGED');
  // PostgreSQL implicitly searches pg_temp before an explicit search_path.
  // A dedicated POD database therefore cannot leave the default PUBLIC TEMP
  // grant in place: otherwise the runtime can shadow unqualified POD tables.
  const revokeTemp=(await client.query("SELECT format('REVOKE TEMPORARY ON DATABASE %I FROM PUBLIC',current_database()) AS sql")).rows[0]?.sql;
  if(typeof revokeTemp!=='string'||!revokeTemp.startsWith('REVOKE TEMPORARY ON DATABASE ')||!revokeTemp.endsWith(' FROM PUBLIC'))throw Error('DATABASE_IDENTITY_INVALID');
  await client.query(revokeTemp);
  await client.query('CREATE TABLE IF NOT EXISTS pod_schema_version(version text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
  for(const name of (await fs.readdir(directory)).filter(n=>/^\d+_pod\.sql$/.test(n)).sort()){
   const sql=await fs.readFile(new URL(name,directory),'utf8');
   const hash=crypto.createHash('sha256').update(sql).digest('hex');
   const prior=(await client.query('SELECT sha256 FROM pod_schema_version WHERE version=$1',[name])).rows[0];
   if(prior){if(prior.sha256!==hash)throw Error('MIGRATION_CHECKSUM_MISMATCH');continue;}
   await client.query(sql);
   await client.query('INSERT INTO pod_schema_version(version,sha256) VALUES($1,$2)',[name,hash]);
  }
  // Explicit lane-owned objects only. Never grant access to cyzor_social_vault.
  const tables=['pod_concepts','pod_market_intelligence','pod_daily_concept_budget','pod_accounts','pod_production_queue','pod_quota_reservations','pod_events','pod_provider_inbox','pod_artifacts','pod_financial_events'];
  await client.query(`GRANT SELECT,INSERT,UPDATE ON ${tables.join(',')} TO "${runtimeRole}"`);
  await client.query(`GRANT SELECT ON pod_schema_version TO "${runtimeRole}"`);
  // Any safety change during migration must roll back the entire transaction.
  assertActive();
  commitAttempted=true;await client.query('COMMIT');
  // Migration SQL is intentionally extensible and runs with the owner role.
  // Even a confirmed transaction may have changed session-scoped state, so a
  // privileged migration client is never returned for unrelated pooled work.
  discard=true;
 }catch(error){
  // Rejected transaction boundaries leave transport/protocol state uncertain.
  // Do not send follow-up SQL after BEGIN or COMMIT rejects; destroy that
  // client. Before COMMIT is attempted, normal rollback remains safe cleanup.
  if(commitAttempted)discard=true;
  else if(began)try{await client.query('ROLLBACK');}catch{discard=true;}
  else if(beginAttempted)discard=true;
  throw error;
 }finally{client.release(discard);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let pool;
 try{pool=await createPodPool({...process.env,POD_DATABASE_URL:process.env.DATABASE_MIGRATION_URL});await migrate(pool,process.env.DATABASE_RUNTIME_USER);console.log(JSON.stringify({status:'MIGRATED'}));}
 catch{console.error(JSON.stringify({status:'BLOCKED',reason:'POD_MIGRATION_FAILED'}));process.exitCode=1;}
 finally{if(pool)await pool.end();}
}

