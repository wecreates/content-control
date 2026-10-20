import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {verifyTemplateSource} from '../integrations/pod/template-source.mjs';

const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function workspace(run){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pod-template-source-'));
 try{await run(root);}finally{await fs.rm(root,{recursive:true,force:true});}
}
test('retained official ZIP has its observed byte identity without conferring approval',async()=>{
 const file=new URL('../integrations/pod/templates/kdp/2026-10-20/paperback-6x9-24-bw-white-en_US.zip',import.meta.url);
 await verifyTemplateSource(file.pathname,'27915e7cfe7b7eb14b17044e996a8152440836f26e562130ea85a7b61a9ab6ac');
 await assert.rejects(verifyTemplateSource(file.pathname,'a'.repeat(64)),/TEMPLATE_SOURCE_HASH_MISMATCH/);
});
test('source byte changes and malformed identity block admission',async()=>workspace(async root=>{
 const file=path.join(root,'source'),bytes=Buffer.from('retained fixture');await fs.writeFile(file,bytes);
 await verifyTemplateSource(file,digest(bytes));
 await fs.appendFile(file,'changed');
 await assert.rejects(verifyTemplateSource(file,digest(bytes)),/TEMPLATE_SOURCE_HASH_MISMATCH/);
 for(const hash of [null,[],['a'.repeat(64)],'A'.repeat(64)])
  await assert.rejects(verifyTemplateSource(file,hash),/TEMPLATE_PROVENANCE_REQUIRED/);
 for(const filename of [null,[],42,''])await assert.rejects(verifyTemplateSource(filename,digest(bytes)),/TEMPLATE_SOURCE_REQUIRED/);
}));
test('source ceiling admits exactly 16 MiB and rejects empty or larger regular files',async()=>workspace(async root=>{
 const file=path.join(root,'source'),bytes=Buffer.alloc(16*1024*1024,7);await fs.writeFile(file,bytes);
 await verifyTemplateSource(file,digest(bytes));await fs.appendFile(file,'x');
 await assert.rejects(verifyTemplateSource(file,digest(bytes)),/TEMPLATE_SOURCE_TOO_LARGE/);
 await fs.truncate(file,0);await assert.rejects(verifyTemplateSource(file,digest(Buffer.alloc(0))),/TEMPLATE_SOURCE_INVALID/);
}));
test('nonregular sources, final symlinks and missing paths fail without waiting for pipe writers',async()=>workspace(async root=>{
 const file=path.join(root,'source'),link=path.join(root,'link'),fifo=path.join(root,'pipe');
 await fs.writeFile(file,'fixture');await fs.symlink(file,link);execFileSync('mkfifo',[fifo]);
 for(const candidate of [root,link,fifo,path.join(root,'missing')])
  await assert.rejects(verifyTemplateSource(candidate,digest('fixture')),/^Error: TEMPLATE_SOURCE_INVALID$/);
}));
test('actual reads remain bounded if the initial stat understates source size',async()=>workspace(async root=>{
 const file=path.join(root,'source');await fs.writeFile(file,Buffer.alloc(16*1024*1024+1,1));
 const original=fs.open;let closed=false,readBytes=0;
 fs.open=async(...args)=>{const handle=await original(...args);return {
  stat:async()=>({isFile:()=>true,size:1}),
  read:async(...args)=>{const r=await handle.read(...args);readBytes+=r.bytesRead;return r;},
  close:async()=>{closed=true;await handle.close();}};};
 try{await assert.rejects(verifyTemplateSource(file,'a'.repeat(64)),/TEMPLATE_SOURCE_TOO_LARGE/);}
 finally{fs.open=original;}
 assert.equal(readBytes,16*1024*1024+1);assert.equal(closed,true);
}));
test('read failures are redacted and always close the opened descriptor',async()=>workspace(async root=>{
 const file=path.join(root,'source');await fs.writeFile(file,'fixture');const original=fs.open;let closed=false;
 fs.open=async(...args)=>{const handle=await original(...args);return {stat:()=>handle.stat(),
  read:async()=>{throw Error('private path and source details');},close:async()=>{closed=true;await handle.close();}};};
 try{await assert.rejects(verifyTemplateSource(file,'a'.repeat(64)),/^Error: TEMPLATE_SOURCE_INVALID$/);}
 finally{fs.open=original;}
 assert.equal(closed,true);
}));
test('cancellation before open or during reads stops and releases the file',async()=>workspace(async root=>{
 const file=path.join(root,'source');await fs.writeFile(file,'fixture');const controller=new AbortController();controller.abort();
 await assert.rejects(verifyTemplateSource(file,'a'.repeat(64),{signal:controller.signal}),/PRODUCTION_STOPPED/);
 const active=new AbortController(),original=fs.open;let closed=false;
 fs.open=async(...args)=>{const handle=await original(...args);return {stat:()=>handle.stat(),
  read:async(...args)=>{const r=await handle.read(...args);active.abort();return r;},close:async()=>{closed=true;await handle.close();}};};
 try{await assert.rejects(verifyTemplateSource(file,digest('fixture'),{signal:active.signal}),/PRODUCTION_STOPPED/);}
 finally{fs.open=original;}
 assert.equal(closed,true);
}));
