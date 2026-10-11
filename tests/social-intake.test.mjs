import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {normalizeSocialUrl,addIntake,routeFinding,denyExternalAction,connectionStatus,planTokenRenewal,updateQueueFile} from '../social-intake.js';
const reel='https://www.instagram.com/reel/DeUlQTQxv5O/';
test('canonical content identities and exact host validation',()=>{
 assert.equal(normalizeSocialUrl(reel+'?tracking=x').canonical_id,normalizeSocialUrl('https://instagram.com/p/DeUlQTQxv5O/').canonical_id);
 assert.equal(normalizeSocialUrl('https://youtu.be/abcdefghijk?t=3').canonical_id,normalizeSocialUrl('https://youtube.com/shorts/abcdefghijk').canonical_id);
 for(const raw of ['https://instagram.com.evil.test/reel/a','http://instagram.com/reel/a','https://user:secret@instagram.com/reel/a','https://127.0.0.1/a','https://instagram.com/accounts/login','https://instagram.com:8080/reel/a'])assert.throws(()=>normalizeSocialUrl(raw));
});
test('nine platform content routes',()=>{
 for(const [p,u] of Object.entries({instagram:reel,facebook:'https://facebook.com/reel/123',youtube:'https://youtu.be/abcdefghijk',tiktok:'https://tiktok.com/@creator/video/123',threads:'https://threads.net/@creator/post/abc',x:'https://twitter.com/creator/status/123',pinterest:'https://pinterest.com/pin/123',linkedin:'https://linkedin.com/feed/update/urn:li:activity:123',reddit:'https://reddit.com/r/test/comments/abc/title/'}))assert.equal(normalizeSocialUrl(u).platform,p);
});
test('intake deduplicates existing queue preserving unrelated records and missing coverage',()=>{
 const initial={version:1,queue:[{id:'old',source_url:reel,notes:'preserve'}]};
 const dedupe=addIntake(initial,reel+'?x=y'); assert.equal(dedupe.created,false);assert.deepEqual(initial,dedupe.queue);
 const a=addIntake({version:1,queue:[]},reel);assert.equal(a.record.coverage.full_video,false);assert.deepEqual(a.record.evidence,[]);assert.equal(a.record.publication_enabled,false);
});
test('finding routing requires evidence, project and actual timestamp coverage',()=>{
 const {queue,record}=addIntake(null,reel);
 const finding={id:'f1',project:'content-control',category:'Content-production technique',summary:'Observed cut',basis:'audiovisual',evidence_refs:['e1']};
 const opts={allowedProjects:['content-control']};
 assert.throws(()=>routeFinding(queue,record.id,finding,opts));
 record.evidence.push({id:'e1',verified:true,kind:'audiovisual',start_seconds:1,end_seconds:2});
 assert.throws(()=>routeFinding(queue,record.id,finding,opts));
 record.coverage.segments.push({start_seconds:0,end_seconds:3,video:true,audio:true});
 const result=routeFinding(queue,record.id,finding,opts); assert.equal(result.record.findings.length,1);assert.equal(record.findings.length,0);
 assert.throws(()=>routeFinding(queue,record.id,{...finding,project:'invented'},opts));
 assert.throws(()=>routeFinding(queue,record.id,{...finding,full_analysis:true},opts));
 record.evidence.push({id:'m1',verified:true,kind:'metadata'});
 assert.equal(routeFinding(queue,record.id,{...finding,basis:'metadata',evidence_refs:['m1']},opts).finding.full_analysis,false);
 assert.throws(()=>routeFinding(queue,record.id,{...finding,basis:'metadata',evidence_refs:['m1'],full_analysis:true},opts));
});
test('external effects remain denied on retries and hostile environment',()=>{
 const previous=process.env.PUBLICATION_ENABLED; process.env.PUBLICATION_ENABLED='true';
 try{for(let retry=0;retry<3;retry++)for(const action of ['publish','send_message','launch_ads','spend','schedule','anything'])assert.throws(()=>denyExternalAction(action),{code:'PUBLICATION_DISABLED'});}finally{if(previous===undefined)delete process.env.PUBLICATION_ENABLED;else process.env.PUBLICATION_ENABLED=previous;}
});
test('connection status does not expose tokens or fabricate current verification',()=>{
 assert.equal(connectionStatus({token:'secret'}).status,'unverified');
 assert.equal(connectionStatus({last_read_verified_at:'2020-01-01',expires_at:'2020-01-02'}).status,'expired');
 assert.equal(planTokenRenewal({renewal_supported:true,expires_at:'2020-01-02'}).action,'renewal_due');
 assert.equal(planTokenRenewal({}).automatic,false);
});
test('atomic serialized updates preserve concurrent intake additions',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'social-intake-'));const file=path.join(dir,'capability-queue.json');
 try{await fs.writeFile(file,JSON.stringify({version:1,queue:[]}));await Promise.all([updateQueueFile(file,q=>addIntake(q,reel)),updateQueueFile(file,q=>addIntake(q,'https://youtu.be/abcdefghijk')),updateQueueFile(file,q=>addIntake(q,reel+'?x=1'))]);assert.equal(JSON.parse(await fs.readFile(file)).queue.length,2);assert.deepEqual(await fs.readdir(dir),['capability-queue.json']);}finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('transcripts and sampled frames route only explicitly limited observations',()=>{
 const {queue,record}=addIntake(null,reel);
 const opts={allowedProjects:['content-control']};
 const base={project:'content-control',category:'Content-production technique',summary:'Limited observation'};
 record.evidence.push({id:'t1',kind:'transcript',verified:true,start_seconds:0,end_seconds:52.08},{id:'s1',kind:'sampled_frame',verified:true,seconds:15});
 record.coverage.transcript_segments=[{start_seconds:0,end_seconds:52.08}];
 record.coverage.sampled_frame_seconds=[0,15,35];
 for(const [basis,ref] of [['transcript','t1'],['sampled_frame','s1']]) {
   const f={...base,basis,evidence_refs:[ref]};
   assert.equal(routeFinding(queue,record.id,f,opts).finding.full_analysis,false);
   assert.throws(()=>routeFinding(queue,record.id,{...f,full_analysis:true},opts));
   assert.throws(()=>routeFinding(queue,record.id,{...f,basis:'audiovisual'},opts));
 }
 record.evidence[0].end_seconds=53;
 assert.throws(()=>routeFinding(queue,record.id,{...base,basis:'transcript',evidence_refs:['t1']},opts));
 record.evidence[1].seconds=16;
 assert.throws(()=>routeFinding(queue,record.id,{...base,basis:'sampled_frame',evidence_refs:['s1']},opts));
});

test('connection health rejects invalid, future, stale and malformed expiry evidence',()=>{
 const now=Date.parse('2026-10-11T12:00:00Z');
 for(const date of ['invalid','2026-10-12T00:00:00Z'])assert.equal(connectionStatus({last_read_verified_at:date},now).read_verified,false);
 assert.equal(connectionStatus(null,now).status,'unverified');
 assert.equal(connectionStatus({last_read_verified_at:'2026-10-09T12:00:00Z'},now).status,'stale');
 assert.equal(connectionStatus({last_read_verified_at:'2026-10-11T11:00:00Z',expires_at:'invalid'},now).status,'expiry_unknown');
 assert.equal(connectionStatus({last_read_verified_at:'2026-10-11T11:00:00Z'},now).status,'previously_verified');
 assert.equal(planTokenRenewal({renewal_supported:'false',expires_at:'2026-10-11'},now).action,'reauthorization_required');
});
