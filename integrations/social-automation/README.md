# Private social automation

Status: read worker and Instagram metadata adapter implemented and tested with
mock provider responses; live account authorization is not verified. Hosted
startup is off by default. Publishing, messages, ads, purchases and follows are
always disabled. `/api/social/runtime` reports the actual worker state without
returning credentials, account IDs, results, or job payloads.

## Implemented

- AES-256-GCM encryption for grants, job payloads and results, atomic file
  replacement, file sync and exclusive writer lock across store instances.
- Account identity verification before connection, plus identity recheck on
  each Instagram media read. Jobs bind to the account present at enqueue time.
- Read-only job allowlist, duplicate-key conflict detection, three-attempt
  retry budget, expiry checks, renewal hook and reauthorization state.
- Recurring worker: one media job per account per six-hour slot; retry processing
  every minute. Concurrent cycles are coalesced; saved jobs survive restart.
- Instagram API with Facebook Login adapter, pinned Graph v26.0, GET only,
  fixed host, no redirects, 20-second timeout, bounded response body, one page
  of up to five media metadata items. Paging URLs and unknown fields are dropped.
- Existing server initializes the service and stops it during shutdown.
- `npm run social:read-once` executes one owner-controlled cycle against an
  existing encrypted vault. It never imports grants or prints private results.

## Activation dependencies

No new infrastructure or paid service was provisioned. Current Render storage
has not been independently verified as private and durable. Activation needs:

1. Provider developer application, owner login, registered HTTPS callback,
   approved scopes and a secure OAuth onboarding implementation. No public
   credential-ingestion endpoint exists. Do not put credentials in chat.
2. A verified grant in the private encrypted store. `SocialAutomation.connect`
   verifies identity but is an internal interface, not an OAuth login flow.
   The current Instagram adapter requires the authorized professional account
   and Facebook Login route; it cannot access arbitrary private reels.
3. Private durable storage outside the application/repository tree, with a
   vault file accessible only to its owner. Configure SOCIAL_VAULT_FILE and the
   separate 32-byte hexadecimal SOCIAL_VAULT_KEY via hosted secret management.
   The public repository and monitor backup must never store the vault.
4. Only after storage and grants are ready, explicitly set
   SOCIAL_STORAGE_MODE=private_durable and SOCIAL_WORKER_ENABLED=true.
   This is operator configuration, not proof of durability: the public status
   continues to report durable_storage_verified=false. Missing, broad-permission,
   in-repository or locked vaults block startup without a fallback.
5. Add provider-specific OAuth renewal. The Instagram Facebook Login adapter
   currently has no refresh method; expired grants require
   reauthorization. No automatic renewal is claimed for Instagram.
6. Connect private result consumption to evidence-validated production routing.
   Metadata reads alone do not constitute video retrieval, full audio/video
   analysis, competitive review or business-performance evidence.

Owner-facing OAuth onboarding and provider-specific exchanges other than YouTube remain unimplemented. See the platform matrix below for the implemented read operations.
No live account or hosted durability/recovery test has passed yet.

## Recovery and execution limits

A failed process may leave `vault.lock`. The service deliberately refuses to
remove it automatically. An operator must stop all workers, confirm none still
owns the vault, inspect the failure, then remove the stale lock. Do not run
multiple hosted workers. Graceful shutdown aborts pending provider requests before stopping the worker.
A forced process termination can still leave a stale lock; it fails closed.

A crash after a provider read but before local commit can repeat that read.
Idempotency is not an exactly-once external execution guarantee. Legacy jobs
without account binding are blocked instead of being reassigned. The queue
holds at most 1000 jobs; archival and owner-controlled blocked-job recovery are
not yet implemented. Provider calls execute inside the transaction, so all
adapters must have bounded network timeouts. This adapter does.

Tests: `npm run test:social`. The existing social integration CI runs the worker,
HTTP boundary, Opus and Watch bridge tests. Mock tests do not prove live access.

Primary API reference: Meta's official Instagram API collection:
https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api
Existing independent SDK probe: `scripts/instagram_official_read.py`.

Valid short-lived grants remain usable until actual expiry when a provider has no refresh adapter. Supported refresh results need a future expiry and the same account. Provider verification, renewal and reads have a 20-second runtime bound, abort signal and sanitized failure reporting, so stalled reads release the queue transaction. This does not activate OAuth or verify durable hosting.


## Unified provider integration — October 12, 2026

All nine requested platforms are represented in `providers.mjs` and the hosted
readiness response. This is not nine verified account connections.

| Platform | Implemented read operations | Limitation |
| --- | --- | --- |
| Instagram | Professional identity and five media metadata records | Facebook Login route; no full reel analysis |
| Facebook | Page identity, including Page category validation | No Page posts, inbox or analytics adapter |
| YouTube | Owned channel identity and five upload IDs | No video/audio download or analytics |
| TikTok | Identity and five public video metadata records | POST is used only for the documented read-only video list |
| Threads | Identity and five thread metadata records | No replies, inbox or analytics |
| Pinterest | Account identity and five Pin metadata records | Username is identity key; renaming requires reauthorization |
| LinkedIn | OpenID profile identity | No posts, inbox, outreach or analytics |
| X | Explicit blocked adapter | No paid API calls under free-only policy |
| Reddit | Explicit blocked adapter | Commercial approval and free eligibility not established |

Read adapters check required scopes before network requests, pin service hosts,
refuse redirects, limit time and response size, recheck account identity, drop
pagination links and unknown fields, and return full_analysis=false. Results
remain in the encrypted vault. Required scopes are conservative per-provider
bundles; profile-only use may require fewer scopes after a later implementation.

The worker now selects media reads when implemented and otherwise profile reads.
X and Reddit cannot start a request even with a preexisting credential record.
Publishing and other external writes remain unavailable in every adapter.

### OAuth implementation boundary

`SocialOAuthCoordinator` provides encrypted single-use, owner-bound, ten-minute
state and S256 PKCE challenges. The host must supply an independently verified
owner authentication callback. A caller-supplied owner ID alone grants nothing.
No public OAuth start/callback route or owner login has been activated.

`createYouTubeOAuth` implements the Google web-server authorization URL, code
exchange, identity-bound grant installation and refresh-token preservation.
Google app credentials, registered HTTPS redirect URI and expected channel ID
must be configured privately as YOUTUBE_OAUTH_CLIENT_ID,
YOUTUBE_OAUTH_CLIENT_SECRET, YOUTUBE_OAUTH_REDIRECT_URI and YOUTUBE_CHANNEL_ID.
The hosted service wires this client only when those values exist. It does not
create a Google app or approve its consent screen. YouTube exchange/refresh and
all added provider operations have passed mock tests only, not live account tests.

References used for endpoint contracts:
- https://developers.google.com/youtube/v3/docs/channels/list
- https://developers.google.com/youtube/v3/docs/playlistItems/list
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.tiktok.com/docs/en/tiktok-api-v2-get-user-info
- https://developers.tiktok.com/docs/en/tiktok-api-v2-video-list
- https://www.postman.com/meta/threads/documentation/dht3nzz/threads-api
- https://developers.pinterest.com/docs/api/v5/pins-list/
- https://developers.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/
- https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2
- https://docs.x.com/x-api/getting-started/pricing
- https://redditinc.com/policies/data-api-terms

Worker recovery fixes: capacity blocks new intake without starving existing jobs; supported refresh adapters can renew expired grants; a newly verified grant can start a new poll without resetting prior failed history. Instagram calls honor caller cancellation, including between identity and media requests. HTTP 401/403 always require authorization repair, including when the response is not JSON.
