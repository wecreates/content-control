# POD run receipt R478

Date: 2026-11-05 UTC (2026-11-05 America/Los_Angeles)

## Reconciled starting state

- Content Control `main` was
  `8dac1a66ba1735002363076c689dc6fcc7f410de`, the final R477 evidence
  commit. Money Factory `main` was
  `cf22bee477d5aed7acd963cd211e783e7078dc08`, the R477 immutable Content
  Control pin.
- Open pull requests, exact workflow heads and the authorized Render service
  were reread before implementation. The open requests were older unrelated
  lanes and no existing monotonic POD read-deadline request duplicated this
  work. Etsy requests remained excluded. Fresh worktrees were created from the
  exact heads and every existing worktree was preserved.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md`,
  `POD_FREE_DEPLOYMENT.md` and the R477 receipt were reread. All 24 acceptance
  areas still require attributable live evidence; implementation, tests and a
  healthy process do not complete them.

## Confirmed defect and repair

R477 added a fixed 30-second server deadline to authenticated read-only routes
and forwarded its signal through database pool admission and SQL. Native timer
dispatch can still be delayed while the event loop is occupied. A read that
settled at or beyond the absolute deadline could therefore return success if
its continuation ran before the delayed timeout callback.

Content Control PR 1060 retains the native deadline signal and adds an absolute
monotonic completion checkpoint before any authenticated job-list, review
package, review artifact, readiness, metrics or capacity response succeeds.
The checkpoint first observes cancellation, then requires a finite monotonic
clock strictly before the recorded deadline. A late result aborts the combined
request signal with the fixed `POD_REQUEST_TIMEOUT` reason and flows through the
route's existing sanitized failure response.

Mutation routes deliberately remain outside request deadline cancellation.
Abandoning an outcome-defining commit when the HTTP caller departs would create
an ambiguous result; their existing transaction and durable settlement
boundaries remain unchanged. Publication, production and outbox controls are
unchanged and remain disabled.

The regression delays timer delivery, advances the monotonic clock to the exact
30,000-millisecond boundary, resolves the database read while the native timer
signal is still un-aborted, and proves that success is rejected, the forwarded
signal aborts with `POD_REQUEST_TIMEOUT`, and the caller receives only the
existing `JOB_LIST_UNAVAILABLE` response. Exact PR head
`5b89f5458f6183aa2094f00a4ad359c39672887b` was verified and squash-merged
under the standing authorization as
`89426466825140f3f5e9940e5db5697e33a41dc8`.

## Verification evidence

Local Content Control verification recorded:

- the focused operations and guarded-read suites passed 46 tests with zero
  failures;
- the complete POD Node suite passed 1,139 tests, with nine expected local
  PostgreSQL-environment skips and zero failures (1,148 total);
- the complete POD Python/OpenCV suite passed 385 tests with zero failures;
- syntax checks passed for the changed JavaScript module; and
- `git diff --check` passed.

Exact-head `POD integration gates` run `42069647214` (run number 1066), job
`127393723317`, passed the complete Node/PostgreSQL, Python/OpenCV,
stored-task end-to-end, syntax, workflow-control and review-guard sequence.
Exact-head `POD container runtime gates` run `42069647597` (run number 539),
job `127393723570`, passed image build, non-root dependency probes, Python
rendering QA, Node/PostgreSQL tests, real print/review generation and disabled
hosted-startup checks.

Money Factory PR 433 changed only its immutable Content Control workflow pin
from the R477 merge to `89426466825140f3f5e9940e5db5697e33a41dc8`.
Its local Node POD suite passed 273 tests with one expected PostgreSQL skip and
zero failures; its Python POD suite passed 81 tests with zero failures.
Exact pin head `9f93c794bd7c78c377dd088070937406ec01330b` passed `POD
cross-repository review verification` run `42071086637` (run number 435), job
`127398874718`, including every pinned Content Control Node/Python/KDP group
and the Money Factory Node/Python agent suites. PR 433 was squash-merged as
`81b1df243d80f83ba0a00511e5b3a3604f627e96`.

Every hosted stage retained `PUBLICATION_ENABLED: false` and
`POD_PUBLICATION_ENABLED: false`. Neither repository change enables production,
outbox delivery or publication.

## Live service observation

Render detected functional Content Control merge
`89426466825140f3f5e9940e5db5697e33a41dc8`, built it successfully and made
deploy `dep-dbmbduvb9u1s738olkag` live. Build-ended event
`evt-dbmbe6dah0ms73ehrefg` and deploy-ended event
`evt-dbmbeegrrm5s73ed68gg` record success on the authorized free service
`content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`) in workspace
`tea-darsafojo6nc739844hg`. The R477 deploy was deactivated.

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
late-completion race in authenticated reads only. It does not establish an
independently retained database backup, close the storage-expiry boundary,
mount and authenticate live Money Factory authority, provide current grants or
revocation evidence, configure owner-authorized marketplace accounts,
establish authorized intelligence or regional rights, accept generation,
official templates, KDP manuscripts/editorial/preview output, independent QA
or verified remediation, demonstrate authorized submit/readback on KDP,
Redbubble, TeePublic, Zazzle and Spreadshirt, reconcile actual economics or
provider statements, demonstrate production mobile operations, alerts,
security or measured 100/1,000-per-day capacity, complete an authorized
end-to-end marketplace job, or grant controlled launch approval. Publication
remains held for explicit approval after every acceptance requirement is
satisfied. Etsy remains excluded.

Database administration was not retried because this run had no credible
changed access path after the recorded connector and browser failures. The run
used only its actually available repository connector, hosted workflows,
public service probes and authorized Render inspection paths. Direct Git push
lacked interactive credentials, so the configured repository connector created
the exact tested Git objects and refs. The run did not have a continuously
running self-hosted worker, database shell, marketplace session or authority to
widen network access. It did not use or disclose credentials, contact anyone,
purchase resources, access the social vault, evade bot detection, or enable
production or publication.

Useful unblocked work remains, so the automation stays enabled. It must be
disabled only after all 24 acceptance areas are verifiably complete with
publication still held for explicit approval.
