import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {verifyProductionSourceEvidence,verifySourceEvidence} from '../integrations/pod/source-evidence.mjs';

const key='synthetic-source-evidence-key-'.repeat(2);
const hash=body=>crypto.createHash('sha256').update(body).digest('hex');
const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:
 value&&typeof value==='object'?`{${Object.keys(value).sort().map(name=>`${JSON.stringify(name)}:${canonical(value[name])}`).join(',')}}`:
 JSON.stringify(value);
const sign=value=>{const payload=JSON.stringify({schema_version:1,issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,...value});return {payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};};
async function fixture(run){const root=await fs.mkdtemp(path.join(os.tmpdir(),'pod-source-evidence-'));try{await run(root);}finally{await fs.rm(root,{recursive:true,force:true});}}

test('parent authenticates task rights and exact source bytes',()=>fixture(async root=>{
 const source=path.join(root,'source.png'),rights=path.join(root,'rights.json'),body=Buffer.from('synthetic artwork');
 await fs.writeFile(source,body);await fs.writeFile(rights,JSON.stringify(sign({audience:'pod:asset-rights',status:'PASS',source_sha256:hash(body)})));
 assert.equal(await verifySourceEvidence(source,rights,key),hash(body));
 await fs.appendFile(source,'changed');
 await assert.rejects(verifySourceEvidence(source,rights,key),/^Error: SOURCE_HASH_MISMATCH$/);
}));

test('parent snapshots and authenticates exact production text layers',()=>fixture(async root=>{
 const source=path.join(root,'source.png'),rights=path.join(root,'rights.json'),layers=path.join(root,'layers.json');
 const body=Buffer.from('synthetic artwork'),text=[{text:'Authorized',font_sha256:'a'.repeat(64)}];
 await fs.writeFile(source,body);await fs.writeFile(layers,JSON.stringify(text));
 await fs.writeFile(rights,JSON.stringify(sign({audience:'pod:asset-rights',status:'PASS',source_sha256:hash(body),text_layers_sha256:hash(canonical(text))})));
 assert.deepEqual(await verifyProductionSourceEvidence(source,rights,layers,key),
  {sourceSha256:hash(body),textLayers:text,textLayersSha256:hash(canonical(text))});
 await fs.writeFile(layers,JSON.stringify([{...text[0],text:'Substituted'}]));
 await assert.rejects(verifyProductionSourceEvidence(source,rights,layers,key),/^Error: TEXT_LAYERS_HASH_MISMATCH$/);
 await fs.writeFile(layers,'[{"text":"a","text":"b","font_sha256":"'+('a'.repeat(64))+'"}]');
 await assert.rejects(verifyProductionSourceEvidence(source,rights,layers,key),/^Error: TEXT_LAYERS_INVALID$/);
}));

test('malformed, expired, ambiguous or unapproved rights fail closed',()=>fixture(async root=>{
 const source=path.join(root,'source.png'),rights=path.join(root,'rights.json'),body=Buffer.from('synthetic artwork');await fs.writeFile(source,body);
 for(const value of [
  sign({audience:'pod:asset-rights',status:'FAIL',source_sha256:hash(body)}),
  sign({audience:'wrong',status:'PASS',source_sha256:hash(body)}),
  {payload:'{}',signature:'0'.repeat(64)},
 ]){await fs.writeFile(rights,JSON.stringify(value));await assert.rejects(verifySourceEvidence(source,rights,key),/^Error: SOURCE_RIGHTS_INVALID$/);}
 const valid=JSON.stringify(sign({audience:'pod:asset-rights',status:'PASS',source_sha256:hash(body)}));
 await fs.writeFile(rights,valid.replace('{"payload":','{"payload":"ignored","payload":'));
 await assert.rejects(verifySourceEvidence(source,rights,key),/^Error: SOURCE_RIGHTS_INVALID$/);
}));

test('nonregular inputs and cancellation never enter generation',()=>fixture(async root=>{
 const source=path.join(root,'source.png'),rights=path.join(root,'rights.json'),fifo=path.join(root,'pipe');
 await fs.writeFile(source,'fixture');await fs.writeFile(rights,JSON.stringify(sign({audience:'pod:asset-rights',status:'PASS',source_sha256:hash('fixture')})));execFileSync('mkfifo',[fifo]);
 await assert.rejects(verifySourceEvidence(fifo,rights,key),/^Error: SOURCE_BYTES_INVALID$/);
 const controller=new AbortController();controller.abort();
 await assert.rejects(verifySourceEvidence(source,rights,key,{signal:controller.signal}),/^Error: PRODUCTION_STOPPED$/);
}));
