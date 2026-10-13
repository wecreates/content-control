import crypto from 'node:crypto';
// Existing Instagram API with Facebook Login route: professional account metadata only.
// This does not automate instagram.com passwords or bypass account challenges.
const SCOPES = ['instagram_basic', 'pages_read_engagement', 'pages_show_list'];
export function createInstagramOAuth({clientId, clientSecret, redirectUri, accountId, fetchImpl = fetch, now = Date.now, shutdownSignal}) {
  const redirect = new URL(redirectUri);
  if (!/^[0-9]+$/.test(clientId || '') || !clientSecret || !/^[0-9]{1,40}$/.test(accountId || '') || redirect.protocol !== 'https:' || redirect.username || redirect.password || redirect.search || redirect.hash) throw Error('OAUTH_CONFIGURATION_REQUIRED');
  async function request(endpoint, options, signal) {
    if (signal?.aborted || shutdownSignal?.aborted) throw Error('OAUTH_EXCHANGE_FAILED');
    try {
      const response = await fetchImpl(new URL('https://graph.facebook.com/v26.0/' + endpoint), {...options, redirect: 'error', signal: AbortSignal.any([signal, shutdownSignal, AbortSignal.timeout(20000)].filter(Boolean))});
      const reader = response.body.getReader(); const chunks = []; let bytes = 0;
      try {for (;;) {const {done, value} = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > 65536) throw Error(); chunks.push(value);}}
      finally {await reader.cancel().catch(() => {});}
      const data = JSON.parse(Buffer.concat(chunks).toString());
      if (!response.ok || data.error) throw Error();
      return data;
    } catch {throw Error('OAUTH_EXCHANGE_FAILED');}
  }
  async function token(params, signal) {
    const data = await request('oauth/access_token', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({client_id: clientId, client_secret: clientSecret, ...params}).toString()}, signal);
    if (typeof data.access_token !== 'string' || !data.access_token || !Number.isFinite(data.expires_in) || data.expires_in <= 0 || data.token_type?.toLowerCase() !== 'bearer') throw Error('OAUTH_EXCHANGE_FAILED');
    return data;
  }
  return {
    // Meta's confidential-client flow uses server-side client authentication and owner-bound state.
    // No unsupported PKCE guarantee is claimed for this provider.
    authorizationUrl: ({state}) => {
      const url = new URL('https://www.facebook.com/v26.0/dialog/oauth');
      url.search = new URLSearchParams({client_id: clientId, redirect_uri: redirect.href, response_type: 'code', scope: SCOPES.join(','), state});
      return url.href;
    },
    exchange: async({code}, {signal} = {}) => {
      const short = await token({code, redirect_uri: redirect.href}, signal);
      const long = await token({grant_type: 'fb_exchange_token', fb_exchange_token: short.access_token}, signal);
      const proof = crypto.createHmac('sha256', clientSecret).update(long.access_token).digest('hex');
      const permissions = await request('me/permissions?' + new URLSearchParams({appsecret_proof: proof}), {method: 'GET', headers: {Authorization: `Bearer ${long.access_token}`}}, signal);
      if (!Array.isArray(permissions.data) || !SCOPES.every(scope => permissions.data.some(p => p.permission === scope && p.status === 'granted'))) throw Error('PERMISSION_DENIED');
      return {account_id: accountId, access_token: long.access_token, expires_at: now() + long.expires_in * 1000, scopes: [...SCOPES]};
    },
  };
}
