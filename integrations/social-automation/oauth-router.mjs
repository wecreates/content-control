import express from 'express';
import {OWNER_COOKIE, LOGIN_COOKIE, readCookie} from './owner-auth.mjs';
const cookie = {httpOnly: true, secure: true, sameSite: 'lax', path: '/'};
export function createOAuthRouter(service) {
  const router = express.Router();
  router.use((_req, res, next) => {res.set({'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff'}); next();});
  const guarded = action => async(req, res) => {
    try {
      if (!service.ownerAuth) return res.status(503).json({error: 'OWNER_AUTH_NOT_CONFIGURED', publication_enabled: false});
      await action(req, res, service.ownerAuth);
    } catch {res.status(403).json({error: 'AUTHORIZATION_FAILED', publication_enabled: false});}
  };
  const sameOrigin = (req, auth) => req.get('origin') === auth.origin;
  router.post('/auth/start', guarded(async(req, res, auth) => {
    if (!sameOrigin(req, auth)) return res.status(403).json({error: 'ORIGIN_REQUIRED'});
    const result = await auth.begin();
    res.cookie(LOGIN_COOKIE, result.binding, {...cookie, maxAge: 600000});
    res.redirect(303, result.url);
  }));
  router.get('/auth/callback', guarded(async(req, res, auth) => {
    const binding = readCookie(req, LOGIN_COOKIE);
    res.clearCookie(LOGIN_COOKIE, cookie);
    const session = await auth.complete(req.query, binding);
    res.cookie(OWNER_COOKIE, session, {...cookie, maxAge: 28800000});
    res.redirect(303, '/social/connect');
  }));
  router.get('/auth/session', guarded(async(req, res, auth) => {
    res.json({authenticated: Boolean(await auth.authorize(req)), publication_enabled: false});
  }));
  router.post('/auth/logout', guarded(async(req, res, auth) => {
    if (!sameOrigin(req, auth)) return res.status(403).json({error: 'ORIGIN_REQUIRED'});
    await auth.logout(req); res.clearCookie(OWNER_COOKIE, cookie);
    res.redirect(303, '/social/connect');
  }));
  router.post('/oauth/:platform/start', guarded(async(req, res, auth) => {
    if (!sameOrigin(req, auth)) return res.status(403).json({error: 'ORIGIN_REQUIRED'});
    const result = await service.beginAuthorization(req.params.platform, req);
    res.redirect(303, result.authorization_url);
  }));
  router.get('/oauth/:platform/callback', guarded(async(req, res) => {
    await service.completeAuthorization(req.params.platform, req.query, req);
    res.redirect(303, '/social/connect');
  }));
  return router;
}
// All links and forms are fixed; no account data or OAuth errors are reflected into HTML.
export function connectionPage(service) {
  return async(req, res) => {
    res.set({'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; form-action 'self' https://github.com https://accounts.google.com https://www.facebook.com; frame-ancestors 'none'; base-uri 'none'"});
    let authenticated = false;
    try {authenticated = Boolean(service.ownerAuth && await service.ownerAuth.authorize(req));} catch {}
    const configured = Boolean(service.ownerAuth);
    const providers = service.status().oauth_providers || [];
    res.type('html').send('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CYZOR connections</title><h1>CYZOR connections</h1><p>Publishing is disabled. Connections allow authorized read operations only.</p>' +
      (!configured ? '<p>Owner sign-in is not configured. Private durable storage and a registered owner OAuth app are required.</p>' : !authenticated ? '<form method="post" action="/api/social/auth/start"><button>Sign in as owner with GitHub</button></form>' : '<p>Owner session verified.</p>' + (providers.includes('youtube') ? '<form method="post" action="/api/social/oauth/youtube/start"><button>Authorize YouTube read access</button></form>' : '<p>YouTube app configuration is incomplete.</p>') + (providers.includes('instagram') ? '<form method="post" action="/api/social/oauth/instagram/start"><button>Authorize Instagram read access through Facebook</button></form><p>Requires your professional Instagram account linked to Facebook. No publishing permissions are requested.</p>' : '<p>Instagram app configuration is incomplete.</p>') + '<p>Other platform authorization flows remain unavailable.</p><form method="post" action="/api/social/auth/logout"><button>Sign out</button></form>') + '<p><a href="/social/">Return to dashboard</a></p></html>');
  };
}
