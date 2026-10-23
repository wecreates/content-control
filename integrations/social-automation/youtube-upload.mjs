// Dormant, dependency-injected upload core. No global fetch, credentials, OAuth,
// production store, route or worker registration. All execution is OFF by default.
import {createHash} from 'node:crypto';
const UPLOAD_SCOPE = 'https://www.googleapis.com/auth/youtube.upload';
const ROOT = 'https://www.googleapis.com';
const INIT = ROOT + '/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status';
const digest = value => createHash('sha256').update(value).digest('hex');
const SAFE_ERROR = Symbol('upload-safe-error');
const fail = code => { const error = new Error(code); error[SAFE_ERROR] = true; throw error; };
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
function keys(value, allowed) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).some(k => !allowed.includes(k))) fail('INVALID_REQUEST');
}
export function uploadPlan(input) {
  keys(input, ['channelId','sha256','size','mime','metadata','notifySubscribers']);
  if (!/^UC[A-Za-z0-9_-]{22}$/.test(input.channelId) || !/^[a-f0-9]{64}$/.test(input.sha256) || !Number.isSafeInteger(input.size) || input.size < 1 || input.size > 256 * 1024 * 1024 || input.mime !== 'video/mp4' || typeof input.notifySubscribers !== 'boolean') fail('INVALID_REQUEST');
  const m = input.metadata;
  keys(m, ['snippet','status']);
  keys(m.snippet, ['title','description','tags','categoryId']);
  keys(m.status, ['privacyStatus','publishAt','selfDeclaredMadeForKids','containsSyntheticMedia']);
  if (typeof m.snippet.title !== 'string' || !m.snippet.title.trim() || m.snippet.title.length > 100 || typeof m.snippet.description !== 'string' || Buffer.byteLength(m.snippet.description) > 5000 || !/^\d+$/.test(m.snippet.categoryId) || /[<>]/.test(m.snippet.title + m.snippet.description)) fail('INVALID_METADATA');
  if (m.snippet.tags !== undefined && (!Array.isArray(m.snippet.tags) || m.snippet.tags.some(t => typeof t !== 'string' || !t || /[<>]/.test(t)) || m.snippet.tags.join(',').length > 500)) fail('INVALID_METADATA');
  if (!['private','unlisted','public'].includes(m.status.privacyStatus) || typeof m.status.selfDeclaredMadeForKids !== 'boolean' || typeof m.status.containsSyntheticMedia !== 'boolean') fail('INVALID_METADATA');
  if (m.status.publishAt !== undefined && (typeof m.status.publishAt !== 'string' || !Number.isFinite(Date.parse(m.status.publishAt)) || m.status.privacyStatus !== 'private')) fail('INVALID_SCHEDULE');
  const request = JSON.parse(canonical(input));
  const binding = digest(canonical(request));
  // One media/channel identity: changed metadata cannot accidentally reupload it.
  return {request, binding, key: digest(input.channelId + ':' + input.sha256)};
}
function sessionURL(value) {
  let u; try { u = new URL(value); } catch { fail('INVALID_SESSION'); }
  if (u.origin !== ROOT || u.username || u.password || u.hash || u.pathname !== '/upload/youtube/v3/videos' || u.searchParams.get('uploadType') !== 'resumable' || !u.searchParams.get('upload_id')) fail('INVALID_SESSION');
  return u.href;
}
function publicReceipt(r) {
  return {state:r.state, videoId:r.videoId || null, acknowledgedBytes:r.offset || 0, nextAttemptAt:r.nextAttemptAt || null};
}
export function createYouTubeUploadAdapter({executionEnabled=false, transport, authorize, credentials, readMedia, store, now=Date.now}={}) {
  async function context(input, approvalRef, requireMedia=true) {
    if (executionEnabled !== true) fail('PUBLICATION_DISABLED');
    if (![transport,authorize,credentials,readMedia].every(x => typeof x === 'function') || !store?.withExclusive || !store?.get || !store?.put) fail('DEPENDENCIES_REQUIRED');
    const plan = uploadPlan(input);
    let approval, grant, bytes;
    try { approval = await authorize({approvalRef,binding:plan.binding,channelId:plan.request.channelId}); } catch { fail('AUTHORIZATION_REQUIRED'); }
    if (!approval || approval.binding !== plan.binding || approval.channelId !== plan.request.channelId || approval.approved !== true || !Number.isFinite(approval.expiresAt) || approval.expiresAt <= now()) fail('AUTHORIZATION_REQUIRED');
    try { grant = await credentials(); } catch { fail('AUTHORIZATION_REQUIRED'); }
    if (grant?.accountId !== plan.request.channelId || (!Array.isArray(grant.scopes) || !grant.scopes.includes(UPLOAD_SCOPE) || !grant.scopes.includes('https://www.googleapis.com/auth/youtube.readonly')) || typeof grant.accessToken !== 'string' || !grant.accessToken || !Number.isFinite(grant.expiresAt) || grant.expiresAt <= now()) fail('CHANNEL_OR_SCOPE_MISMATCH');
    if (requireMedia) {
      try { const source = await readMedia(plan.request.sha256); if (!Buffer.isBuffer(source)) fail('MEDIA_MISMATCH'); bytes = Buffer.from(source); } catch { fail('MEDIA_MISMATCH'); }
      if (bytes.length !== plan.request.size || digest(bytes) !== plan.request.sha256) fail('MEDIA_MISMATCH');
    }
    // Recheck after asynchronous reads; authorization may expire while reading.
    if (approval.expiresAt <= now() || grant.expiresAt <= now()) fail('AUTHORIZATION_REQUIRED');
    return {...plan, approvalRef, approval:structuredClone(approval), grant:structuredClone(grant), bytes};
  }
  async function send(c, url, options) {
    if (c.approval.expiresAt <= now() || c.grant.expiresAt <= now()) fail('AUTHORIZATION_REQUIRED');
    let fresh;
    try { fresh=await authorize({approvalRef:c.approvalRef,binding:c.binding,channelId:c.request.channelId}); } catch { fail('AUTHORIZATION_REQUIRED'); }
    if (!fresh || fresh.approved !== true || fresh.binding !== c.binding || fresh.channelId !== c.request.channelId || !Number.isFinite(fresh.expiresAt) || fresh.expiresAt <= now()) fail('AUTHORIZATION_REQUIRED');
    if (c.grant.expiresAt <= now()) fail('AUTHORIZATION_REQUIRED');
    let r;
    try { r = await transport(url, {...options, redirect:'error', signal:AbortSignal.timeout(20000), headers:{...options.headers,Authorization:'Bearer ' + c.grant.accessToken}}); } catch { fail('TRANSPORT_UNCERTAIN'); }
    if (!r || r.redirected || r.status >= 300 && r.status < 400 && r.status !== 308) fail('INVALID_REDIRECT');
    return r;
  }
  async function json(r) {
    let reader;
    try {
      reader=r.body.getReader(); const chunks=[]; let size=0;
      for (;;) { const {done,value}=await reader.read(); if (done) break; size+=value.byteLength; if(size>65536) fail('INVALID_PROVIDER_RESPONSE'); chunks.push(value); }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch { fail('INVALID_PROVIDER_RESPONSE'); }
    finally { if(reader) await reader.cancel().catch(()=>{}); }
  }
  async function exclusive(key,fn) {
    try { return await store.withExclusive(key,fn); }
    catch(error) { if(error?.[SAFE_ERROR]) throw error; fail('RECEIPT_STORE_UNAVAILABLE'); }
  }
  async function persist(c,r) { try { await store.put(c.key,r); } catch { fail('RECEIPT_STORE_UNAVAILABLE'); } }
  async function get(c) {
    let r; try { r = await store.get(c.key); } catch { fail('RECEIPT_STORE_UNAVAILABLE'); }
    if (r && r.binding !== c.binding) fail('IDEMPOTENCY_CONFLICT');
    return r;
  }
  async function identity(c) {
    const r = await send(c,ROOT + '/youtube/v3/channels?part=id&mine=true&maxResults=50',{method:'GET'});
    if (r.status !== 200) fail('CHANNEL_VERIFICATION_FAILED');
    const d = await json(r);
    if (!Array.isArray(d.items) || !d.items.some(x => x.id === c.request.channelId)) fail('CHANNEL_VERIFICATION_FAILED');
  }
  async function outcome(c,r,response) {
    if (response.status === 200 || response.status === 201) {
      const d = await json(response);
      if (typeof d.id !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(d.id) || d.snippet?.channelId !== c.request.channelId) fail('INVALID_PROVIDER_RESPONSE');
      r.videoId = d.id; r.state='uploaded'; r.offset=c.request.size;
    } else if (response.status === 308) {
      const range = response.headers.get('Range');
      const match = range?.match(/^bytes=0-(\d+)$/);
      const offset = range === null ? 0 : match ? Number(match[1]) + 1 : NaN;
      if (!Number.isSafeInteger(offset) || offset < r.offset || offset > c.request.size) fail('INVALID_PROVIDER_RANGE');
      r.offset=offset; r.state='resumable';
    } else if ([500,502,503,504].includes(response.status)) {
      r.attempts=(r.attempts || 0)+1;
      r.state = r.attempts >= 3 ? 'reconciliation_required' : 'retry_wait';
      r.nextAttemptAt=now()+Math.min(60000,1000 * 2 ** r.attempts);
    } else { r.state = [401,403].includes(response.status) ? 'reauthorization_required' : 'reconciliation_required'; }
    await persist(c,r); return r;
  }
  async function transfer(c,r) {
    r.state='transfer_uncertain'; await persist(c,r);
    try {
      const response=await send(c,sessionURL(r.session),{method:'PUT',headers:{'Content-Type':c.request.mime,'Content-Length':String(c.bytes.length-r.offset),'Content-Range':`bytes ${r.offset}-${c.bytes.length-1}/${c.bytes.length}`},body:c.bytes.subarray(r.offset)});
      return await outcome(c,r,response);
    } catch { r.state='transfer_uncertain'; await persist(c,r); fail('UPLOAD_UNCERTAIN'); }
  }
  return {
    preflight: uploadPlan,
    async start(input, approvalRef) {
      const snapshot = uploadPlan(input);
      // Serialize by channel/media before reading approval or touching network.
      if (executionEnabled !== true) fail('PUBLICATION_DISABLED');
      if (!store?.withExclusive) fail('DEPENDENCIES_REQUIRED');
      return exclusive(snapshot.key,async()=>{
        const c=await context(snapshot.request,approvalRef);
        let r=await get(c);
        if (r) return publicReceipt(r); // Resume is explicit, never restart blindly.
        if (c.request.metadata.status.publishAt && Date.parse(c.request.metadata.status.publishAt) <= now()) fail('INVALID_SCHEDULE');
        await identity(c);
        r={binding:c.binding,state:'initialization_uncertain',offset:0}; await persist(c,r);
        try {
          const response=await send(c,INIT + '&notifySubscribers=' + c.request.notifySubscribers,{method:'POST',headers:{'Content-Type':'application/json','X-Upload-Content-Type':c.request.mime,'X-Upload-Content-Length':String(c.request.size)},body:JSON.stringify(c.request.metadata)});
          if (response.status !== 200) fail('INITIALIZATION_UNCERTAIN');
          r.session=sessionURL(response.headers.get('Location')); r.state='resumable'; await persist(c,r);
        } catch { fail('INITIALIZATION_UNCERTAIN'); }
        return publicReceipt(await transfer(c,r));
      });
    },
    async resume(input,approvalRef) {
      const snapshot=uploadPlan(input);
      if (executionEnabled !== true) fail('PUBLICATION_DISABLED');
      if (!store?.withExclusive) fail('DEPENDENCIES_REQUIRED');
      return exclusive(snapshot.key,async()=>{
        const c=await context(snapshot.request,approvalRef); let r=await get(c);
        if (!r?.session || !['transfer_uncertain','resumable','retry_wait'].includes(r.state)) fail('RECONCILIATION_REQUIRED');
        if (r.nextAttemptAt > now()) fail('RETRY_NOT_DUE');
        await identity(c);
        // A final PUT may already have succeeded; query first, never reinitialize.
        r.state='transfer_uncertain'; await persist(c,r);
        try { r=await outcome(c,r,await send(c,sessionURL(r.session),{method:'PUT',headers:{'Content-Length':'0','Content-Range':`bytes */${c.request.size}`}})); }
        catch { fail('UPLOAD_UNCERTAIN'); }
        if (r.state === 'resumable' && r.offset < c.request.size) r=await transfer(c,r);
        return publicReceipt(r);
      });
    },
    async verify(input,approvalRef) {
      const snapshot=uploadPlan(input);
      if (executionEnabled !== true) fail('PUBLICATION_DISABLED');
      if (!store?.withExclusive) fail('DEPENDENCIES_REQUIRED');
      return exclusive(snapshot.key,async()=>{
        const c=await context(snapshot.request,approvalRef,false); const r=await get(c);
        if (!r?.videoId) fail('UPLOAD_NOT_VERIFIED');
        const response=await send(c,ROOT + '/youtube/v3/videos?part=snippet,status,processingDetails&id=' + r.videoId,{method:'GET'});
        if (response.status !== 200) fail('VERIFICATION_UNAVAILABLE');
        const d=await json(response); const v=d.items?.find(x=>x.id === r.videoId);
        if (!v || v.snippet?.channelId !== c.request.channelId) fail('VERIFICATION_UNAVAILABLE');
        const processing=v.processingDetails?.processingStatus;
        const expected=c.request.metadata;
        const expectedPrivacy=expected.status.publishAt && Date.parse(expected.status.publishAt)<=now() ? 'public' : expected.status.privacyStatus;
        const scheduleMatches=expectedPrivacy !== 'private' || (expected.status.publishAt === undefined ? v.status?.publishAt === undefined : Date.parse(v.status?.publishAt) === Date.parse(expected.status.publishAt));
        const metadataMatches=scheduleMatches && Object.entries(expected.snippet).every(([k,value])=>canonical(v.snippet[k])===canonical(value)) &&
          ['selfDeclaredMadeForKids','containsSyntheticMedia'].every(k=>v.status?.[k]===expected.status[k]) && v.status?.privacyStatus===expectedPrivacy;
        if (['failed','terminated'].includes(processing) || ['failed','rejected','deleted'].includes(v.status?.uploadStatus)) r.state='processing_failed';
        else if (!metadataMatches) r.state='metadata_mismatch';
        else if (processing !== 'succeeded') r.state='processing';
        else if (v.status?.privacyStatus === 'public') r.state='published';
        else if (v.status?.privacyStatus === 'private' && Date.parse(v.status.publishAt) === Date.parse(c.request.metadata.status.publishAt) && v.status.publishAt && Date.parse(v.status.publishAt) > now()) r.state='scheduled';
        else r.state='uploaded';
        await persist(c,r); return publicReceipt(r);
      });
    }
  };
}
