# PriceWatch backend integration (disabled by default)

This draft integrates the exact-price/history core, runtime/API adapter, durable SQLite transaction boundary, deletion tombstones, bounded undelivered outbox and opt-in HTTPS fetcher. It is not a deployed extension release. There is no notification dispatcher and no retailer host is enabled.

## Default behavior and host boundary

The existing `server-lowmem.js` is unchanged. It calls the monitor router and scheduler without PriceWatch configuration. New `kind: "price"` API creation returns HTTP 503 (`price watches disabled`) unless the trusted host constructs the router with `enablePriceWatches: true`. Request bodies cannot enable the feature. Generic watches retain their existing behavior.

Restored price watches fail closed without both `priceDbPath` and `fetchPricePage`; they never fall back to the legacy unrestricted fetch. The HTTPS fetcher also defaults to an empty allowed-host set. No environment variable, public endpoint, credential or production startup configuration is added by this change.

Only after the release gates below are approved may a host supply:

- Router: `createMonitorRouter(store, {enablePriceWatches: true, ...priceOptions})`
- Scheduler: `checkMonitorStore(store, priceOptions)`
- `priceOptions.priceDbPath`: private durable SQLite path on the same host/PID namespace.
- `priceOptions.fetchPricePage`: one shared `createPricePageFetcher` instance with exact approved hosts, or a trusted synthetic fixture during testing.

The flag is a feature-admission gate, not authentication. The existing client-ID trust model is unchanged and must not be treated as authenticated ownership.

## Data and lifecycle

The price API accepts explicit `priceCurrency`, `minimumDrop` and `minimumDropPercent` exact decimal strings. The first supported in-stock observation establishes a baseline. Product/variant/offer/currency identity is pinned. Unsupported, ambiguous, missing, changed or uncertain observations break continuity; recovery rebaselines rather than sending a misleading drop. Local exact arithmetic never uses floating-point money.

Checks are serialized by scope/watch, freeze their input configuration before awaiting work, and verify the watch is still current before recording. SQLite commits state and a candidate event atomically, deduplicates observation retries and rejects competing live owners. The outbox is delivery-disabled and bounded to 128 per watch / 10,000 per database by default; stricter host limits are persisted. Full capacity blocks new work without deleting undelivered events. Deletion creates a durable tombstone and erases the watch's state/outbox, blocking late commits and stale restored metadata.

New price watches remain `creation_pending` during the initial metadata save. On an initial-save error, only that newly created in-memory object is removed; unrelated concurrent watches are preserved. Once the first save succeeds the watch becomes active and can receive its first check. This does not make JSON metadata and SQLite one transaction. A crash between saves can restore an inactive `creation_pending` watch requiring explicit recovery or deletion. A failed save may have partially written data; the in-memory rollback cannot undo uncertain disk effects. Later-save failures do not roll back committed price observations.

`first_check_ok` means recording succeeded, not that a supported price was found. Clients must inspect `price_status` / `price_monitoring_status` and `price_observation` / `price_last_observation`. No raw HTML or SQLite export endpoint is provided.

## HTTPS boundary

The optional fetcher supports only canonical HTTPS URLs on port 443 with exact approved ASCII hosts. It rejects credentials, fragments, IDN/punycode hosts, IP literals, redirects and noncanonical forms. Query strings are forwarded, so the operator must approve public, noncredential product URLs.

It resolves IPv4 only, rejects any disallowed or malformed DNS answer, pins one validated public address, and verifies the TLS hostname, authorized certificate and connected peer before intentionally sending the HTTP request. Each call uses a fresh explicit HTTPS agent, fixed headers, no cookies or authorization, no proxy environment and no keepalive/session reuse. No scripts or subresources execute.

Only HTTP 200 HTML in UTF-8 is accepted; compression, invalid UTF-8, truncated bodies and excessive headers/body are rejected. Default limits are 2 MiB, 10 seconds including DNS/TLS/body, and four concurrent calls per shared instance. Every redirect is rejected. Limits may be lowered. Test dependency overrides are trusted-code-only seams, never user inputs.

This is not an SSRF-proof service: public-IP classification cannot detect private routing of public space. Egress controls, trust stores, runtime integrity and authorized successful TLS/provider compatibility remain external release gates. `verified: true` means the transport policy passed, not that a retailer price is authentic. The extractor separately accepts only an unambiguous supported Product/Offer.

## Tests and prerequisites

Run with Node 24 (verified locally on v24.19.0), Python 3 and the repository's Express dependency installed:

    bash scripts/test_pricewatch.sh

Local cloud results: 60 Node tests (one inherited cleanup test), 22 SQLite transaction/lifecycle Python tests and all 127 original extraction/history Python tests pass. Test data is synthetic; HTTP test servers are loopback only. A native malformed-TLS failure smoke test is included; successful real TLS validation has not been established. Full application CI, browser UI and live retailer tests are not claimed.

Original core tests are retained in `tests/pricewatch_core/` with their fixtures. Existing monitor regression tests are unchanged. The feature tests explicitly opt into the API flag; separate tests prove default rejection, request-body inability to enable it, generic compatibility and restored-watch fail-closed behavior.

Prerequisite lineage, now integrated into this one change:

1. Offline exact-price extraction and bounded watch history (October 19–21).
2. Runtime/API/scheduler adapter and atomic SQLite state/outbox (October 21).
3. Durable deletion tombstones (October 22).
4. Persisted outbox-capacity admission limits (October 22).
5. Opt-in HTTPS fetch policy (October 22).
6. Initial-creation save rollback and pending-scheduler regression fix (October 23).

The cumulative prior implementation applies cleanly to current main's monitor files. Integration base: `0413f767ce00d41c9f4063301833db479bebbedf` in `wecreates/content-control`. This PR preserves current `package.json`, including its newer `test:pod-python` command. No preceding unpublished patch needs to be applied separately to this PR.

## Release gates

Keep disabled until authenticated ownership, private durable storage/backups, same-host topology, retention/recovery and outbox delivery/acknowledgement policies are designed and reviewed; approve exact retailer hosts and public URL scope; validate successful TLS and egress controls; maintain the special-purpose IP registry; verify retailer/challenge compatibility; and integrate/test the current desktop extension UI. No current popup source was available for this backend change. This PR does not change authentication or permissions, create/store credentials, merge, deploy, publish a store release, or deliver alerts.
