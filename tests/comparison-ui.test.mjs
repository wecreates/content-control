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
 const r=receipt({filename:'candidate.mp4'},{filename:'reference.mp4'},[f],'https://www.instagram.com/reel/abc/');
 for(const k of ['full_video_review','full_audio_review','production_approved','publication_enabled'])assert.equal(r[k],false);
 assert.equal(r.status,'REVIEW_PENDING');
});
test('reference links reject credentials and executable URLs',()=>{
 for(const url of ['javascript:alert(1)','https://user:secret@example.com'])assert.throws(()=>receipt({}, {}, [],url));
});
