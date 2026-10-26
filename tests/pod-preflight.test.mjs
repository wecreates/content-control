import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {preflight} from '../scripts/pod_preflight.mjs';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';
import {requirePodRuntime} from '../integrations/pod/runtime-gate.mjs';
import {MAX_BRIDGE_BYTES,readBridgeFile} from '../integrations/pod/bridge-file.mjs';
const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};
const env={POD_DATABASE_URL:'postgresql://secret:secret@example.invalid/db',POD_BRIDGE_PATH:'bridge',
 POD_UPSTREAM_KEY:'a'.repeat(32),POD_QA_KEY:'b'.repeat(32),INTERNAL_OPERATIONS_KEY:'c'.repeat(32),
 POD_STORAGE_EXPIRES_AT:'2030-01-01T00:00:00Z',PUBLICATION_ENABLED:'false',POD_PUBLICATION_ENABLED:'false'};
async function bridgeWorkspace(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pod-bridge-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 return root;
}
function fixture(overrides={}){
 const queries=[],releases=[];let released=false,ended=false;
 const client={async query(sql,args){queries.push(sql);
  if((overrides.throwOn&&sql.includes(overrides.throwOn))||(overrides.rollbackFails&&sql==='ROLLBACK'))throw Error('secret password internal-url');
  if(sql.includes('current_schemas(false)'))return {rows:[{search_path:overrides.searchPath??['pg_catalog','public']}]};
  if(sql.includes('FROM pg_roles r'))return {rows:[{rolsuper:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false,rolbypassrls:false,db_create:false,db_temp:false,elevated_membership:false,schema_create:false,...overrides.role}]};
  if(sql.includes('pg_stat_ssl'))return {rows:[{ssl:overrides.tls??true}]};
  if(sql.includes('ANY($1'))return {rows:args[0].map(relname=>({relname,owns:false,excess:false,can_select:true,can_insert:relname!=='pod_schema_version',can_update:relname!=='pod_schema_version'}))};
  if(sql.includes("relname='cyzor_social_vault'"))return {rows:[{access:overrides.vault??false,column_access:false,owns:false}]};
  if(sql.includes('SELECT version,sha256'))return {rows:['001_pod.sql','002_pod.sql','003_pod.sql','004_pod.sql','005_pod.sql'].filter(v=>v!==overrides.missingMigration).map(version=>({version,sha256:overrides.hash??crypto.createHash('sha256').update('sql').digest('hex')}))};
  return {rows:[]};},release(discard){released=true;releases.push(discard);}};
 return {options:{env,now:0,readFile:async p=>p==='bridge'?JSON.stringify(bridge):'sql',connect:async()=>({connect:async()=>client,end:async()=>{ended=true;}})},queries,releases,closed:()=>released&&ended};
}
for(const remaining of [86400001,86400000,86399999])test('preflight reports storage lifetime after cleanup: '+remaining,async t=>{
 let now=1800000000000;t.mock.method(Date,'now',()=>now);
 const f=fixture(),settings={...env,POD_STORAGE_EXPIRES_AT:new Date(now+86400002).toISOString()};
 const pool=await f.options.connect(),end=pool.end;
 pool.end=async()=>{await end();now+=86400002-remaining;};
 const r=await preflight({...f.options,now:undefined,env:settings,connect:async()=>pool});
 assert.equal(r.status,remaining>86400000?'CONFIGURATION_VERIFIED':'BLOCKED');
 assert.deepEqual(r.checks.filter(c=>c.code==='STORAGE_LIFETIME'),[{code:'STORAGE_LIFETIME',status:remaining>86400000?'PASS':'BLOCKED'}]);
 assert.ok(f.closed());assert.equal(r.publication_enabled,false);
});
for(const flag of ['PUBLICATION_ENABLED','POD_PUBLICATION_ENABLED'])test('preflight rejects '+flag+' enabled during cleanup',async()=>{
 const f=fixture(),settings={...env},pool=await f.options.connect(),end=pool.end;
 pool.end=async()=>{await end();settings[flag]='true';};
 const r=await preflight({...f.options,env:settings,connect:async()=>pool});
 assert.equal(r.status,'BLOCKED');
 assert.deepEqual(r.checks.filter(c=>c.code==='PUBLICATION_DISABLED'),[{code:'PUBLICATION_DISABLED',status:'BLOCKED'}]);
 assert.ok(f.closed());
});
test('runtime preflight cannot admit storage that expired while checking its borrowed pool',async t=>{
 let now=1800000000000;t.mock.method(Date,'now',()=>now);
 const f=fixture(),settings={...env,POD_STORAGE_EXPIRES_AT:new Date(now+86400001).toISOString()};
 const pool=await f.options.connect(),client=await pool.connect(),query=client.query;
 client.query=async(...args)=>{const r=await query(...args);if(args[0]==='ROLLBACK')now++;return r;};
 await assert.rejects(requirePodRuntime({pool,env:settings,check:({connect})=>preflight({...f.options,now:undefined,env:settings,connect})}),/POD_RUNTIME_PREFLIGHT_BLOCKED/);
 assert.deepEqual(f.releases,[false]);assert.equal(f.closed(),false);
});
for(const code of ['STORAGE_LIFETIME','PUBLICATION_DISABLED'])test('final recheck cannot clear an earlier '+code+' failure',async()=>{
 const f=fixture(),settings={...env,...(code==='STORAGE_LIFETIME'?{POD_STORAGE_EXPIRES_AT:'invalid'}:{PUBLICATION_ENABLED:'true'})};
 const pool=await f.options.connect(),end=pool.end;
 pool.end=async()=>{await end();Object.assign(settings,env);};
 const r=await preflight({...f.options,env:settings,connect:async()=>pool});
 assert.equal(r.status,'BLOCKED');
 assert.deepEqual(r.checks.filter(c=>c.code===code),[{code,status:'BLOCKED'}]);
});
test('an injected preflight clock is sampled again at completion',async()=>{
 const f=fixture();let reads=0;
 const r=await preflight({...f.options,env:{...env,POD_STORAGE_EXPIRES_AT:new Date(86400001).toISOString()},now:()=>reads++});
 assert.equal(reads,2);assert.equal(r.status,'BLOCKED');
 assert.equal(r.checks.find(c=>c.code==='STORAGE_LIFETIME').status,'BLOCKED');
});
test('verified configuration is read-only and never authorizes publication',async()=>{
 const f=fixture(),r=await preflight(f.options);assert.equal(r.status,'CONFIGURATION_VERIFIED');assert.equal(r.publication_enabled,false);
 assert.equal(f.queries[0],'BEGIN READ ONLY');assert.equal(f.queries.at(-1),'ROLLBACK');assert.ok(f.closed());
 assert.ok(f.queries.every(q=>/^(SELECT|BEGIN READ ONLY|SET LOCAL|ROLLBACK)/.test(q)));
});
test('invalid artifact budget blocks preflight without exposing its value',async()=>{
 const f=fixture(),r=await preflight({...f.options,env:{...env,POD_ARTIFACT_BUDGET_BYTES:'private-invalid-budget'}});
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.checks.find(c=>c.code==='ARTIFACT_STORAGE_BUDGET').status,'BLOCKED');
 assert.equal(JSON.stringify(r).includes('private-invalid-budget'),false);
});
test('missing configuration blocks without attempting a database connection',async()=>{
 const r=await preflight({env:{},readFile:async()=>{throw Error('missing');},connect:()=>{assert.fail('must not connect');}});
 assert.equal(r.status,'BLOCKED');assert.equal(r.checks.find(c=>c.code==='DEDICATED_DATABASE_CONFIGURED').status,'BLOCKED');
});
test('production preflight accepts a bounded regular bridge contract',async t=>{
 const root=await bridgeWorkspace(t),filename=path.join(root,'bridge.json');
 await fs.writeFile(filename,JSON.stringify(bridge));
 const r=await preflight({env:{...env,POD_DATABASE_URL:'',POD_BRIDGE_PATH:filename},connect:()=>assert.fail('must not connect')});
 assert.deepEqual(r.checks.find(c=>c.code==='BRIDGE_CONTRACT'),{code:'BRIDGE_CONTRACT',status:'PASS'});
 assert.equal(r.status,'BLOCKED');
});
test('production preflight rejects a final bridge symlink',async t=>{
 const root=await bridgeWorkspace(t),target=path.join(root,'target.json'),filename=path.join(root,'bridge.json');
 await fs.writeFile(target,JSON.stringify(bridge));await fs.symlink(target,filename);
 const r=await preflight({env:{...env,POD_DATABASE_URL:'',POD_BRIDGE_PATH:filename},connect:()=>assert.fail('must not connect')});
 assert.deepEqual(r.checks.find(c=>c.code==='BRIDGE_CONTRACT'),{code:'BRIDGE_CONTRACT',status:'BLOCKED'});
});
test('production preflight rejects escaped duplicate bridge keys',async t=>{
 const root=await bridgeWorkspace(t),filename=path.join(root,'bridge.json');
 const ambiguous=`{"producer":"invalid","prod\\u0075cer":"CYZOR Money Factory","consumer":"Content Control","contract":{"fail_closed_rules":${JSON.stringify(BRIDGE_RULES)}}}`;
 await fs.writeFile(filename,ambiguous);
 const r=await preflight({env:{...env,POD_DATABASE_URL:'',POD_BRIDGE_PATH:filename},connect:()=>assert.fail('must not connect')});
 assert.deepEqual(r.checks.find(c=>c.code==='BRIDGE_CONTRACT'),{code:'BRIDGE_CONTRACT',status:'BLOCKED'});
});
test('bridge reader enforces its exact byte ceiling',async t=>{
 const root=await bridgeWorkspace(t),filename=path.join(root,'bridge.json');
 const body=JSON.stringify(bridge);
 await fs.writeFile(filename,body.padEnd(MAX_BRIDGE_BYTES,' '));
 assert.deepEqual(await readBridgeFile(filename),bridge);
 await fs.appendFile(filename,' ');
 await assert.rejects(readBridgeFile(filename),/BRIDGE_CONTRACT_INVALID/);
});
for(const [name,overrides,code] of [
 ['unsafe database search path',{searchPath:['untrusted','pg_catalog','public']},'DATABASE_SEARCH_PATH'],
 ['missing public search path',{searchPath:['pg_catalog']},'DATABASE_SEARCH_PATH'],
 ['temporary relation privilege',{role:{db_temp:true}},'RESTRICTED_RUNTIME_ROLE'],
 ['privileged role',{role:{elevated_membership:true}},'RESTRICTED_RUNTIME_ROLE'],
 ['TLS absent',{tls:false},'DATABASE_TLS'],['vault access',{vault:true},'SOCIAL_VAULT_ISOLATED'],
 ['modified migration',{hash:'bad'},'SCHEMA_CHECKSUMS']]){
 test(name+' fails closed',async()=>{const f=fixture(overrides),r=await preflight(f.options);assert.equal(r.status,'BLOCKED');assert.equal(r.checks.find(c=>c.code===code).status,'BLOCKED');assert.ok(f.closed());});
}
test('database errors redact details and always release connection',async()=>{
 const f=fixture({throwOn:'pg_roles'}),r=await preflight(f.options);assert.equal(r.status,'BLOCKED');assert.ok(!JSON.stringify(r).includes('secret'));assert.ok(f.closed());assert.equal(f.queries.at(-1),'ROLLBACK');
});
test('expiry and enabled publishing block deployment preflight',async()=>{
 const f=fixture(),r=await preflight({...f.options,env:{...env,POD_STORAGE_EXPIRES_AT:'invalid',PUBLICATION_ENABLED:'true'}});
 for(const code of ['STORAGE_LIFETIME','PUBLICATION_DISABLED'])assert.equal(r.checks.find(c=>c.code===code).status,'BLOCKED');
});
test('preflight rejects normalized or ambiguous storage expiry text',async()=>{
 for(const expiry of ['2030-01-01','2030-01-01 00:00:00Z','2030-01-01T01:00:00+01:00',
  '2030-01-01T00:00:00.0Z','2030-01-01T00:00:00z','2030-01-01T00:00:00Z ']){
  const f=fixture(),r=await preflight({...f.options,env:{...env,POD_STORAGE_EXPIRES_AT:expiry}});
  assert.deepEqual(r.checks.find(c=>c.code==='STORAGE_LIFETIME'),{code:'STORAGE_LIFETIME',status:'BLOCKED'});
 }
});
test('preflight rejects invalid wall clocks',async()=>{
 for(const now of [NaN,Infinity,-1,0.5,8640000000000001,Number.MAX_SAFE_INTEGER+1,'0']){
  const f=fixture(),r=await preflight({...f.options,now});
  assert.deepEqual(r.checks.find(c=>c.code==='STORAGE_LIFETIME'),{code:'STORAGE_LIFETIME',status:'BLOCKED'});
 }
});
test('missing market evidence migration blocks preflight',async()=>{
 const f=fixture({missingMigration:'003_pod.sql'}),r=await preflight(f.options);
 assert.equal(r.status,'BLOCKED');assert.equal(r.checks.find(c=>c.code==='SCHEMA_CHECKSUMS').status,'BLOCKED');
});
test('missing financial uniqueness migration blocks preflight',async()=>{
 const f=fixture({missingMigration:'004_pod.sql'}),r=await preflight(f.options);
 assert.equal(r.status,'BLOCKED');assert.equal(r.checks.find(c=>c.code==='SCHEMA_CHECKSUMS').status,'BLOCKED');
});
test('missing provider listing uniqueness migration blocks preflight',async()=>{
 const f=fixture({missingMigration:'005_pod.sql'}),r=await preflight(f.options);
 assert.equal(r.status,'BLOCKED');assert.equal(r.checks.find(c=>c.code==='SCHEMA_CHECKSUMS').status,'BLOCKED');
});


