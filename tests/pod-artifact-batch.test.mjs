import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {ArtifactStore} from '../integrations/pod/artifacts.mjs';
import {readPackageArtifacts} from '../integrations/pod/package-artifacts.mjs';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const entry=b=>({body:Buffer.from(b),mediaType:'application/json'});

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
  if(sql.includes('ANY('))return {rows:[{sha256:hash(a.body)}]};
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
