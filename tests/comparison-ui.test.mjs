import test from 'node:test';
import assert from 'node:assert/strict';
import {finding,receipt} from '../comparison-ui/model.mjs';
test('missing and out of range media cannot create findings',()=>{
 assert.throws(()=>finding(null,{},'Hook','Observed difference','Repair'));
 assert.throws(()=>finding({time:11,duration:10},{time:0,duration:10},'Hook','Observed difference','Repair'));
});
test('notes preserve independent timestamps and cannot approve content',()=>{
 const f=finding({time:2,duration:10},{time:4,duration:20},'Hook','Reference starts with action','Start candidate with action');
 assert.equal(f.candidate_sec,2);assert.equal(f.reference_sec,4);
 const r=receipt({filename:'candidate.mp4',identity_verified:true,sha256:'a'.repeat(64)},{filename:'reference.mp4',identity_verified:true,sha256:'b'.repeat(64)},[f],'https://www.instagram.com/reel/abc/');
 for(const k of ['full_video_review','full_audio_review','production_approved','publication_enabled'])assert.equal(r[k],false);
 assert.equal(r.status,'REVIEW_PENDING');
});
test('reference links reject credentials and executable URLs',()=>{
 for(const url of ['javascript:alert(1)','https://user:secret@example.com'])assert.throws(()=>receipt({identity_verified:true,sha256:'a'.repeat(64)}, {identity_verified:true,sha256:'b'.repeat(64)}, [],url));
});

import {fileIdentity,HASH_CHUNK_BYTES} from '../comparison-ui/hash.mjs';
import {createHash} from 'node:crypto';
test('file identity matches exact bytes',async()=>{
 const file=new Blob(['exact media bytes']);
 const identity=await fileIdentity(file);
 assert.equal(identity.sha256,createHash('sha256').update('exact media bytes').digest('hex'));
 assert.equal(identity.byte_length,file.size);

});
test('export refuses missing or failed file identity',()=>{
 assert.throws(()=>receipt({}, {}, [],''),/hashes/);
 const known={identity_verified:true,sha256:'a'.repeat(64)};
 assert.throws(()=>receipt(known,{...known,sha256:'invalid'},[],''),/hashes/);
});
test('invalid duration cannot produce time-bound findings',()=>{
 for(const duration of [undefined,NaN,Infinity,0])assert.throws(()=>finding({time:0,duration},{time:0,duration:1},'Hook','Observation','Repair'));
});

test('large files are read in bounded chunks and match native SHA-256',async()=>{
 const data=Buffer.alloc(HASH_CHUNK_BYTES*3+63,17);const slices=[];
 const file={size:data.length,slice(start,end){slices.push(end-start);return new Blob([data.subarray(start,end)]);},arrayBuffer(){throw Error('Whole-file allocation forbidden');}};
 assert.equal((await fileIdentity(file)).sha256,createHash('sha256').update(data).digest('hex'));
 assert.equal(slices.length,4);assert.ok(slices.every(n=>n<=HASH_CHUNK_BYTES));
});
test('partial reads never produce a verified identity',async()=>{
 await assert.rejects(()=>fileIdentity({size:10,slice(){return new Blob(['short']);}}),/Incomplete/);
});
