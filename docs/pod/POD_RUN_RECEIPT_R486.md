# POD run receipt R486

Date: 2026-11-06 UTC

## Scope and starting state

This run continued the authorized Amazon KDP/POD implementation lane across
`wecreates/content-control` and `wecreates/Money-factory`. Etsy remained excluded.
The current completion checklist, implementation status, free deployment guide,
repository heads, open pull requests, workflow state and the authorized Render
service `content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`) were inspected
before editing. The starting heads were Content Control
`0329a3a3c5934f838184e0c2634f6ecdc982ffad` and Money Factory
`fb0c97024c752cd0ccc04690a61c3c029b1d2fcd`. No duplicate R486 pull request or job
existed.

All 24 live acceptance areas were OPEN at the start and remain OPEN. Code and test
evidence below is not live marketplace acceptance. `PUBLICATION_ENABLED` and
`POD_PUBLICATION_ENABLED` remained false throughout.

## Reproduced defect and repair

Both shared HTTP cancellation callbacks read `signal.reason` when an abort event
arrived. A custom signal with a throwing `reason` accessor therefore made the
callback throw and left an uncooperative response-header or response-body wait
unsettled. Two focused regressions reproduced both failures on the unchanged
starting head.

Content Control PR #1081 now preserves a genuine abort reason while converting an
inaccessible or missing reason to a fixed `AbortError`. Header and body abort
callbacks can therefore settle the caller without transport cooperation or leaking
private signal details. The candidate file blobs exactly matched the locally tested
blobs. PR #1081 merged as
`dd3706a90ebfcb530f5d2520d17336d3003d936f`.

## Verification

Local Content Control verification:

- focused bridge tests: 48 passed, 0 failed;
- complete POD Node suite: 1,149 passed, 9 expected environment/PostgreSQL skips,
  0 failed (1,158 total);
- complete POD Python suite: 385 passed, 0 failed;
- `git diff --check` passed.

The first complete Node invocation in the fresh worktree lacked the declared `pg`
dependency and consequently reported eight import-only failures. Installing the
lockfile-defined dependencies with `npm ci --ignore-scripts` and rerunning produced
the complete passing result above; the partial run is not counted as acceptance.

Hosted Content Control verification on exact PR head
`03ee79e403982637c374d0fb57c14fc0d79c3d24`:

- integration run `42140710195`, job `127640043281`: success;
- container run `42140710191`, job `127640043056`: success, including image build,
  non-root/offline dependency checks, Python, Node/PostgreSQL, print/review and
  disabled-startup stages.

Money Factory PR #441 advanced the existing immutable Content Control checkout to
the merged repair. Local verification against the exact tested Content Control tree
passed 278 Node tests with one expected PostgreSQL-only skip and all 81 Python
tests. An initial Node invocation omitted the required `CONTENT_CONTROL_ROOT`
harness variable and reported three configuration failures; the corrected explicit
checkout invocation passed and is the acceptance result. Cross-repository run
`42141646176`, job `127643120788`, succeeded before PR #441 merged as
`6ca38b5f642a421524b24a042657b945145533b6`.

## Deployment evidence

The authorized Render service remained an unsuspended, one-instance free Docker
web service on `main`, with commit auto-deploy enabled and `/health` as its liveness
path. Functional merge `dd3706a90ebfcb530f5d2520d17336d3003d936f` built and
deployed successfully as `dep-dbmifivavr4c73enqq60`; Render event
`evt-dbmig1e5d6jc73ejvj7g` recorded the successful deploy end.

Documentation-only receipt PR #1082 merged as
`b15e8eda98a0c401aa04c0afc6b37ac0caa68f98`; Render event
`evt-dbmij5o473hc73dge8ig` recorded it as `commit_ignored`, preserving the verified
functional deployment without consuming another build.

Fresh browser probes after deployment returned:

- `/health`: `alive:true`, `production_approved:false`, `publication:false`;
- `/livez`: `alive:true`, `production_approved:false`, `publication:false`;
- `/readyz`: `ok:false`, `production_approved:false`, `publication:false`,
  `qaStatus:"GREEN"`, matching expected/actual SHA-256
  `59b662688952addf932c2ced9c438aa1499e282039055e71eeb5109d8e86134e`, and
  `captionReady:false`.

The deployment is process-live and correctly fail-closed; it is not launch or
end-to-end acceptance.

## Limits and remaining work

Database administration was not retried because no credible access path changed.
This run did not use production credentials, change database networking, contact a
marketplace, create a paid resource, send messages, use social-vault data, evade bot
detection or enable publication. The scheduled execution environment performed only
the connector, repository, test and public-probe operations recorded here; it is not
a continuously running self-hosted worker.

Every row in `POD_COMPLETION_CHECKLIST.md` remains OPEN. The next run should continue
the highest-priority unblocked implementation or repair while preserving the false
publication flags. The automation must remain enabled until all 24 areas have live,
attributable completion evidence and publication is held for explicit approval.
