import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {applyInstagramRead,recordInstagramRead} from '../scripts/record_instagram_read.mjs';
import {connectionStatus} from '../social-intake.js';
const now=Date.parse('2026-10-12T13:00:00Z');
const matrix={platforms:[{id:'instagram',eligibility:'preserve',connection:{connected:false}},{id:'youtube',connection:{status:'unverified'}}]};
const report={provider:'meta_business_sdk',route:'instagram_api_with_facebook_login',publication_enabled:false,full_analysis:false,checked_at:'2026-10-12T12:00:00Z',status:'PASS',connected:true,read_check:{provider:'Meta Graph API',observed:'authorized_account_and_media_page',result:'read_verified'},media_items_checked:2,video_items_checked:1,pagination_followed:false};
test('adapter proof maps into coherent dashboard read status, strips secrets and preserves matrix',()=>{
 const input=structuredClone(matrix),r=applyInstagramRead(input,{...report,access_token:'SECRET',identity:{username:'PRIVATE'}},{now});
 assert.deepEqual(input,matrix);assert.deepEqual(r.matrix.platforms[1],matrix.platforms[1]);assert.equal(r.matrix.platforms[0].eligibility,'preserve');assert.equal(connectionStatus(r.matrix.platforms[0].connection,now).read_verified,true);assert.equal(JSON.stringify(r.matrix).includes('SECRET'),false);assert.equal(JSON.stringify(r.matrix).includes('PRIVATE'),false);
 assert.equal(applyInstagramRead(r.matrix,report,{now}).changed,false);
});
test('blocked receipt records disconnected failure and removes previous success timestamp',()=>{
 const success=applyInstagramRead(matrix,report,{now}).matrix;
 const blocked={...report,status:'BLOCKED',connected:false,checked_at:'2026-10-12T12:30:00Z',read_check:undefined,reason:'authorization_rejected'};
 const r=applyInstagramRead(success,blocked,{now});const c=r.matrix.platforms[0].connection;assert.equal(connectionStatus(c,now).status,'disconnected');assert.equal(c.last_read_verified_at,undefined);assert.equal(c.error_code,'AUTHORIZATION_REJECTED');
 assert.throws(()=>applyInstagramRead(r.matrix,report,{now}),/Stale/);
});
test('malformed, future, contradictory, out-of-bound and stale reports reject',()=>{
 for(const change of [{provider:'other'},{publication_enabled:true},{full_analysis:true},{checked_at:'2026-10-13'},{status:'BLOCKED'},{media_items_checked:6},{read_check:{...report.read_check,checked_at:'2026-10-12T11:00:00Z'}},{read_check:{...report.read_check,provider:'other'}}])assert.throws(()=>applyInstagramRead(matrix,{...report,...change},{now}));
 const success=applyInstagramRead(matrix,report,{now}).matrix;assert.throws(()=>applyInstagramRead(success,{...report,status:'BLOCKED',connected:false,read_check:undefined,reason:'provider_read_failed'},{now}),/Conflicting/);
});
test('atomic file write succeeds while malformed receipt never changes existing bytes',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ig-read-'));const mp=path.join(dir,'matrix.json'),rp=path.join(dir,'report.json');
 try{await fs.writeFile(mp,JSON.stringify(matrix));await fs.writeFile(rp,JSON.stringify(report));assert.equal((await recordInstagramRead(rp,mp,{now})).changed,true);const before=await fs.readFile(mp,'utf8');await fs.writeFile(rp,JSON.stringify({...report,provider:'bad'}));await assert.rejects(recordInstagramRead(rp,mp,{now}));assert.equal(await fs.readFile(mp,'utf8'),before);assert.deepEqual((await fs.readdir(dir)).sort(),['matrix.json','report.json']);}finally{await fs.rm(dir,{recursive:true,force:true});}
});
