# POD run receipt R492

Date: 2026-11-06 UTC

## Scope and result

This scheduled run continued the Amazon KDP/POD lane across
`wecreates/content-control` and `wecreates/Money-factory`. Etsy remained excluded.
The run repaired one unblocked read-only dashboard cancellation/resource-safety
defect, merged the exact passing implementation and consumer pin, and verified the
free Render deployment. This is implementation and deployment evidence, not live
marketplace acceptance: all 24 acceptance areas remain **OPEN**.

`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remained mandatory.
The run did not enable publication, purchase resources, contact a third party,
access a social vault, evade a safeguard, widen network access, or claim credentials,
marketplace clearance, tests, revenue, or approvals that were not observed.

## Reconciled starting heads and concurrent work

- Content Control started at
  `2aa689e7438400348e4886f67f8f1c411bf049be`.
- Money Factory advanced concurrently to monitor-only commit
  `476a7ca4bcd8f27142852886ae3109bda9ba7dfc`; that current head was preserved as
  the pin change's exact base.
- Open pull requests and current remote heads were inspected before branches were
  created. No open R492 POD/KDP pull request or duplicate job existed. Unrelated
  open work was left untouched and Etsy pull requests remained outside this lane.

## Confirmed defect and repair

The read-only owner dashboard passed already-started authenticated fetch,
response-reader and digest Promises into its cancellation race. If abort-listener
registration failed, protected work had already started without admitted cancellation
control. A signal that cancelled synchronously during listener registration also
allowed work to start, and a throwing listener-removal hook could replace an
otherwise verified preview.

Three regression tests were added first. Against the pre-repair implementation all
three failed: protected fetch work had started in both admission-failure cases, and
cleanup failure stopped the verified preview after the first request. The repair:

- admits the abort listener before invoking fetch, stream-read or digest work;
- does not invoke protected work after setup failure or synchronous cancellation;
- preserves the shared monotonic deadline and post-operation checkpoints;
- makes listener removal best-effort; and
- continues to suppress stale-session results and redact unexpected diagnostics.

The focused dashboard suite then passed 27/27.

## Content Control verification and merge

Local evidence:

- complete Node POD suite: 1,173 tests; 1,164 passed, nine expected skips and zero
  failures;
- complete Python POD suite: 385 passed on the serial rerun;
- `git diff --check`: passed.

The first broad Python invocation was launched concurrently with the Node suite.
One unrelated FIFO test exceeded its two-second subprocess ceiling while the other
384 Python cases passed. That case then passed alone in 0.176 seconds, and the full
serial 385-test rerun passed. This timing event is retained here rather than being
represented as an unqualified first-run success.

Content Control PR
[#1099](https://github.com/wecreates/content-control/pull/1099) used immutable head
`43c146ace8e9b8b0038b53d2dcad5378a9691a6c`. The two remote file blobs exactly
matched the locally tested blobs. Hosted POD integration run `42182090716`, job
`127773791970`, and container run `42182090837`, job `127773792625`, both passed.
The PR merged as `4ab6d11072b0f5ff5ef4243a55832db4b6cbb21b`.

## Money Factory authority pin

The Money Factory workflow now pins the exact Content Control merge above. Local
dependent evidence passed:

- the selected pinned Content Control Node contracts;
- Money Factory Node bridge: 279 tests; 278 passed, one expected PostgreSQL skip;
- Money Factory Python bridge: 81 passed; and
- `git diff --check`.

The first local Money Factory Node invocation omitted the workflow-required
`CONTENT_CONTROL_ROOT` and produced three explicit configuration failures. The
exact workflow-environment rerun passed 278/279 with the one expected skip. The
one-line pin retained both publication flags as literal `false`.

Money Factory PR
[#447](https://github.com/wecreates/Money-factory/pull/447) used immutable head
`2cd9eb5da05f853b7670cda9f23a14b1dc8b67ca`. Hosted cross-repository run
`42183002695`, job `127776697560`, passed. The PR merged as
`21c9e67a11479dd73d72b10844f7cc4aec7989a1`.

## Free Render deployment and public probes

The authorized free Docker service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) remained on `main`, commit-triggered auto-deploy,
one instance and not suspended in workspace `tea-darsafojo6nc739844hg`. No manual
or duplicate deploy was triggered.

Render auto-deployed exact functional merge
`4ab6d11072b0f5ff5ef4243a55832db4b6cbb21b` as live deploy
`dep-dbmoaeec6qcc73bb82lg`. Build-started event
`evt-dbmoaets25qs739qvg9g`, successful build-ended event
`evt-dbmoamfrkulc73ek1ed0`, deploy-started event
`evt-dbmoaefrkulc73ek1950` and successful deploy-ended event
`evt-dbmob0vrkulc73ek1jug` bind that exact revision.

Fresh public probes observed:

- `/health`: `alive=true`, `production_approved=false`, `publication=false`;
- `/livez`: `alive=true`, `production_approved=false`, `publication=false`;
- `/readyz`: `ok=false`, `production_approved=false`, `publication=false`,
  `qaStatus=GREEN`, `hashBound=true`, exact expected and actual SHA-256
  `54f37c847c79e632e26648a3f31f11f24266d316217dd71025187b1924c1b127`,
  `captionReady=false`, and `renderStatus=v2-validation-complete`.

The live process therefore serves the repaired dashboard code, while evidence
readiness remains correctly held. These probes do not establish marketplace,
editorial, rights, account, adapter or launch acceptance.

## Database administration and execution limits

The prior database-administration attempts through the connector and browser had
failed, and no credible changed database administration access path appeared in
R492. The run therefore did not repeat the unchanged failed action. Existing code,
unit tests and a live web process are not substitutes for current restricted-role
preflight, independent backup/restore evidence or live authority configuration.

This receipt describes one bounded scheduled execution with the tools and
permissions actually available to it. It does not claim a continuously running
self-hosted worker.

## Acceptance status

All 24 acceptance areas in `POD_COMPLETION_CHECKLIST.md` remain **OPEN**. Live
database/storage durability, current external grants and account records,
authorized intelligence, regional-rights evidence, official template provenance,
substantive KDP editorial/preview acceptance, independent QA/remediation,
authorized adapters for all five in-scope marketplaces, real economics and
financial reconciliation, measured capacity, end-to-end acceptance and controlled
launch remain unverified. Publication remains held for explicit owner approval,
and this automation cannot enable it.

The continuation automation therefore remains enabled.

## Receipt deployment suppression

Pending verification after this receipt is merged with `[skip render]`.
