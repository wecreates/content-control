# POD run receipt R384 — reject executable stored-task artifact records

Date: 2026-10-30 UTC

## Reconstructed state

- Content Control started from `c925ce71684167e6742afa6157eace07770e162b`; Money Factory started from `a70230463db6728ccc23355d09769bbb68eacde4`.
- No open POD/KDP pull request or duplicate R384 job existed. Older unrelated open pull requests were left untouched.
- Concurrent report/ledger commits on Content Control main were preserved. The implementation and receipt branches were based on the then-current main rather than rewriting those commits.
- `POD_COMPLETION_CHECKLIST.md` still contained all 24 live acceptance rows as OPEN. `POD_IMPLEMENTATION_STATUS.md` and `POD_FREE_DEPLOYMENT.md` still required actual deployment/provider evidence; code or fixture success was not treated as live acceptance.

## Confirmed defect and repair

The stored-task resolver had already made its options, invocation, cancellation
signal, store capability and claimed-job fields descriptor-safe. The records
returned by the artifact store were still read through ordinary
`record.media_type` and `record.body` access. A caller-supplied store could
therefore return an accessor- or Proxy-backed descriptor/input record and execute
caller code inside restoration. The returned mutable bytes were also retained
rather than snapshotted at this boundary.

Regression-only head `f307ca46fb40c8fa36053ef2da08a3921c3f4720`
reproduced the defect in integration run `41109928590`, job
`124249404246`: 1,008 Node/PostgreSQL tests ran, 1,007 passed, and only the
new artifact-record regression failed. Its trace showed
`artifact record getter executed` at the ordinary `media_type` read.

Content Control PR #903 resolves `media_type` and `body` only through
non-executable data descriptors, rejects Proxy/accessor-backed records with the
fixed `TASK_ARTIFACT_UNVERIFIED` diagnostic, and privately snapshots accepted
Buffer bytes before parsing or writing. The same boundary covers the signed task
descriptor and every restored input artifact.

Repaired exact head `29081db46b7d3601b9d0a88bf80dd0d240de3b0d`
passed:

- focused local task-resolver tests: 24/24;
- local full Node suite: 1,008 total, 999 passed, nine PostgreSQL/environment
  skips, zero failures;
- integration run `41110105405`, job `124250010627`: 1,008/1,008
  Node/PostgreSQL tests, 385 Python tests, stored-task production E2E, workflow
  controls and four free-review guards;
- container run `41110105453`, job `124250099175`: production-image build,
  1,008/1,008 Node/PostgreSQL tests, 385 Python tests, stored-task E2E and
  startup smoke with `publication_enabled=false`,
  `production_status=DISABLED` and `outbox_status=DISABLED`.

PR #903 merged as `5adf9230f58e655a1d66a1459e6cdddd3a1fb4f2`.
Post-merge System Wiring run `41110957795` and POD integration run
`41110957907`, job `124252942746`, both passed.

## Money Factory authority pin

Money Factory PR #339 changed only the Content Control verification pin to the
exact merge above. Exact pin head
`c4bbcc3d47a178bb5994252f2723434ea055fc62` passed cross-repository run
`41110993030`, job `124253061629`: 651 Node contract tests; Python groups
of 34, 23, 40, 28, 28, 93, 5, 6 and 23 tests; 121 authority/bridge Node tests;
and 81 adapter Python tests. `PUBLICATION_ENABLED` and
`POD_PUBLICATION_ENABLED` remained literal `false`. PR #339 merged as
`47f1f4c2aa3690c72d038dc788663b2ea1895b2b`.

## Hosted observation and remaining acceptance

Render auto-deploy detected functional merge
`5adf9230f58e655a1d66a1459e6cdddd3a1fb4f2` and created deploy
`dep-dbieg43bc2fs73d705eg`. Deploy-started event
`evt-dbieg47r2f7s73bu2n0g` was followed by pipeline-minutes-exhausted event
`evt-dbieg4203lvs73al3q1g` and failed deploy-ended event
`evt-dbieg4aun3ks73cqc3qg`. The attempt stopped before build or startup, so it
is not live deployment acceptance. No manual retry was triggered because
auto-deploy is enabled and the free pipeline limit is unchanged.

This scheduled run used only its actually available local runner and authorized
GitHub/Render connectors. It did not operate or claim a continuously running
self-hosted worker. It did not retry the unchanged database-administration path,
broaden network access, use marketplace credentials, contact providers, create
paid resources, access social-vault data, include Etsy, or enable production or
publication.

All 24 live acceptance areas remain OPEN. In particular, this code repair does
not prove current live grants, owner account records, official templates,
independent review, authorized marketplace submit/readback, real economics or
finance reconciliation, measured 100/1,000-per-day capacity, end-to-end provider
acceptance, or controlled launch. Publication remains held for explicit owner
approval only after every live criterion is verifiably complete.
