# Dormant YouTube upload core

This is tested code, **not an enabled publisher or verified live upload**. There is
no global fetch, OAuth configuration change, production credential/store wiring,
HTTP route, CLI execution command or background worker registration. Existing
social reads and their external-write denial remain unchanged. Default construction
rejects start/resume/verify with `PUBLICATION_DISABLED` before network activity.

## Interface and binding

`uploadPlan(request)` / `adapter.preflight(request)` are offline. The immutable
snapshot covers channel ID, MP4 SHA-256 and byte count, MIME, exact snippet/status
metadata and notification choice. `start`, `resume` and `verify` accept that
request and an opaque approval reference. The injected **server-owned** `authorize`
callback must validate a real, current approval record; caller-provided booleans
are not authorization. It returns approved, binding, channelId and expiresAt.
Authorization is checked again before every provider request. Credentials must
match the channel and contain both upload and readonly identity-check scopes.
The adapter rechecks owned channel identity before starting/resuming media.

Dependencies are intentionally unconfigured: transport, authorize, credentials,
readMedia, store. They are injected only by fake tests in this PR. `transport` must
honor abort signals, reject redirects, and use no ambient browser credentials.
The core pins provider hosts/paths and keeps session URLs/tokens out of results.
`readMedia` returns bytes; the core copies and hashes them. This first bounded
implementation accepts MP4 files up to 256 MiB in memory, **not YouTube's full
file-size limit**. Larger media needs a separately tested streaming implementation.

## Receipt contract and recovery

A store exposes get, put and withExclusive. put must commit durably before
resolving; withExclusive must serialize a channel/media key across ALL processes.
Never implement this with a lock held in an uncommitted database transaction:
the uncertain-state checkpoint must survive a crash. A future store should use a
crash-safe fencing/lease design with checkpoint commits and stale-owner handling.
No production store or lease design is supplied here.

`InMemoryUploadReceiptStore` is a **test fixture only**, neither encrypted nor
persistent. It must never be used with real credentials/uploads. No existing
vault or live database is read/written by this code or its tests.

A receipt key binds channel + media hash. Different metadata for an existing key
fails instead of creating a duplicate. Concurrent calls serialize on this key.
Initialization is checkpointed before POST. An uncertain initialization cannot
restart automatically. A session is saved before sending bytes; an uncertain
PUT is reconciled by querying the same session before retransmitting. Invalid or
expired sessions stop for reconciliation. 401/403 stop for reauthorization.
Retryable 5xx responses use bounded backoff and stop after three failures; resume
is explicit, with no timer or automatic job. Network uncertainty may be inspected
again explicitly, but never silently creates a new upload session.

Uploaded means only the provider returned a channel-bound video ID. verify reads
processing and metadata: failed processing is a failure; privacy/metadata mismatch
is not success; scheduled is distinct from published. Public/scheduled visibility
can only originate from the exact approved insertion metadata, never an automatic
follow-up update. Fresh approval is required if the existing approval expires
while processing. No private upload, schedule or publish was actually performed.

## Remaining activation requirements

- Confirm exact destination channel and review exact long/short media and metadata.
- Obtain action-time approval for any persistent OAuth scope/access expansion.
- Separately authorize and verify private durable storage beyond the current
  October 26, 2026 expiry; the existing store guard starts 24 hours earlier.
- Implement and review a production credential/approval/store integration. Do not
  wire this to the existing read-only SocialAutomation retry loop.
- Explicitly approve upload/publication and final settings before enabling any
  execution path, then verify actual provider processing and destination URLs.

## Verification

Run `node --test tests/youtube-upload.test.mjs tests/youtube-upload-receipts.test.mjs`
and the unchanged `node --test tests/social-automation.test.mjs` regression suite.
Tests use fake responses/bytes and an in-memory store; passing them is not live
OAuth, persistent-storage, upload or publication proof.

Official contracts checked October 23, 2026:
- https://developers.google.com/youtube/data/reference/rest/v3/videos/insert
- https://developers.google.com/youtube/data/guides/using_resumable_upload_protocol
- https://developers.google.com/youtube/data/reference/rest/v3/videos
