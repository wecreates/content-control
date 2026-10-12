// Read-only Instagram API with Facebook Login. No arbitrary URLs or writes.
// Endpoint contract: Meta's Instagram collection, linked in README.md.
import crypto from 'node:crypto';
const ID = /^[0-9]{1,40}$/;
export function createInstagramAdapter({fetchImpl = fetch, appSecret, shutdownSignal, timeoutMs = 20000} = {}) {
  if(typeof fetchImpl !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 20000) throw Error('INVALID_ADAPTER_CONFIGURATION');
  async function get(grant, suffix, fields, extra = {}, callerSignal) {
    const signal = AbortSignal.any([AbortSignal.timeout(timeoutMs), ...[shutdownSignal, callerSignal, grant?._signal].filter(Boolean)]);
    if(signal.aborted) throw Error('PROVIDER_FAILED');
    if (!ID.test(grant?.account_id || '') || typeof grant.access_token !== 'string' || !grant.access_token) throw Error('REAUTHORIZE');
    const url = new URL(`https://graph.facebook.com/v26.0/${grant.account_id}${suffix}`);
    url.search = new URLSearchParams({fields, ...extra}).toString();
    if (appSecret) url.searchParams.set('appsecret_proof', crypto.createHmac('sha256', appSecret).update(grant.access_token).digest('hex'));
    let response, data;
    try {
      response = await fetchImpl(url, {method: 'GET', headers: {Authorization: `Bearer ${grant.access_token}`}, redirect: 'error', signal});
      if(response.status === 401 || response.status === 403) {
        await response.body?.cancel().catch(() => {});
        throw Error(response.status === 401 ? 'REAUTHORIZE' : 'PERMISSION_DENIED');
      }
      // Bound the body as well as the network time. Never retain raw errors.
      const reader = response.body.getReader();
      const chunks = []; let bytes = 0;
      try {while (true) {const {value, done} = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > 262144) throw Error(); chunks.push(value);}}
      finally {await reader.cancel().catch(() => {});}
      data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch(error) {throw Error(['REAUTHORIZE','PERMISSION_DENIED'].includes(error.message) ? error.message : 'PROVIDER_FAILED');}
    if (!response.ok || data?.error) {
      const code = data?.error?.code;
      throw Error(code === 190 ? 'REAUTHORIZE' : [10, 200].includes(code) ? 'PERMISSION_DENIED' : 'PROVIDER_FAILED');
    }
    return data;
  }
  async function read_profile(grant, payload = {}, {signal} = {}) {
    const data = await get(grant, '', 'id,username', {}, signal);
    if (data?.id !== grant.account_id || typeof data.username !== 'string') throw Error('ACCOUNT_VERIFICATION_FAILED');
    return {account_id: data.id, username: data.username, full_analysis: false};
  }
  async function read_media(grant, payload = {}, {signal} = {}) {
    // Recheck identity on each job; a stored connected flag is not live proof.
    await read_profile(grant, {}, {signal});
    const data = await get(grant, '/media', 'id,media_type,media_product_type', {limit: '5'}, signal);
    if (!Array.isArray(data?.data) || data.data.length > 5 || data.data.some(row => !ID.test(row?.id || '') || typeof row.media_type !== 'string')) throw Error('PROVIDER_FAILED');
    return {items: data.data.map(row => ({id: row.id, media_type: row.media_type, ...(typeof row.media_product_type === 'string' ? {media_product_type: row.media_product_type} : {})})), pagination_followed: false, full_analysis: false, scope: 'authorized_account_media_metadata_only'};
  }
  return {verify: async (grant, options = {}) => ({account_id: (await read_profile(grant, {}, options)).account_id, verified: true}), read_profile, read_media};
}
