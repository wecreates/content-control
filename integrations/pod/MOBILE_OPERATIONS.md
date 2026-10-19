# Read-only phone operations

The existing /api/print/dashboard now lists jobs and previews stored print artwork using the owner's existing operations key. The key is held only in the current page, sent as an Authorization header to same-origin authenticated routes, and cleared on explicit session clearing or page exit. No approval, repair or publication is performed by this UI.

GET /api/print/jobs accepts one allowlisted state, default review_required, and returns at most the 50 newest matching records. Review holds are distinct from failed QA. Only job ID, platform, state, sanitized reason, attempt count, creation time and package availability are returned; briefs, signing envelopes and credentials are excluded. Older packages can be inspected by entering their known job ID. This is a bounded operational view, not a full paginated queue export.

Print previews fetch the existing package record and its print.png artifact, with redirects disabled and response limits of 256 KiB/16 MiB. SHA-256 must match the package manifest before any image is displayed. PNG headers must declare no more than 25 million pixels before browser decoding. Other content and larger artwork require the existing independent review export tooling. Blob URLs are revoked when the view changes or session clears; stale async responses cannot restore cleared data. The content policy permits local blob images only, not external image hosts.

The hash check proves that displayed bytes match the stored manifest entry. It does not approve the manifest, establish current rights, attest superiority, replace KDP interior PDF review, or prove that a stale QA receipt is still valid. Publication remains disabled. The dashboard preserves the independent signed-review and controlled release paths.

Automated coverage includes request authentication, filter allowlisting, PostgreSQL limits and field redaction, text-node rendering, corrupted bytes, oversized responses/images, cancellation and session cleanup. A deployed phone-browser acceptance test and real owner authentication remain required; DOM simulations and HTTP tests do not establish those live criteria.

## Bounded operations and preview waits

Each refresh or preview uses one shared 30-second deadline for its asynchronous
fetch, body-read and preview-digest waits. A stalled transport cannot keep the
page waiting indefinitely even if it fails to propagate an abort. Timeout displays
"POD request timed out. Try again." Completed metrics/activity panels remain
visible when a peer request times out; incomplete or late previews never appear.

Stream cancellation and reader release are best effort and never delay or
replace a size-limit, authentication or timeout result. Timers and abort listeners
are removed on completion, replacement, session clearing and page exit. Clearing
the session still removes the key and view immediately; a late response or
transport rejection cannot restore them or replace the clear-session notice.

DOM/stream simulations cover stalled fetch/body/cancel operations, cleanup
rejection, partial-panel preservation, late responses, completed deadlines and
cancellation during admission. They establish bounded UI behavior, not real phone
authentication, production availability, network cancellation or live acceptance.
The deadline cannot preempt synchronous JavaScript that blocks the event loop.
No approval, queue mutation, external URL, credential persistence or publication
control is added.
