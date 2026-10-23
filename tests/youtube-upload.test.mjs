import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createYouTubeUploadAdapter, uploadPlan} from '../integrations/social-automation/youtube-upload.mjs';
import {InMemoryUploadReceiptStore} from '../integrations/social-automation/youtube-upload-receipts.mjs';
const bytes=Buffer.from('fake mp4 test bytes');
const channelId='UC'+'a'.repeat(22), videoId='b'.repeat(11);
const request=()=>({channelId,sha256:createHash('sha256').update(bytes).digest('hex'),size:bytes.length,mime:'video/mp4',notifySubscribers:false,metadata:{snippet:{title:'Reviewed title',description:'Reviewed description',categoryId:'22'},status:{privacyStatus:'private',selfDeclaredMadeForKids:false,containsSyntheticMedia:true}}});
const session='https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&upload_id=fake';
const response=(status,data={},headers={})=>new Response(status === 308 ? null : JSON.stringify(data),{status,headers});
function harness(options={}) {
  const calls=[]; let clock=1000;
  const store=options.store || new InMemoryUploadReceiptStore();
  const queue=options.queue || [response(200,{}, {Location:session}),response(201,{id:videoId,snippet:{channelId}})];
  const adapter=createYouTubeUploadAdapter({executionEnabled:true,now:()=>clock,store,
    authorize:async ({binding,channelId})=>({approved:true,binding,channelId,expiresAt:100000}),
    credentials:async()=>({accountId:channelId,scopes:['https://www.googleapis.com/auth/youtube.upload','https://www.googleapis.com/auth/youtube.readonly'],accessToken:'never-log-this-token',expiresAt:100000}),
    readMedia:async()=>bytes,
    transport:async(url,init)=>{calls.push({url,init}); assert.equal(init.redirect,'error'); if(url.includes('/channels?'))return response(200,{items:[{id:channelId}]}); const next=queue.shift(); if (next instanceof Error) throw next; if (!next) throw Error('Unexpected request'); return next;},...options});
  return {adapter,calls,store,queue,advance:n=>{clock+=n;}};
}
test('default disabled: start/resume/verify make zero requests',async()=>{
  let calls=0;const a=createYouTubeUploadAdapter({transport:()=>{calls++;}});
  for(const name of ['start','resume','verify'])await assert.rejects(a[name](request(),'approval'),/PUBLICATION_DISABLED/);
  assert.equal(calls,0);
});
test('upload completes once; receipt never leaks token/session',async()=>{
  const h=harness();const result=await h.adapter.start(request(),'approval');
  assert.equal(result.state,'uploaded'); assert.equal(result.videoId,videoId);
  assert.doesNotMatch(JSON.stringify(result),/never-log|upload_id/);
  assert.deepEqual(await h.adapter.start(request(),'approval'),result);
  assert.equal(h.calls.filter(x=>x.init.method==='POST').length,1);
});
test('two adapters sharing store serialize concurrent identical starts',async()=>{
  const store=new InMemoryUploadReceiptStore();const a=harness({store}),b=harness({store});
  const results=await Promise.all([a.adapter.start(request(),'a'),b.adapter.start(request(),'a')]);
  assert.deepEqual(results[0],results[1]);assert.equal(a.calls.length+b.calls.length,3);
});
test('metadata changes conflict rather than duplicate',async()=>{
  const h=harness();await h.adapter.start(request(),'a');const changed=request();changed.metadata.snippet.title='different';
  await assert.rejects(h.adapter.start(changed,'a'),/IDEMPOTENCY_CONFLICT/);assert.equal(h.calls.length,3);
});
for(const [name,patch,error] of [
 ['readonly grant',{credentials:async()=>({accountId:channelId,scopes:['https://www.googleapis.com/auth/youtube.readonly'],accessToken:'secret',expiresAt:100000})},/CHANNEL_OR_SCOPE/],
 ['wrong channel',{credentials:async()=>({accountId:'wrong',scopes:['https://www.googleapis.com/auth/youtube.upload'],accessToken:'secret',expiresAt:100000})},/CHANNEL_OR_SCOPE/],
 ['expired approval',{authorize:async({binding,channelId})=>({approved:true,binding,channelId,expiresAt:1})},/AUTHORIZATION_REQUIRED/],
 ['different approval binding',{authorize:async({channelId})=>({approved:true,binding:'other',channelId,expiresAt:100000})},/AUTHORIZATION_REQUIRED/],
 ['media changed',{readMedia:async()=>Buffer.from('changed')},/MEDIA_MISMATCH/],
 ['credential exception sanitized',{credentials:async()=>{throw Error('secret credential');}},/AUTHORIZATION_REQUIRED/]
])test(name+' blocks before network',async()=>{const h=harness(patch);await assert.rejects(h.adapter.start(request(),'a'),error);assert.equal(h.calls.length,0);});
test('uncertain POST persists and cannot initialize again',async()=>{
 const h=harness({queue:[Error('never-log-this-token')]});await assert.rejects(h.adapter.start(request(),'a'),/^Error: INITIALIZATION_UNCERTAIN$/);
 assert.equal((await h.adapter.start(request(),'a')).state,'initialization_uncertain');await assert.rejects(h.adapter.resume(request(),'a'),/RECONCILIATION_REQUIRED/);assert.equal(h.calls.length,2);
});
test('uncertain final PUT queries same session and never duplicates',async()=>{
 const h=harness({queue:[response(200,{}, {Location:session}),Error('secret'),response(200,{id:videoId,snippet:{channelId}})]});
 await assert.rejects(h.adapter.start(request(),'a'),/^Error: UPLOAD_UNCERTAIN$/);
 assert.equal((await h.adapter.resume(request(),'a')).state,'uploaded');
 assert.equal(h.calls.filter(x=>x.init.method==='POST').length,1);
 assert.equal(h.calls.at(-1).init.headers['Content-Range'],'bytes */'+bytes.length);
});
test('308 resumes only acknowledged offset',async()=>{
 const h=harness({queue:[response(200,{}, {Location:session}),response(308,{}, {Range:'bytes=0-3'}),response(308,{}, {Range:'bytes=0-3'}),response(201,{id:videoId,snippet:{channelId}})]});
 assert.equal((await h.adapter.start(request(),'a')).acknowledgedBytes,4);await h.adapter.resume(request(),'a');assert.deepEqual(h.calls.at(-1).init.body,bytes.subarray(4));
});
for(const status of [401,403,404])test(status+' stops resume without reinitializing',async()=>{
 const h=harness({queue:[response(200,{}, {Location:session}),response(status)]});const r=await h.adapter.start(request(),'a');assert.match(r.state,/required/);await assert.rejects(h.adapter.resume(request(),'a'),/RECONCILIATION_REQUIRED/);assert.equal(h.calls.length,3);
});
test('5xx backoff bounded to three server failures',async()=>{
 const h=harness({queue:[response(200,{}, {Location:session}),response(503),response(503),response(503)]});assert.equal((await h.adapter.start(request(),'a')).state,'retry_wait');
 await assert.rejects(h.adapter.resume(request(),'a'),/RETRY_NOT_DUE/);h.advance(5000);await h.adapter.resume(request(),'a');h.advance(5000);assert.equal((await h.adapter.resume(request(),'a')).state,'reconciliation_required');await assert.rejects(h.adapter.resume(request(),'a'),/RECONCILIATION_REQUIRED/);
});
for(const location of ['https://evil.test/upload','https://www.googleapis.com.evil.test/upload','http://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&upload_id=x','https://u:p@www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&upload_id=x','https://www.googleapis.com/other?uploadType=resumable&upload_id=x'])test('reject session '+location,async()=>{
 const h=harness({queue:[response(200,{}, {Location:location})]});await assert.rejects(h.adapter.start(request(),'a'),/INITIALIZATION_UNCERTAIN/);assert.equal(h.calls.length,2);
});
test('reject redirect without following',async()=>{const h=harness({queue:[response(302,{}, {Location:session})]});await assert.rejects(h.adapter.start(request(),'a'),/INITIALIZATION_UNCERTAIN/);assert.equal(h.calls.length,2);});
test('provider wrong channel response is uncertain, never uploaded',async()=>{const h=harness({queue:[response(200,{}, {Location:session}),response(201,{id:videoId,snippet:{channelId:'wrong'}})]});await assert.rejects(h.adapter.start(request(),'a'),/UPLOAD_UNCERTAIN/);});
for(const [processing,privacy,expected] of [['failed','public','processing_failed'],['processing','private','processing'],['succeeded','public','metadata_mismatch'],['succeeded','private','uploaded']])test('verify '+processing+'/'+privacy,async()=>{
 const h=harness();await h.adapter.start(request(),'a');h.queue.push(response(200,{items:[{id:videoId,snippet:{...request().metadata.snippet,channelId},status:{...request().metadata.status,privacyStatus:privacy},processingDetails:{processingStatus:processing}}]}));assert.equal((await h.adapter.verify(request(),'a')).state,expected);
});
test('explicit visibility and disclosure required; caller input remains immutable',()=>{const req=request();const p=uploadPlan(req);req.metadata.snippet.title='changed';assert.equal(p.request.metadata.snippet.title,'Reviewed title');delete req.metadata.status.privacyStatus;assert.throws(()=>uploadPlan(req),/INVALID_METADATA/);});
test('store failure prevents initialization and sanitizes detail',async()=>{const store=new InMemoryUploadReceiptStore();store.put=async()=>{throw Error('private database URL');};const h=harness({store});await assert.rejects(h.adapter.start(request(),'a'),/^Error: RECEIPT_STORE_UNAVAILABLE$/);assert.equal(h.calls.filter(x=>x.init.method==='POST').length,0);});

