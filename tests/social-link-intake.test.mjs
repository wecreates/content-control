import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {saveSocialLink} from '../scripts/social_link_intake.mjs';
const url='https://www.instagram.com/reel/DeUlQTQxv5O/';
const authorized={GITHUB_REPOSITORY_OWNER:'owner',GITHUB_ACTOR:'owner',GITHUB_TRIGGERING_ACTOR:'owner',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_dispatch',SOURCE_URL:url};
async function fixture(run) {
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'durable-intake-'));
 const file=path.join(root,'capability-queue.json');
 const original='{"version":1,"queue":[{"id":"legacy","source_url":"https://youtu.be/abcdefghijk","notes":"preserve"}]}\n';
 await fs.writeFile(file,original);
 try{await run(root,file,original);}finally{await fs.rm(root,{recursive:true,force:true});}
}
test('unauthorized actors, rerun actors, branches and events never write',()=>fixture(async(root,file,original)=>{
 for(const override of [{GITHUB_ACTOR:'other'},{GITHUB_TRIGGERING_ACTOR:'other'},{GITHUB_REPOSITORY_OWNER:''},{GITHUB_REF:'refs/heads/other'},{GITHUB_EVENT_NAME:'push'}]) {
  await assert.rejects(saveSocialLink({root,env:{...authorized,...override}}),/OWNER_MAIN_DISPATCH_REQUIRED/);
  assert.equal(await fs.readFile(file,'utf8'),original);
 }
}));
test('duplicates preserve all existing bytes and metadata',()=>fixture(async(root,file,original)=>{
 const receipt=await saveSocialLink({root,env:{...authorized,SOURCE_URL:'https://youtube.com/shorts/abcdefghijk?x=1'}});
 assert.equal(receipt.created,false);assert.equal(receipt.record_id,'legacy');assert.equal(await fs.readFile(file,'utf8'),original);
}));
test('invalid link never changes queue',()=>fixture(async(root,file,original)=>{
 await assert.rejects(saveSocialLink({root,env:{...authorized,SOURCE_URL:'https://evil.example/reel/id'}}));
 assert.equal(await fs.readFile(file,'utf8'),original);
}));
test('new link creates the existing schema with no retrieval or publication',()=>fixture(async(root,file)=>{
 const receipt=await saveSocialLink({root,env:{...authorized,SOURCE_URL:url+'?secret_tracking=removed'}});
 const queue=JSON.parse(await fs.readFile(file,'utf8'));assert.equal(queue.queue.length,2);assert.equal(queue.queue[0].notes,'preserve');
 const record=queue.queue[1];assert.equal(record.publication_enabled,false);assert.equal(record.status,'pending_authorized_retrieval');assert.equal(record.coverage.full_video,false);assert.equal(record.coverage.full_audio,false);assert.deepEqual(record.evidence,[]);assert.deepEqual(record.retrieval_attempts,[]);
 assert.equal(receipt.created,true);assert.equal(receipt.publication_enabled,false);assert.ok(!receipt.source_url.includes('?'));
}));
