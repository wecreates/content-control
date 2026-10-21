import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {ArtifactStore} from '../integrations/pod/artifacts.mjs';
import {readPackageArtifacts} from '../integrations/pod/package-artifacts.mjs';
import {artifactBudgetBytes} from '../integrations/pod/storage-budget.mjs';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const entry=b=>({body:Buffer.from(b),mediaType:'application/json'});

test('artifact reads require an actual hash string before database access',async()=>{
 const store=new ArtifactStore({active(){},pool:{query(){assert.fail('database reached');}}});
 for(const sha of [null,undefined,[],['a'.repeat(64)],{toString:()=> 'a'.repeat(64)},'A'.repeat(64)]){
  await assert.rejects(store.get(sha),/ARTIFACT_HASH_INVALID/);
 }
});
test('artifact read accepts the exact object ceiling and preserves bytes',async()=>{
 const body=Buffer.from('1234');let checks=0;
 const store=new ArtifactStore({active(){checks++;},pool:{query:async()=>({rows:[{body,media_type:'image/png'}]})}},{maxObjectBytes:4});
 assert.deepEqual(await store.get(hash(body)),{body,media_type:'image/png'});
 assert.equal(checks,2);
});
test('artifact read rejects an oversized returned body even from an alternate pool',async()=>{
 const body=Buffer.from('12345');
 const store=new ArtifactStore({active(){},pool:{query:async()=>({rows:[{body,media_type:'image/png'}]})}},{maxObjectBytes:4});
 await assert.rejects(store.get(hash(body)),/ARTIFACT_UNAVAILABLE/);
});
test('artifact read fails closed for absent, empty, nonbinary or corrupt rows',async()=>{
 for(const row of [undefined,{body:Buffer.alloc(0)},{body:'bytes'},{body:null},{body:Buffer.from('wrong')}]){
  const store=new ArtifactStore({active(){},pool:{query:async()=>({rows:row?[row]:[]})}});
  await assert.rejects(store.get(hash(Buffer.from('expected'))),/^Error: ARTIFACT_UNAVAILABLE$/);
 }
});
test('artifact read rechecks database lifetime after an asynchronous query',async()=>{
 const body=Buffer.from('valid');let expired=false;
 const store=new ArtifactStore({active(){if(expired)throw Error('STORAGE_EXPIRED');},pool:{query:async()=>{
  expired=true;return {rows:[{body,media_type:'image/png'}]};
 }}});
 await assert.rejects(store.get(hash(body)),/STORAGE_EXPIRED/);
});
test('inactive artifact storage never starts a read query',async()=>{
 const store=new ArtifactStore({active(){throw Error('STORAGE_EXPIRED');},pool:{query(){assert.fail('database reached');}}});
 await assert.rejects(store.get('a'.repeat(64)),/STORAGE_EXPIRED/);
});

test('artifact bytes are snapshotted before database waits',async()=>{
 const a=entry('original'),original=Buffer.from(a.body);let inserted;
 const db={tx:async fn=>{
  a.body.fill(120);a.mediaType='image/png';
  return fn({query:async(sql,args)=>{
   if(sql.includes('sum('))return {rows:[{bytes:'0'}]};
   if(sql.startsWith('INSERT'))inserted=args;
   return {rows:[]};
  }});
 }};
 assert.equal(await new ArtifactStore(db).put(a.body,a.mediaType),hash(original));
 assert.equal(inserted[0],hash(inserted[1]));
 assert.deepEqual(inserted[1],original);assert.equal(inserted[2],'application/json');
});

test('regional-rights evidence accepts text/plain and rejects unapproved media before storage',async()=>{
 const writes=[];
 const db={tx:fn=>fn({query:async(sql,args)=>{
  if(sql.includes('sum('))return {rows:[{bytes:'0'}]};
  if(sql.startsWith('INSERT'))writes.push(args);
  return {rows:[]};
 }})};
 const body=Buffer.from('synthetic rights evidence; not legal approval');
 assert.equal(await new ArtifactStore(db).put(body,'text/plain'),hash(body));
 assert.equal(writes.length,1);assert.equal(writes[0][2],'text/plain');
 await assert.rejects(new ArtifactStore({tx(){assert.fail('database reached');}}).put(body,'text/html'),/ARTIFACT_INVALID/);
});

test('deployment budget accepts only bounded positive decimal byte strings',()=>{
 assert.equal(artifactBudgetBytes({}),134217728);
 for(const bytes of ['1','64','134217728'])assert.equal(artifactBudgetBytes({POD_ARTIFACT_BUDGET_BYTES:bytes}),Number(bytes));
 for(const raw of ['',null,true,64,'0','-1','1.5','1e3','0x100',' 64','64 ','064','NaN','Infinity','134217729','9007199254740993']){
  assert.throws(()=>artifactBudgetBytes({POD_ARTIFACT_BUDGET_BYTES:raw}),/ARTIFACT_BUDGET_CONFIG_INVALID/);
 }
});

