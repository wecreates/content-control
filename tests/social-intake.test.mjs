import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {normalizeSocialUrl,addIntake,routeFinding,denyExternalAction,connectionStatus,planTokenRenewal,updateQueueFile,fullAnalysisCoverage} from '../social-intake.js';
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
 assert.equal(connectionStatus({last_read_verified_at:'2026-10-11T11:00:00Z'},now).status,'unverified');
 assert.equal(planTokenRenewal({renewal_supported:'false',expires_at:'2026-10-11'},now).action,'reauthorization_required');
});

test('full analysis requires known media duration and contiguous evidence-backed AV coverage',()=>{
 const {queue,record}=addIntake(null,reel);const opts={allowedProjects:['Content Control']};
 const f={project:'Content Control',category:'Content-production technique',summary:'Continuous observed analysis',basis:'audiovisual',evidence_refs:['av1'],full_analysis:true};
 record.evidence=[{id:'av1',kind:'audiovisual',verified:true,start_seconds:0,end_seconds:4},{id:'av2',kind:'audiovisual',verified:true,start_seconds:4,end_seconds:10}];
 record.coverage={full_video:true,full_audio:true,segments:[{start_seconds:0,end_seconds:4,video:true,audio:true,evidence_ref:'av1'},{start_seconds:4,end_seconds:10,video:true,audio:true,evidence_ref:'av2'}]};
 assert.throws(()=>routeFinding(queue,record.id,f,opts),/duration/);
 record.evidence.push({id:'duration',kind:'media_probe',verified:true,duration_seconds:10});record.coverage.duration_evidence_ref='duration';
 assert.equal(routeFinding(queue,record.id,f,opts).finding.full_analysis,true);
 assert.equal(fullAnalysisCoverage(record).verified,true);
 record.evidence.push({...record.evidence[0],verified:false});
 assert.equal(fullAnalysisCoverage(record).verified,false,'ambiguous evidence must not be reported as full review');
 record.evidence.pop();
 for(const change of [()=>record.coverage.segments[1].start_seconds=4.1,()=>record.coverage.segments[1].end_seconds=9,()=>record.coverage.segments[1].evidence_ref='missing']) {
  const saved=structuredClone(record.coverage);change();assert.throws(()=>routeFinding(queue,record.id,f,opts));record.coverage=saved;
 }
 assert.equal(queue.queue[0].findings.length,0);
});
test('finding retries return persisted records and conflicting IDs cannot fabricate a result',()=>{
 const {queue,record}=addIntake(null,reel);record.evidence=[{id:'m',verified:true,kind:'metadata'}];
 const f={id:'fixed',project:'Content Control',category:'Marketing strategy',summary:'Observed metadata',basis:'metadata',evidence_refs:['m']};const options={allowedProjects:['Content Control']};
 const first=routeFinding(queue,record.id,f,options);first.finding.status='reviewed_internally';
 const retry=routeFinding(first.queue,record.id,f,options);
 assert.equal(retry.created,false);assert.equal(retry.finding.status,'reviewed_internally');assert.equal(retry.finding,retry.record.findings[0]);assert.equal(retry.record.findings.length,1);
 assert.throws(()=>routeFinding(first.queue,record.id,{...f,summary:'Different unsupported claim'},options),/conflicts/);
 const automatic=routeFinding(queue,record.id,{...f,id:undefined},options);const automaticRetry=routeFinding(automatic.queue,record.id,{...f,id:undefined},options);assert.equal(automaticRetry.created,false);
});
test('verified retrieval never silently promotes a creator claim to a verified fact',()=>{
 const {queue,record}=addIntake(null,reel);record.evidence=[{id:'m',kind:'metadata',verified:true,url:reel,summary:'Creator says revenue doubled'}];
 const f={project:'Content Control',category:'Business opportunity',summary:'Creator says revenue doubled',basis:'metadata',evidence_refs:['m']};const options={allowedProjects:['Content Control']};
 assert.equal(routeFinding(queue,record.id,f,options).finding.claim_status,'observation');
 assert.equal(routeFinding(queue,record.id,{...f,claim_status:'creator_claim'},options).finding.claim_status,'creator_claim');
 const fact={...f,claim_status:'independently_verified',claim_id:'revenue-doubled',verification_refs:['m']};
 assert.throws(()=>routeFinding(queue,record.id,fact,options),/independently/);
 record.evidence.push({id:'fact',kind:'metadata',verified:true,url:'https://example.org/audit',verification_scope:'fact_check',supports_claim_ids:['revenue-doubled']});
 assert.equal(routeFinding(queue,record.id,{...fact,verification_refs:['fact']},options).finding.claim_status,'independently_verified');
 assert.throws(()=>routeFinding(queue,record.id,{...fact,claim_id:'different-claim',verification_refs:['fact']},options));
 record.evidence[1].url=reel+'?tracking=1';assert.throws(()=>routeFinding(queue,record.id,{...fact,verification_refs:['fact']},options));
});
test('legacy findings and queue data survive idempotent routing without schema rewrites',async()=>{
 const queue=JSON.parse(await fs.readFile(new URL('../capability-queue.json',import.meta.url)));const record=queue.queue.find(r=>r.findings?.length);const before=structuredClone(queue);const finding=record.findings[0];
 const result=routeFinding(queue,record.id,finding,{allowedProjects:[finding.project]});
 assert.deepEqual(result.queue,before);assert.equal(result.finding,result.record.findings[0]);assert.equal(result.created,false);
});

test('negative connection or read evidence overrides a fresh historical timestamp',()=>{
 const now=Date.parse('2026-10-12T12:00:00Z');const timestamp='2026-10-12T11:00:00Z';
 const valid={last_read_verified_at:timestamp,read_check:{provider:'official_api',result:'success',checked_at:timestamp}};
 for(const extra of [{connected:false},{status:'disconnected'},{status:'revoked'}])assert.equal(connectionStatus({...valid,...extra},now).status,'disconnected');
 for(const result of ['no_connected_account','no_connected_channel','failed','denied'])assert.equal(connectionStatus({...valid,read_check:{...valid.read_check,result}},now).status,'read_failed');
 assert.equal(connectionStatus({...valid,read_check:{...valid.read_check,result:'not_tested'}},now).status,'unverified');
 assert.equal(connectionStatus({...valid,error_code:'TOKEN_EXPIRED'},now).read_verified,false);
});
test('a verified read needs a coherent successful provider receipt and remains age aware',()=>{
 const now=Date.parse('2026-10-12T12:00:00Z');const stamp='2026-10-12T11:00:00Z';
 const valid={connected:true,provider:'official_api',last_read_verified_at:stamp,read_check:{provider:'official_api',result:'success',checked_at:stamp}};
 assert.equal(connectionStatus(valid,now).status,'previously_verified');assert.equal(connectionStatus(valid,now).read_verified,true);
 for(const change of [{provider:''},{provider:'other_provider'},{checked_at:'invalid'},{checked_at:'2026-10-12T10:00:00Z'},{result:'unknown'}])assert.equal(connectionStatus({...valid,read_check:{...valid.read_check,...change}},now).read_verified,false);
 assert.equal(connectionStatus({...valid,read_check:undefined},now).read_verified,false);
 assert.equal(connectionStatus(valid,now+2*86400000).status,'stale');
 assert.equal(connectionStatus({...valid,connected:false},now+2*86400000).status,'disconnected');
 assert.equal(connectionStatus({...valid,read_check:{...valid.read_check,checked_at:'2026-10-12T04:00:00-07:00'}},now).read_verified,true);
});
