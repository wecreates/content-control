# Money Factory event delivery

The existing POD service owns an optional outbox lifecycle. Configure POD_OUTBOX_ENABLED=true, POD_OUTBOX_URL (the deployed authoritative Money Factory event-inbox HTTPS endpoint), and POD_OUTBOX_KEY (at least 32 bytes, shared only with that inbox). POD_OUTBOX_POLL_MS defaults to 15000 and accepts 1000–300000. All defaults leave delivery off. This is internal business feedback, not marketplace publication or proof of profit.

Delivery uses the existing signed event envelope and idempotency-key header. The receiver must transactionally deduplicate event IDs. Only a bounded acknowledgement naming the exact accepted event permits delivered_at to change. A lost acknowledgement is retried: delivery is at least once, not exactly once. Multiple service instances may send duplicates safely only with the required receiver deduplication.

Each cycle handles up to 20 events. Failed events remain durable and undelivered. A cursor advances through full batches and wraps after the final batch, so rejected early events cannot permanently starve later events. The cursor is disposable process state; restart safely retries undelivered events. Failures back off to at most five minutes. Persistent failures appear as RETRYING with an aggregate failure count in /api/print/status. No payloads, destination URL, signing keys, or exception details are exposed there.

Shutdown aborts outbound requests and waits for worker and outbox loops before closing PostgreSQL. Network requests have a 15-second limit and disallow redirects. No new tables, cloud resources, or migration credentials are required.

Acceptance still requires a real Money Factory inbox deployment, matching secrets, a stored event sent and acknowledged, restart/redelivery verification, and a verified upstream ledger mapping. Unit/CI success does not establish these live conditions. Do not enable this flag against an arbitrary webhook collector.

## Retrieve exact review packages

Run `python scripts/pod_review_export.py --base-url https://YOUR-HOST/api/print --job-id JOB --output NEW-DIRECTORY` in the reviewer environment with INTERNAL_OPERATIONS_KEY configured securely. The downloader verifies the manifest package hash and every artifact, limits total bytes, rejects redirects and unsafe filenames, refuses existing output directories, and removes its own partial output on failure. It returns REVIEW_REQUIRED, never QA approval. Run the existing pod_vision_qa.py against this directory with independently sourced reference, rights and comparative review inputs; submit the resulting signed QA envelope through the existing review endpoint only after those checks pass.

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