test('invalid batches fail before acquiring a database connection',async()=>{
 const store=new ArtifactStore({tx(){throw Error('unexpected database access');}},{maxObjectBytes:10,maxBatchBytes:12});
 assert.deepEqual(await store.putMany([]),[]);
 for(const batch of [null,{},Array(33).fill(entry('a'))])await assert.rejects(store.putMany(batch),/ARTIFACT_BATCH_INVALID/);
 for(const batch of [[null],[entry('')],[entry('a'.repeat(11))],[{body:'abc',mediaType:'application/json'}]])await assert.rejects(store.putMany(batch),/ARTIFACT_INVALID/);
 await assert.rejects(store.putMany([entry('1234567'),entry('123456')]),/ARTIFACT_BATCH_TOO_LARGE/);
});

test('batch budget is checked before any insert and counts distinct missing bytes',async()=>{
 const a=entry('aaaa'),b=entry('bb'),writes=[];
 const db={tx:fn=>fn({query:async(sql,args)=>{
  if(sql.includes('ANY('))return {rows:[{sha256:hash(a.body),body_sha256:hash(a.body),media_type:a.mediaType}]};
  if(sql.includes('sum('))return {rows:[{bytes:'4'}]};
  if(sql.startsWith('INSERT'))writes.push(args);
  return {rows:[]};
 }})};
 const store=new ArtifactStore(db,{budgetBytes:6});
 assert.deepEqual(await store.putMany([a,b,b]),[hash(a.body),hash(b.body),hash(b.body)]);
 assert.equal(writes.length,1);assert.equal(writes[0][0],hash(b.body));
 writes.length=0;
 await assert.rejects(new ArtifactStore(db,{budgetBytes:5}).putMany([a,b]),/ARTIFACT_BUDGET_EXHAUSTED/);
 assert.equal(writes.length,0);
});

async function fixture(fn){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pod-artifact-read-'));
 try{await fn(root);}finally{await fs.rm(root,{recursive:true,force:true});}
}
test('same-batch media conflicts fail before database access',async()=>{
 const a=entry('same bytes');
 const store=new ArtifactStore({tx(){assert.fail('must not open a transaction');}});
 await assert.rejects(store.putMany([a,{body:Buffer.from(a.body),mediaType:'image/png'}]),/ARTIFACT_CONFLICT/);
});
test('existing corrupt bytes or media conflicts reject the whole batch before inserts',async()=>{
 const a=entry('existing'),b=entry('new');
 for(const existing of [
  {sha256:hash(a.body),body_sha256:hash(a.body),media_type:'image/png'},
  {sha256:hash(a.body),body_sha256:hash('corrupted'),media_type:a.mediaType}
 ]){
  let inserts=0;
  const db={tx:fn=>fn({query:async(sql)=>{
   if(sql.includes('ANY('))return {rows:[existing]};
   if(sql.startsWith('INSERT'))inserts++;
   return {rows:[]};
  }})};
  await assert.rejects(new ArtifactStore(db).putMany([b,a]),/ARTIFACT_CONFLICT/);
  assert.equal(inserts,0);
 }
});
test('package reads preserve exact bytes, order and media types',()=>fixture(async root=>{
 const files={'print.png':Buffer.from('png fixture'),'cover.pdf':Buffer.from('pdf fixture'),'interior.receipt.json':Buffer.from('{}')};
 for(const [name,body] of Object.entries(files))await fs.writeFile(path.join(root,name),body);
 const result=await readPackageArtifacts(root,Object.fromEntries(Object.entries(files).map(([name,body])=>[name,hash(body)])));
 assert.deepEqual(result.map(x=>x.body),Object.values(files));
 assert.deepEqual(result.map(x=>x.mediaType),['image/png','application/pdf','application/json']);
}));
test('package file corruption and escaped symlinks fail before persistence',()=>fixture(async root=>{
 await fs.mkdir(path.join(root,'package'));await fs.writeFile(path.join(root,'outside'),'secret fixture');
 await fs.symlink(path.join(root,'outside'),path.join(root,'package','escape'));
 await assert.rejects(readPackageArtifacts(path.join(root,'package'),{escape:hash('secret fixture')}),/ARTIFACT_PATH_INVALID/);
 await fs.writeFile(path.join(root,'package','wrong.png'),'wrong');
 await assert.rejects(readPackageArtifacts(path.join(root,'package'),{'wrong.png':hash('expected')}),/ARTIFACT_HASH_MISMATCH/);
}));
test('file and aggregate limits are applied before unbounded reads',()=>fixture(async root=>{
 const handle=await fs.open(path.join(root,'large.png'),'w');await handle.truncate(16777217);await handle.close();
 await assert.rejects(readPackageArtifacts(root,{'large.png':'a'.repeat(64)}),/ARTIFACT_INVALID/);
 await fs.writeFile(path.join(root,'a.png'),'123456');await fs.writeFile(path.join(root,'b.png'),'654321');
 await assert.rejects(readPackageArtifacts(root,{'a.png':hash('123456'),'b.png':hash('654321')},{maxBatchBytes:10}),/ARTIFACT_BATCH_TOO_LARGE/);
 await fs.mkdir(path.join(root,'folder'));
 await assert.rejects(readPackageArtifacts(root,{folder:'a'.repeat(64)}),/ARTIFACT_INVALID/);
}));
