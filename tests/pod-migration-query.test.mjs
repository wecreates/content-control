import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import {migrate} from '../scripts/pod_storage_init.mjs';

const emptyDirectory=new URL('./pricewatch_core/fixtures/',import.meta.url);
const role={rolsuper:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false,rolbypassrls:false};
function fixture({match,wrap,provisionPassword,directory=emptyDirectory}={}){
 const queries=[],releases=[];
 const client={async query(sql,args){
  queries.push(sql);
  let result;
  if(sql==='SELECT 1 AS present FROM pg_roles WHERE rolname=$1')result={rows:[]};
  else if(sql.startsWith("SELECT format('CREATE ROLE"))result={rows:[{sql:'CREATE ROLE "pod_runtime" LOGIN'}]};
  else if(sql.startsWith('SELECT rolsuper'))result={rows:[role]};
  else if(sql==='SELECT current_user AS name')result={rows:[{name:'migration_owner'}]};
  else if(sql.startsWith('SELECT EXISTS'))result={rows:[{elevated:false}]};
  else if(sql.startsWith("SELECT format('REVOKE TEMPORARY"))result={rows:[{sql:'REVOKE TEMPORARY ON DATABASE "fixture" FROM PUBLIC'}]};
  else if(sql==='SELECT sha256 FROM pod_schema_version WHERE version=$1'){
   const body=await fs.readFile(new URL(args[0],directory),'utf8');
   result={rows:[{sha256:crypto.createHash('sha256').update(body).digest('hex')}]};
  }else if(['BEGIN','COMMIT','ROLLBACK'].includes(sql))result={command:sql};
  else result={rows:[]};
  return match?.(sql)?wrap(result):result;
 },release:discard=>releases.push(Boolean(discard))};
 return {pool:{connect:async()=>client},queries,releases,options:{provisionPassword},directory};
}

for(const [phase,tag] of [['BEGIN','SELECT'],['COMMIT','ROLLBACK']])test('privileged migration refuses unverified '+phase,async()=>{
 const f=fixture({match:sql=>sql===phase,wrap:()=>({command:tag})});
 await assert.rejects(migrate(f.pool,'pod_runtime',f.directory),new RegExp('^Error: POD_'+phase+'_UNVERIFIED$'));
 if(phase==='BEGIN')assert.deepEqual(f.queries,['BEGIN']);
 else{assert.equal(f.queries.at(-1),'COMMIT');assert.equal(f.queries.includes('ROLLBACK'),false);}
 assert.deepEqual(f.releases,[true]);
});

test('unverified migration rollback discards the client and preserves the original error',async()=>{
 const original=Error('STORAGE_EXPIRING'),f=fixture({match:sql=>sql==='ROLLBACK',wrap:()=>({command:'SELECT'})});
 await assert.rejects(migrate(f.pool,'pod_runtime',f.directory,{assertActive:()=>{throw original;}}),error=>error===original);
 assert.equal(f.queries.at(-1),'ROLLBACK');assert.deepEqual(f.releases,[true]);
});

for(const variant of [
 {name:'runtime-role result rows accessor',match:sql=>sql.startsWith('SELECT rolsuper'),wrap:(result,reads)=>Object.defineProperty({},'rows',{get(){reads.count++;return result.rows;}})},
 {name:'runtime-role row Proxy',match:sql=>sql.startsWith('SELECT rolsuper'),wrap:(result,reads)=>({rows:[new Proxy(result.rows[0],{get(target,key,receiver){reads.count++;return Reflect.get(target,key,receiver);}})]})},
 {name:'migration-owner field accessor',match:sql=>sql==='SELECT current_user AS name',wrap:(result,reads)=>({rows:[Object.defineProperty({},'name',{enumerable:true,get(){reads.count++;return result.rows[0].name;}})]})},
 {name:'inherited-role rows Proxy',match:sql=>sql.startsWith('SELECT EXISTS'),wrap:(result,reads)=>({rows:new Proxy(result.rows,{get(target,key,receiver){reads.count++;return Reflect.get(target,key,receiver);}})})},
 {name:'TEMP-revocation row Proxy',match:sql=>sql.startsWith("SELECT format('REVOKE TEMPORARY"),wrap:(result,reads)=>({rows:[new Proxy(result.rows[0],{get(target,key,receiver){reads.count++;return Reflect.get(target,key,receiver);}})]})},
])test(`migration rejects executable ${variant.name} without invocation`,async()=>{
 const reads={count:0},f=fixture({match:variant.match,wrap:result=>variant.wrap(result,reads)});
 await assert.rejects(migrate(f.pool,'pod_runtime',f.directory,f.options),/POD_MIGRATION_QUERY_UNVERIFIED/);
 assert.equal(reads.count,0);
 assert.equal(f.queries.at(-1),'ROLLBACK');
 assert.deepEqual(f.releases,[false]);
});

for(const variant of [
 {name:'role-existence rows accessor',match:sql=>sql==='SELECT 1 AS present FROM pg_roles WHERE rolname=$1',wrap:(result,reads)=>Object.defineProperty({},'rows',{get(){reads.count++;return result.rows;}})},
 {name:'generated-role field accessor',match:sql=>sql.startsWith("SELECT format('CREATE ROLE"),wrap:(result,reads)=>({rows:[Object.defineProperty({},'sql',{enumerable:true,get(){reads.count++;return result.rows[0].sql;}})]})},
])test(`role provisioning rejects executable ${variant.name} without invocation`,async()=>{
 const reads={count:0},f=fixture({match:variant.match,wrap:result=>variant.wrap(result,reads),provisionPassword:'fixture-password-'.repeat(3)});
 await assert.rejects(migrate(f.pool,'pod_runtime',f.directory,f.options),/POD_MIGRATION_QUERY_UNVERIFIED/);
 assert.equal(reads.count,0);
 assert.equal(f.queries.at(-1),'ROLLBACK');
 assert.deepEqual(f.releases,[false]);
});

test('migration checksum lookup rejects an executable row without invocation',async()=>{
 const reads={count:0},f=fixture({directory:new URL('../migrations/',import.meta.url),
  match:sql=>sql==='SELECT sha256 FROM pod_schema_version WHERE version=$1',
  wrap:result=>({rows:[new Proxy(result.rows[0],{get(target,key,receiver){reads.count++;return Reflect.get(target,key,receiver);}})]})});
 await assert.rejects(migrate(f.pool,'pod_runtime',f.directory,f.options),/POD_MIGRATION_QUERY_UNVERIFIED/);
 assert.equal(reads.count,0);
 assert.equal(f.queries.at(-1),'ROLLBACK');
 assert.deepEqual(f.releases,[false]);
});
