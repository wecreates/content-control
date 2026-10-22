# Money Factory event delivery

The existing POD service owns an optional outbox lifecycle. Configure POD_OUTBOX_ENABLED=true, POD_OUTBOX_URL (the deployed authoritative Money Factory event-inbox HTTPS endpoint), and POD_OUTBOX_KEY (at least 32 bytes, shared only with that inbox). POD_OUTBOX_POLL_MS defaults to 15000 and accepts 1000–300000. All defaults leave delivery off. This is internal business feedback, not marketplace publication or proof of profit.

Delivery uses the existing signed event envelope and idempotency-key header. The receiver must transactionally deduplicate event IDs. Only a bounded acknowledgement naming the exact accepted event permits delivered_at to change. A lost acknowledgement is retried: delivery is at least once, not exactly once. Multiple service instances may send duplicates safely only with the required receiver deduplication.

Each cycle handles up to 20 events. Failed events remain durable and undelivered. A cursor advances through full batches and wraps after the final batch, so rejected early events cannot permanently starve later events. The cursor is disposable process state; restart safely retries undelivered events. Failures back off to at most five minutes. Persistent failures appear as RETRYING with an aggregate failure count in /api/print/status. No payloads, destination URL, signing keys, or exception details are exposed there.

Shutdown aborts outbound requests and waits for worker and outbox loops before closing PostgreSQL. Network requests have a 15-second limit and disallow redirects. No new tables, cloud resources, or migration credentials are required.

The running loop rechecks its host environment's POD_OUTBOX_ENABLED flag before
each batch and after delivery settles. If it is no longer exactly true, the loop
drains the current batch and becomes STOPPED without starting another. Changing
the flag during a polling wait is observed when that wait ends (at most five
minutes under the built-in backoff); it does not interrupt a batch already in
flight. Use the lifecycle stop method for immediate cooperative request abort.
An acknowledged delivery count returned while stopping is retained, but that
stopped cycle does not refresh last_success_at or reset retry health. Re-enabling
the environment flag does not restart a stopped lifecycle; the host must start a
new one. This is an in-process configuration check, not remote configuration
polling or a marketplace publication switch. Live disable/restart acceptance
still requires the deployed authority and service.

Acceptance still requires a real Money Factory inbox deployment, matching secrets, a stored event sent and acknowledged, restart/redelivery verification, and a verified upstream ledger mapping. Unit/CI success does not establish these live conditions. Do not enable this flag against an arbitrary webhook collector.

## Retrieve exact review packages

Run `python scripts/pod_review_export.py --base-url https://YOUR-HOST/api/print --job-id JOB --output NEW-DIRECTORY` in the reviewer environment with INTERNAL_OPERATIONS_KEY configured securely. The downloader verifies the manifest package hash and every artifact, independently rechecks the filename-bound PNG/PDF/strict-JSON media envelope, limits total bytes, rejects redirects and unsafe filenames, refuses existing output directories, and removes its own partial output on failure. The new directory is private (`0700`), and each artifact plus `manifest.json` is created exclusively with a maximum mode of `0600`, independent of a permissive process umask. It returns REVIEW_REQUIRED, never QA approval. Run the existing pod_vision_qa.py against this directory with independently sourced reference, rights and comparative review inputs; submit the resulting signed QA envelope through the existing review endpoint only after those checks pass.

## Exact retry pagination

The internal pagination cursor uses PostgreSQL's timestamp text, preserving all
microseconds along with the event UUID tie-breaker. Do not convert cursor timestamps
to JavaScript Dates: truncated timestamps can repeatedly select a failed full batch
and starve later events. The signed event envelope is unchanged; this extra cursor
field is never sent to Money Factory. A finished sweep wraps to the oldest pending
events, and restart still retries them with the same event identities.

The regression gate includes 45 real PostgreSQL fixture rows sharing millisecond
values: 20 failures stay pending, the next 25 are acknowledged, then a new sweep
revisits the original failures. This is synthetic delivery evidence, not a live
Money Factory round trip or a claim of completed acceptance.


## Bounded bridge response cleanup

Outbox acknowledgements are capped at 4,096 body bytes; current-grant responses
are capped at 262,144. Both clients cancel unsuccessful HTTP responses and
responses rejected by declared size before reading them. Acquired readers are
cancelled and unlocked on success, size rejection, parse failure or aborted reads.
Streamed bytes are counted even if Content-Length is absent or understated.
Cleanup failures do not replace stable delivery/authority errors.

JSON uses strict UTF-8 decoding after bounded byte collection, preserving
characters split across chunks and rejecting malformed sequences, duplicate
decoded keys at every nesting level and numeric overflow. An escaped duplicate
acknowledgement ID cannot select the matching event ID, and a duplicate outer
grant member cannot select a signed payload. Only the existing exact event
acknowledgement marks an event delivered; grants still require signature,
audience, scope, permission and lifetime verification.
Request deadlines and redirect rejection remain unchanged. Failed events stay
pending for the existing retry/backoff loop. Stream-fixture tests are not a live
authority/inbox acceptance or a measured production capacity claim.

Header acquisition independently observes the same request signal as body reads:
grant requests retain their 10-second deadline and outbox requests their 15-second
deadline even when a custom transport ignores abort. An already aborted grant
does not dispatch a request. A late response after abort is discarded and its
unlocked body is cancelled best-effort; late rejections are consumed. Neither a
late acknowledgement nor a late grant can advance local state after cancellation.

At most 32 unresolved header acquisitions may use one reused transport function
in this process, shared across grant and outbox clients. An aborted call retains
its slot until the underlying transport settles; overflow fails with
BRIDGE_REQUEST_BUSY before dispatch. A transport that never settles requires
repair or process restart to release those slots. This is an admission safety
bound, not a measured capacity claim or a guarantee that a broken transport has
stopped remote work. Existing retry/backoff and exact-acknowledgement rules remain
in effect. There is no cached authorization fallback.

Each request also shares one absolute monotonic deadline across header admission,
header completion, body reads and UTF-8/JSON completion. The grant client checks
it again after signature/scope/lifetime validation; the outbox checks it before
starting the delivered-marker transaction. Completion at or beyond 10 seconds
for grants or 15 seconds for acknowledgements fails with TimeoutError even if
the event loop has not dispatched the timeout callback. Timer/signal races still
interrupt stalled asynchronous work. These checks cannot preempt synchronous
JavaScript; they reject an overdue result when control returns. They do not put
the subsequent database transaction under the network deadline or undo an event
already committed remotely. Failed acknowledgements remain pending for the
existing idempotent retry path. Controlled-clock tests are not a live timeout
drill, production capacity measurement or completed acceptance area.