for(const throwOn of [undefined,'pg_roles'])test('rollback failure blocks preflight and destroys connection: '+(throwOn||'successful checks'),async()=>{
 const f=fixture({rollbackFails:true,throwOn}),r=await preflight(f.options);
 assert.equal(r.status,'BLOCKED');
 assert.deepEqual(r.checks.filter(c=>c.code==='DATABASE_READABLE'),[{code:'DATABASE_READABLE',status:'BLOCKED'}]);
 assert.deepEqual(f.releases,[true]);assert.ok(f.closed());
 assert.equal(f.queries.at(-1),'ROLLBACK');
 assert.equal(JSON.stringify(r).includes('secret'),false);
});
test('runtime cannot activate after a failed preflight rollback on its borrowed pool',async()=>{
 const f=fixture({rollbackFails:true}),pool=await f.options.connect();
 await assert.rejects(requirePodRuntime({pool,env,check:({connect})=>preflight({...f.options,connect})}),/POD_RUNTIME_PREFLIGHT_BLOCKED/);
 assert.deepEqual(f.releases,[true]);assert.equal(f.closed(),false);
});
test('successful preflight rollback releases a reusable connection',async()=>{
 const f=fixture(),r=await preflight(f.options);
 assert.equal(r.status,'CONFIGURATION_VERIFIED');assert.deepEqual(f.releases,[false]);assert.ok(f.closed());
});

test('preflight rejects reused or weak configured keys without reporting credentials',async()=>{
 for(const extra of [{POD_QA_KEY:env.POD_UPSTREAM_KEY},{POD_EDITORIAL_KEY:env.POD_QA_KEY},
  {POD_FINANCE_KEY:'sensitive-short-key'},{POD_MARKET_KEY:'m'.repeat(32),POD_PROVIDER_KEY:'m'.repeat(32)}]){
  const f=fixture(),r=await preflight({...f.options,env:{...env,...extra}});
  assert.equal(r.status,'BLOCKED');
  assert.deepEqual(r.checks.find(c=>c.code==='POD_KEY_ISOLATION'),{code:'POD_KEY_ISOLATION',status:'BLOCKED'});
  for(const value of Object.values(extra))assert.equal(JSON.stringify(r).includes(value),false);
 }
});
