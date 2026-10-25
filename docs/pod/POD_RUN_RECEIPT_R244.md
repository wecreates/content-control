# POD run receipt r244 — post-flush archive verification

Date: 2026-10-24

## Reconstructed state and scope

Content Control started from main
`1cc542e29164eb920281424094e36161cecfa09b`; Money Factory started from
`d00ffee35fcefaac68f5afb0f21720c4e775fc82`. The current completion,
implementation-status and free-deployment documents, open pull requests,
workflow results and the authorized existing Render service were inspected.
Open pull requests were unrelated drafts and did not overlap this recovery work.
The previously failed database-administration route had no credible access change
and was not retried. No resource, credential, account, network rule or marketplace
state was created or changed.

## Repair and regression evidence

Artifact-only and full-state exporters fsynced their encrypted files, archive
directory and parent, then validated only the archive-directory identity. A
closed object or record could be replaced or corrupted during the final parent
flush and the exporter would still return `EXPORTED`, although immediate offline
verification rejected those bytes. Both new pre-fix regressions failed with
`Missing expected rejection`; the focused baseline had 74 passes and two
failures.

[Content Control PR 584](https://github.com/wecreates/content-control/pull/584)
re-reads and authenticates the exact encrypted catalog and every object/record
through the pinned archive descriptor after all fsyncs. It binds the catalog
ciphertext and state aggregate counts to the bytes just written, then rechecks
cancellation, destination identity and the state exporter's disabled flags before
success. Corruption injected during parent flush now returns
`ARCHIVE_AUTH_FAILED` rather than `EXPORTED`.

The exact remote head was
`2e24579f1f65be04b32b0d932f61c591787dd865`; its tree
`00e50876877a378b58ccecf369284f3242d31e9d` matched the locally tested tree.
Focused archive suites passed 76/76. The dependency-free POD run passed 710/710
with two intentional skips; syntax and whitespace checks passed. The full local
discovery found 718 tests and had only six entrypoint load failures from the clean
worktree's absent `pg` package. Exact-head hosted
[integration run 40147898054](https://github.com/wecreates/content-control/actions/runs/40147898054),
job `121033081006`, and
[production-container run 40147898050](https://github.com/wecreates/content-control/actions/runs/40147898050),
job `121033081002`, supplied installed dependencies and both completed
successfully. PR 584 merged as
`8f69b1dd0dde65d0bd6fc1648bba2fc5ae59303d`; its merge tree remained the exact
tested tree.

[Money Factory PR 200](https://github.com/wecreates/Money-factory/pull/200)
pinned the cross-repository gate to that immutable Content Control merge while
retaining explicit `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false`. The exact head was
`e88e2419f54870d57032b6b0cc7dbb1eeb53c284`, and tree
`1756a468e8514916acba708ffd3b3d093e9a2eef` matched the local one-line pin.
Exact-head hosted
[run 40148392403](https://github.com/wecreates/Money-factory/actions/runs/40148392403),
job `121034559306`, passed every recovery, rights, template, editorial, package,
Node, Python and bridge stage. PR 200 merged as
`b3439a64faa6461794c0e791b3454c22421ea1ea`.

## Deployment and acceptance state

Render automatically attempted the runtime merge as deploy
`dep-dbel5a6q1p3s73ectde0`, but failed before application build at
`2026-10-25T00:51:53Z` because free pipeline minutes remained exhausted. The
exact events were deploy start `evt-dbel5a4egpmc73bl2t1g`,
`pipeline_minutes_exhausted` `evt-dbel5a4egpmc73bl2t30`, and failed deploy end
`evt-dbel5ada647c73ed3rp0`. No manual retry, purchase, plan/cache change,
replacement service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one archive-export
readback integrity gap only; code and hosted CI are not a retained live backup or
restore drill. Production restricted database/schema/migrations, retained
recovery and expiry resolution, deployed hybrid dependencies, mounted Money
Factory authority/current grants and revocation, real accounts/sources/rights/
templates/reviewers, authorized KDP/Redbubble/TeePublic/Zazzle/Spreadshirt
adapters, actual economics and financial reconciliation, owner-phone acceptance,
monitoring/recovery drills, measured capacity and a real authorized end-to-end
launch remain unverified. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; Etsy remains excluded. No
approval, clearance, revenue, publication or continuously running self-hosted
worker is claimed.