test('revocation after identity prevents initialization',async()=>{
 let approvals=0;const h=harness({authorize:async({binding,channelId})=>({approved:++approvals<3,binding,channelId,expiresAt:100000})});
 await assert.rejects(h.adapter.start(request(),'a'),/INITIALIZATION_UNCERTAIN/);assert.equal(h.calls.length,1);
});
test('valid approved public upload verifies published',async()=>{
 const req=request();req.metadata.status.privacyStatus='public';const h=harness();await h.adapter.start(req,'a');
 h.queue.push(response(200,{items:[{id:videoId,snippet:{...req.metadata.snippet,channelId},status:req.metadata.status,processingDetails:{processingStatus:'succeeded'}}]}));assert.equal((await h.adapter.verify(req,'a')).state,'published');
});
test('future approved schedule verifies scheduled, not published',async()=>{
 const req=request();req.metadata.status.publishAt=new Date(90000).toISOString();const h=harness();await h.adapter.start(req,'a');
 h.queue.push(response(200,{items:[{id:videoId,snippet:{...req.metadata.snippet,channelId},status:req.metadata.status,processingDetails:{processingStatus:'succeeded'}}]}));assert.equal((await h.adapter.verify(req,'a')).state,'scheduled');
});
test('store lock failure is sanitized',async()=>{
 const h=harness({store:{withExclusive:async()=>{throw Error('private database URL');}}});await assert.rejects(h.adapter.start(request(),'a'),/^Error: RECEIPT_STORE_UNAVAILABLE$/);
});
test('malformed ranges never cause blind retransmission',async()=>{
 const h=harness({queue:[response(200,{}, {Location:session}),response(308,{}, {Range:'bytes=2-3'})]});await assert.rejects(h.adapter.start(request(),'a'),/UPLOAD_UNCERTAIN/);assert.equal(h.calls.length,3);
});

test('string false does not enable execution',async()=>{const h=harness({executionEnabled:'false'});await assert.rejects(h.adapter.start(request(),'a'),/PUBLICATION_DISABLED/);assert.equal(h.calls.length,0);});
test('credential expires during renewed authorization: no POST',async()=>{
 let n=0;const h=harness({authorize:async({binding,channelId})=>{if(++n===3)h.advance(100000);return {approved:true,binding,channelId,expiresAt:999999};}});
 await assert.rejects(h.adapter.start(request(),'a'),/INITIALIZATION_UNCERTAIN/);assert.equal(h.calls.length,1);
});
for(const planned of [undefined,new Date(90000).toISOString()])test('unexpected schedule reports mismatch '+planned,async()=>{
 const req=request();if(planned)req.metadata.status.publishAt=planned;const h=harness();await h.adapter.start(req,'a');
 h.queue.push(response(200,{items:[{id:videoId,snippet:{...req.metadata.snippet,channelId},status:{...req.metadata.status,publishAt:new Date(80000).toISOString()},processingDetails:{processingStatus:'succeeded'}}]}));assert.equal((await h.adapter.verify(req,'a')).state,'metadata_mismatch');
});
