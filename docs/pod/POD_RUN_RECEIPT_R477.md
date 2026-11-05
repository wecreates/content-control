# POD run receipt R477

Date: 2026-11-05 UTC (2026-11-05 America/Los_Angeles)

## Reconciled starting state

- Content Control `main` was
  `3d7d12615e04bae3ef928b21ec8ff2ffb768e644`. Three commits after R476
  updated only the runtime-security audit, zero-credit V10 QA proof and accepted
  candidate rollback ledger; the fresh worktree preserved them in its exact base.
- Money Factory `main` was
  `3af2473282bfe88fee24514ea13d83902734cd7a`, the R476 immutable Content
  Control pin.
- Open pull requests, exact workflow heads and the authorized Render service
  were reread before implementation. The open requests were older unrelated
  draft lanes and no existing POD request-deadline PR duplicated this work.
  Etsy requests remained excluded. Fresh worktrees were created from the exact
  heads and every existing worktree was preserved.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md`,
  `POD_FREE_DEPLOYMENT.md` and the R476 receipt were reread. All 24 acceptance
  areas still require attributable live evidence; implementation, tests and a
  healthy process do not complete them.

## Confirmed defect and repair

R476 tied every authenticated read-only route to client disconnects and
forwarded that cancellation through guarded database work. That lifecycle did
not have a server-owned deadline. A caller that stayed connected, including a
non-dashboard client, could therefore leave a read waiting in database pool
admission without a fixed server ceiling and retain pressure on the production
pool's two-slot budget.

Content Control PR 1057 applies one fixed 30-second server deadline to every
authenticated read-only request. The signal forwarded through job-list,
package, artifact, readiness, metrics and capacity work now combines that
deadline with the existing request-abort and response-close cancellation. The
shared guarded database helpers interrupt pool admission and stalled SQL,
destroy late or uncertain clients, and preserve their existing commit,
rollback and session-scrub boundaries. Metrics and capacity keep their own
diagnostic deadline inside the shorter request ceiling.

Mutation routes deliberately remain outside disconnect/deadline cancellation:
abandoning an outcome-defining commit when the HTTP caller departs would create
a different ambiguous-result boundary. Their database transactions retain the
existing statement, lock and settlement safeguards. Normal completed reads and
their sanitized public errors are unchanged. Publication, production and
outbox controls are unchanged and remain disabled.

The regression keeps the client connected, substitutes the deadline signal at
the native boundary, proves the router selected exactly 30,000 milliseconds,
observes an aborted database signal with `TimeoutError`, and verifies the
caller receives only the existing `JOB_LIST_UNAVAILABLE` response. Exact PR
head `369a7e596d3ff695b814633aa531a0f6e945773d` was verified and
squash-merged under the standing authorization as
`8e5e9fbccc722f1e440f4127be1ad266403cab3c`.

## Verification evidence

Local Content Control verification recorded:

- the focused operations and guarded-read suites passed 45 tests with zero
  failures;
- the complete POD Node suite passed 1,138 tests, with nine expected local
  PostgreSQL-environment skips and zero failures (1,147 total);
- the complete POD Python/OpenCV suite passed 385 tests with zero failures;
- syntax checks passed for the changed JavaScript module; and
- `git diff --check` passed.

Exact-head `POD integration gates` run `42065137999` (run number 1064), job
`127377057272`, passed the complete Node/PostgreSQL, Python/OpenCV,
stored-task end-to-end, syntax, workflow-control and review-guard sequence.
Exact-head `POD container runtime gates` run `42065137662` (run number 538),
job `127377058142`, passed image build, non-root dependency probes, Python
rendering QA, Node/PostgreSQL tests, real print/review generation and disabled
hosted-startup checks.

Money Factory PR 432 changed only its immutable Content Control workflow pin
from the R476 merge to `8e5e9fbccc722f1e440f4127be1ad266403cab3c`.
Its local Node POD suite passed 273 tests with one expected PostgreSQL skip and
zero failures; its Python POD suite passed 81 tests with zero failures.
Exact pin head `d80849926371a05a44ec38966c61d53ececc33c1` passed `POD
cross-repository review verification` run `42066387915` (run number 434), job
`127381501996`, including every pinned Content Control Node/Python/KDP group
and the Money Factory Node/Python agent suites. PR 432 was squash-merged as
`cf22bee477d5aed7acd963cd211e783e7078dc08`.

Every hosted stage retained `PUBLICATION_ENABLED: false` and
`POD_PUBLICATION_ENABLED: false`. Neither repository change enables production,
outbox delivery or publication.

## Live service observation

Render detected functional Content Control merge
`8e5e9fbccc722f1e440f4127be1ad266403cab3c`, built it successfully and made
deploy `dep-dbmb14rm8hqs73d36a8g` live. Build-ended event
`evt-dbmb1d23ep3s73a03dhg` and deploy-ended event
`evt-dbmb1nupb74c739fn77g` record success on the authorized free service
`content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`) in workspace
`tea-darsafojo6nc739844hg`. The previous current-main deploy was deactivated.

Direct unauthenticated probes after rollout returned:

- `/health`: HTTP 200, `alive=true`, `production_approved=false` and
  `publication=false`;
- `/livez`: HTTP 200 with the same production/publication holds; and
- `/readyz`: HTTP 503, with `ok=false`, GREEN QA and matching expected/actual
  SHA-256
  `59b662688952addf932c2ced9c438aa1499e282039055e71eeb5109d8e86134e`,
  but `captionReady=false`, `production_approved=false` and
  `publication=false`.

This proves process liveness for the exact merged repair and confirms that the
acceptance readiness gate still fails closed. It does not convert deployment
success into hosting, end-to-end or launch acceptance.

## Remaining boundaries and execution limits

All 24 live acceptance areas remain **OPEN**. This repair closes one code-level
server deadline and pool-retention gap in authenticated reads only. It does not
establish an independently retained database backup, close the storage-expiry
boundary, mount and authenticate live Money Factory authority, provide current
grants or revocation evidence, configure owner-authorized marketplace accounts,
establish authorized intelligence or regional rights, accept generation,
official templates, KDP manuscripts/editorial/preview output, independent QA or
verified remediation, demonstrate authorized submit/readback on KDP,
Redbubble, TeePublic, Zazzle and Spreadshirt, reconcile actual economics or
provider statements, demonstrate production mobile operations, alerts,
security or measured 100/1,000-per-day capacity, complete an authorized
end-to-end marketplace job, or grant controlled launch approval. Publication
remains held for explicit approval after every acceptance requirement is
satisfied. Etsy remains excluded.

Database administration was not retried because this run had no credible
changed access path after the recorded connector and browser failures. The run
used only its actually available repository connector, hosted workflows, public
service-probe and authorized Render inspection paths. Direct Git push lacked
interactive credentials, so the configured repository connector created the
exact tested Git objects and refs. The run did not have a continuously running
self-hosted worker, database shell, marketplace session or authority to widen
network access. It did not use or disclose credentials, contact anyone,
purchase resources, access the social vault, evade bot detection, or enable
production or publication.

Useful unblocked work remains, so the automation stays enabled. It must be
disabled only after all 24 acceptance areas are verifiably complete with
publication still held for explicit approval.
