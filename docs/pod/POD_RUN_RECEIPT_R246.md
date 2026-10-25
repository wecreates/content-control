# POD run receipt r246 — lossless financial evidence identities

Date: 2026-10-24

## Reconstructed state and scope

Content Control started from main
`f02e7a8c53818144138755287f131ff4e8ddbc3e`; Money Factory started from
`8d7146772d38eb61b00bc576ee420a12e1e052d1`. The current completion,
implementation-status and free-deployment documents, open pull requests,
workflow results and the authorized existing Render service were inspected.
Open pull requests were unrelated drafts and did not overlap this work. The
previously failed database-administration route had no credible access change
and was not retried. No resource, credential, account, network rule or
marketplace state was created or changed.

## Repair and regression evidence

Signed financial authority/provider/job identities and signed price/economics
evidence references accepted any nonblank JavaScript string within the length
limit. PostgreSQL text cannot store NUL, and unpaired UTF-16 surrogates are
replaced during UTF-8 encoding. A signed identity could therefore fail at
database entry or lose its exact identity across the release and ledger
boundary.

[Content Control PR 588](https://github.com/wecreates/content-control/pull/588)
reuses the shared opaque-text predicate for immutable financial-event identities
and release-economics evidence references. It rejects NUL and any string that
does not round-trip through UTF-8 exactly while preserving valid case, spacing,
Unicode and the existing 256-character ceiling. Financial events reject these
identities before transaction entry.

The new regression cases first produced 17 passes and two failures: malformed
economics references were accepted, and malformed financial identities reached
database access. After repair, the focused suites passed 21/21 and related
freshness/evidence suites passed 66/66. Dependency-free POD discovery passed
716/716 after excluding only the six clean-checkout entrypoints that directly
require absent `express` or `pg`; syntax and whitespace checks passed.
Exact-head
[integration run 40155254774](https://github.com/wecreates/content-control/actions/runs/40155254774),
job `121055177990`, and
[production-container run 40155254772](https://github.com/wecreates/content-control/actions/runs/40155254772),
job `121055178000`, both completed successfully. The container gate built the
production image and passed dependency/non-root, Python, Node/PostgreSQL, real
print/durable-review and publication-disabled startup stages.

The exact Content Control head was
`ff317c5cda92a7904f2542abd40c5afd95d73d5e`; its tree
`9d37942d63f3dcfb86a8acae520cb9e04d7bd7ce` matched the locally tested tree.
PR 588 merged as `4bc885d60d80e92b774e452876d423d542a03f89`, whose merge tree remained
exactly `9d37942d63f3dcfb86a8acae520cb9e04d7bd7ce`.

[Money Factory PR 202](https://github.com/wecreates/Money-factory/pull/202)
mirrored the release-economics validator and shared text-identity helper, then
advanced the cross-repository gate to that immutable Content Control merge.
Local cross-repository verification passed 116 tests with one intentional
PostgreSQL environment skip. Exact tested head
`66367ccdc30fd125bcb4f998c1a9e52b752a2ef9` and tree
`f6a79bf6fd5674abe35de03f6857245810ab75d7` retained explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`.
Exact-head
[run 40155765027](https://github.com/wecreates/Money-factory/actions/runs/40155765027),
job `121056725054`, passed every recovery, rights, template, editorial,
package, Node, Python and bridge stage. PR 202 merged as
`8e1d0825aa4cbaf978a47a44dfbdd1bef426f33d`; its merge tree matched the
tested tree.

## Deployment and acceptance state

Render automatically attempted the runtime merge as deploy
`dep-dbemql6k1f9s73fg73dg`, but failed before application build at
`2026-10-25T02:45:41Z` because free pipeline minutes remained exhausted. The
exact events were deploy start `evt-dbemql4egpmc73blv67g`,
`pipeline_minutes_exhausted` `evt-dbemqlebs3rs73c76j50`, and failed deploy
end `evt-dbemql84cbqc73dhknng`. No manual retry, purchase, plan/cache change,
replacement service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one signed financial
and economics identity boundary only; code and hosted CI are not live financial
reconciliation, marketplace or deployment acceptance. Production restricted
database/schema/migrations, retained recovery and expiry resolution, deployed
hybrid dependencies, mounted Money Factory authority/current grants and
revocation, real accounts/sources/rights/templates/reviewers, authorized
KDP/Redbubble/TeePublic/Zazzle/Spreadshirt adapters, actual economics and
provider-statement reconciliation, owner-phone acceptance, monitoring/recovery
drills, measured capacity and a real authorized end-to-end launch remain
unverified. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; Etsy remains excluded. No
approval, clearance, revenue, publication or continuously running self-hosted
worker is claimed.
