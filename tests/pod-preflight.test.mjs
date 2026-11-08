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
test('pre-aborted preflight starts no bridge or database work',async()=>{
 const controller=new AbortController();controller.abort();let invoked=0;
 const r=await preflight({env,signal:controller.signal,readBridge:()=>{invoked++;},connect:()=>{invoked++;}});
 assert.equal(invoked,0);assert.equal(r.status,'BLOCKED');
});
for(const stage of ['bridge','factory','acquisition','query','rollback','shutdown'])test(`preflight cancellation bounds stalled ${stage}`,async()=>{
 const controller=new AbortController(),never=new Promise(()=>{}),releases=[];let ended=0,settle;
 const stall=()=>{controller.abort();return never;};
 const client={query:async sql=>{
  if(stage==='query'||stage==='rollback'&&sql==='ROLLBACK')return stall();
  if(sql==='BEGIN READ ONLY')return {rows:[]};
  throw Error('private backend failure');
 },release:bad=>releases.push(bad)};
 const pool={connect:()=>stage==='acquisition'?new Promise(resolve=>{settle=resolve;controller.abort();}):client,
  end:()=>{ended++;return stage==='shutdown'?stall():Promise.resolve();}};
 const r=await preflight({env,signal:controller.signal,readBridge:()=>stage==='bridge'?stall():bridge,
  connect:()=>stage==='factory'?new Promise(resolve=>{settle=resolve;controller.abort();}):pool});
 assert.equal(r.status,'BLOCKED');assert.equal(r.publication_enabled,false);
 assert.equal(JSON.stringify(r).includes('private backend'),false);
 if(stage==='factory'){settle(pool);await new Promise(resolve=>setImmediate(resolve));assert.equal(ended,1);}
 if(stage==='acquisition'){settle(client);await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(releases,[true]);assert.equal(ended,1);}
 if(['query','rollback'].includes(stage)){assert.deepEqual(releases,[true]);assert.equal(ended,1);}
 if(stage==='shutdown')assert.equal(ended,1);
});
async function bridgeWorkspace(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pod-bridge-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 return root;
}
function fixture(overrides={}){
 const queries=[],releases=[];let released=false,ended=false;
 const client={async query(sql,args){queries.push(sql);
  const output=result=>overrides.queryResult?overrides.queryResult(sql,result):result;
  if((overrides.throwOn&&sql.includes(overrides.throwOn))||(overrides.rollbackFails&&sql==='ROLLBACK'))throw Error('secret password internal-url');
  if(sql.includes('current_schemas(false)'))return output({rows:[{search_path:overrides.searchPath??['pg_catalog','public']}]});
  if(sql.includes('FROM pg_roles r'))return output({rows:[{rolsuper:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false,rolbypassrls:false,db_create:false,db_temp:false,elevated_membership:false,schema_create:false,...overrides.role}]});
  if(sql.includes('pg_stat_ssl'))return output({rows:[{ssl:overrides.tls??true}]});
  if(sql.includes('ANY($1'))return output({rows:args[0].map(relname=>({relname,owns:false,excess:false,can_select:true,can_insert:relname!=='pod_schema_version',can_update:relname!=='pod_schema_version'}))});
  if(sql.includes("relname='cyzor_social_vault'"))return output({rows:[{access:overrides.vault??false,column_access:false,owns:false}]});
  if(sql.includes('SELECT version,sha256'))return output({rows:['001_pod.sql','002_pod.sql','003_pod.sql','004_pod.sql','005_pod.sql'].filter(v=>v!==overrides.missingMigration).map(version=>({version,sha256:overrides.hash??crypto.createHash('sha256').update('sql').digest('hex')}))});
  return output({rows:[]});},release(discard){released=true;releases.push(discard);}};
 return {options:{env,now:0,readFile:async p=>p==='bridge'?JSON.stringify(bridge):'sql',connect:async()=>({connect:async()=>client,end:async()=>{ended=true;}})},queries,releases,closed:()=>released&&ended};
}
for(const failure of ['throw','reject','stall'])test(`preflight redacts ${failure} from client release and still closes its pool`,async()=>{
 const f=fixture(),pool=await f.options.connect(),client=await pool.connect();
 const controller=new AbortController();let attempts=0,ended=0;
 client.release=()=>{attempts++;if(failure==='throw')throw Error('private release detail');
  if(failure==='reject')return Promise.reject(Error('private release detail'));
  controller.abort();return new Promise(()=>{});};
 pool.end=async()=>{ended++;};
 const report=await preflight({...f.options,signal:controller.signal,connect:async()=>pool});
 assert.equal(report.status,'BLOCKED');assert.equal(report.publication_enabled,false);
 assert.equal(report.checks.find(c=>c.code==='DATABASE_READABLE').status,'BLOCKED');
 assert.equal(attempts,1);assert.equal(ended,1);
 assert.equal(JSON.stringify(report).includes('private release'),false);
});
for(const failure of ['throw','reject'])test(`late preflight acquisition consumes ${failure} from client release`,async()=>{
 const controller=new AbortController();let settle,releases=0,ended=0;
 const pool={connect:()=>new Promise(resolve=>{settle=resolve;controller.abort();}),end:async()=>{ended++;}};
 const report=await preflight({env,signal:controller.signal,readBridge:()=>bridge,connect:()=>pool});
 assert.equal(report.status,'BLOCKED');assert.equal(ended,1);
 settle({release:bad=>{assert.equal(bad,true);releases++;if(failure==='throw')throw Error('private late release');
  return Promise.reject(Error('private late release'));}});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(releases,1);
});
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
for(const flag of ['PUBLICATION_ENABLED','POD_PUBLICATION_ENABLED'])test('preflight requires explicit false '+flag+' before and after cleanup',async()=>{
 for(const value of [undefined,null,false,true,0,'','FALSE','False',' false','false ','true','disabled']){
  for(const stage of ['initial','cleanup']){
   const f=fixture(),settings={...env},pool=await f.options.connect(),end=pool.end;
   if(stage==='initial')settings[flag]=value;
   pool.end=async()=>{await end();settings[flag]=stage==='cleanup'?value:'false';};
   const r=await preflight({...f.options,env:settings,connect:async()=>pool});
   assert.equal(r.status,'BLOCKED',`${flag}: ${String(value)} at ${stage}`);
   assert.deepEqual(r.checks.filter(c=>c.code==='PUBLICATION_DISABLED'),[{code:'PUBLICATION_DISABLED',status:'BLOCKED'}]);
   assert.equal(r.publication_enabled,false);assert.ok(f.closed());
  }
 }
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
for(const variant of [
 {name:'search-path result accessor',match:'current_schemas(false)',wrap:(result,reads)=>Object.defineProperty({},'rows',{get(){reads.count++;return result.rows;}})},
 {name:'search-path field accessor',match:'current_schemas(false)',wrap:(result,reads)=>({rows:[Object.defineProperty({},'search_path',{enumerable:true,get(){reads.count++;return result.rows[0].search_path;}})]})},
 {name:'search-path array Proxy',match:'current_schemas(false)',wrap:(result,reads)=>({rows:[{search_path:new Proxy(result.rows[0].search_path,{get(target,key,receiver){reads.count++;return Reflect.get(target,key,receiver);}})}]})},
 {name:'role row Proxy',match:'FROM pg_roles r',wrap:(result,reads)=>({rows:[new Proxy(result.rows[0],{get(target,key,receiver){reads.count++;return Reflect.get(target,key,receiver);}})]})},
 {name:'TLS rows Proxy',match:'pg_stat_ssl',wrap:(result,reads)=>({rows:new Proxy(result.rows,{get(target,key,receiver){reads.count++;return Reflect.get(target,key,receiver);}})})},
 {name:'table result Proxy',match:'c.relname=ANY',wrap:(result,reads)=>new Proxy(result,{get(target,key,receiver){if(key!=='then')reads.count++;return Reflect.get(target,key,receiver);}})},
 {name:'vault row accessor',match:"relname='cyzor_social_vault'",wrap:(result,reads)=>({rows:[{...result.rows[0],get access(){reads.count++;return false;}}]})},
 {name:'migration row Proxy',match:'SELECT version,sha256',wrap:(result,reads)=>({rows:[new Proxy(result.rows[0],{get(target,key,receiver){reads.count++;return Reflect.get(target,key,receiver);}}),...result.rows.slice(1)]})},
])test(`preflight rejects executable ${variant.name} without invocation`,async()=>{
 const reads={count:0},f=fixture({queryResult:(sql,result)=>sql.includes(variant.match)?variant.wrap(result,reads):result});
 const r=await preflight(f.options);
 assert.equal(r.status,'BLOCKED');
 assert.deepEqual(r.checks.filter(c=>c.code==='DATABASE_READABLE'),[{code:'DATABASE_READABLE',status:'BLOCKED'}]);
 assert.equal(reads.count,0);
 assert.ok(f.closed());
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
test('failed preflight transaction open destroys its client without follow-up SQL',async()=>{
 const f=fixture({throwOn:'BEGIN READ ONLY'}),r=await preflight(f.options);
 assert.equal(r.status,'BLOCKED');
 assert.deepEqual(r.checks.filter(c=>c.code==='DATABASE_READABLE'),[{code:'DATABASE_READABLE',status:'BLOCKED'}]);
 assert.deepEqual(f.queries,['BEGIN READ ONLY']);
 assert.deepEqual(f.releases,[true]);
 assert.ok(f.closed());
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
