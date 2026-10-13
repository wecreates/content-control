import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {parseVaultKey} from '../integrations/social-automation/vault-key.mjs';
import {EncryptedSocialStore} from '../social-automation.js';
import {PostgresSocialStore} from '../integrations/social-automation/postgres-store.mjs';
const bytes=Buffer.from(Array.from({length:32},(_,i)=>i+224));
const hex=bytes.toString('hex'),base64=bytes.toString('base64');
test('hex and canonical padded base64 represent identical 32-byte keys',()=>{
 for(const value of [hex,hex.toUpperCase(),base64])assert.deepEqual(parseVaultKey(value),bytes);
});
test('malformed and noncanonical key encodings fail closed',()=>{
 const badPadBits=base64.slice(0,-2)+'9='; // Same decoded bytes; nonzero unused padding bits.
 assert.deepEqual(Buffer.from(badPadBits,'base64'),bytes);
 for(const value of [undefined,null,32,bytes,'',hex.slice(1),hex+'00',' '+hex,base64+'\n',base64.slice(0,-1),base64+'=',base64.replaceAll('/','_'),badPadBits,Buffer.alloc(31).toString('base64'),Buffer.alloc(33).toString('base64'),'!'.repeat(43)+'='])assert.throws(()=>parseVaultKey(value),/^Error: PRIVATE_STORE_CONFIGURATION_REQUIRED$/);
});
test('both stores preserve existing ciphertext across equivalent key encodings',async t=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'vault-key-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));
 const file=path.join(directory,'vault');const old=new EncryptedSocialStore({file,key:hex});await old.update(d=>{d.marker='preserved';});
 const next=new EncryptedSocialStore({file,key:base64});assert.equal((await next.read()).marker,'preserved');await next.update(d=>{d.marker='updated';});assert.equal((await old.read()).marker,'updated');
 const options={pool:{},expiresAt:'2035-01-01T00:00:00Z'};
 const pgOld=new PostgresSocialStore({...options,key:hex}),pgNext=new PostgresSocialStore({...options,key:base64});const data={version:1,connections:{},jobs:[],marker:'preserved'};
 assert.deepEqual(pgNext.open(pgOld.seal(data)),data);assert.deepEqual(pgOld.open(pgNext.seal(data)),data);
 for(const key of [base64.slice(0,-1),'not-a-key']){assert.throws(()=>new EncryptedSocialStore({file,key}),/CONFIGURATION/);assert.throws(()=>new PostgresSocialStore({...options,key}),/CONFIGURATION/);}
});
