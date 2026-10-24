# POD run receipt r237 — exact signed-envelope wrappers

Date: 2026-10-24

## Reconstructed state and scope

Content Control started from main
`fe79bdd2866715eca60c9bafe452f02d49cd84ca`; Money Factory started from
`677da9cb6dfb11c706e08083dec9645a07d1ebd4`. Current POD completion,
implementation-status and free-deployment documents, the r236 receipt, open
pull requests, exact-head workflow results and the authorized existing Render
service were inspected. The only open Content Control pull request outside this
work was unrelated draft OpenFilm media work and did not overlap this repair.
The previously failed database-administration path had no credible access
change and was not retried. No resource, credential, account, network rule or
marketplace state was created or changed.

## Repair and regression evidence

The shared HMAC verifier authenticated payload and signature fields but did not
require their outer wrapper to be the exact JSON record that its producers and
HTTPS authority contract specify. A valid signed payload could therefore arrive
inside a wrapper with extra private string, symbol or non-enumerable members, an
array or custom/null prototype, an accessor, or a proxy. Direct QA/evidence
callers could then persist the untrusted wrapper verbatim even though those
members were not authenticated. The focused pre-fix run passed eight tests and
failed the new exact-wrapper regression with `Missing expected exception`.

[Content Control PR 570](https://github.com/wecreates/content-control/pull/570)
now accepts only an ordinary two-member `payload`/`signature` record before
reading either member. Both must be enumerable data properties. Accessors and
proxies fail without invoking accessor code or proxy traps; extra fields,
symbols, non-enumerable properties, arrays and custom/null prototypes fail as
`ENVELOPE_INVALID`. Frozen ordinary envelopes remain compatible. The same
shared rule covers grants, QA, intake, finance, market, template, rights and
listing-observation evidence. The exact remote PR head was
`49298dacc4421599dcb661891a1efb67fdac0f45`. Remote blobs matched the tested
local contents: `4684c6cc2872067de888549538f5d3aab1154e24` for
`policy.mjs`, `20d25a96968502ac0b7179efb4307166570c4223` for the
regression and `7367a94d82a84617885b6060a9ede757c40ae5df` for
`GRANT_AUTHORITY.md`.

The final focused verifier, clock, authority, evidence, reconciliation, release
and template suites passed 112/112. The broad dependency-free local POD Node
suite reached 698 tests with 696 passed, two expected skips and zero failures.
The unfiltered local command reached 704 tests: 696 passed, two skipped, and six
unchanged import failures because this scratch checkout lacks `pg` and
`express`; no local PostgreSQL or Express pass is claimed. Exact-head hosted
runs
[40117030791](https://github.com/wecreates/content-control/actions/runs/40117030791),
job 120940460872, and
[40117030760](https://github.com/wecreates/content-control/actions/runs/40117030760),
job 120940326895, both passed. They supplied pinned dependencies, disposable
PostgreSQL, full Python/rendering, real print/durable-review and
publication-disabled production-image startup gates. PR 570 was squash-merged
as `99233963f5f67d94f7d9a73564ebe6a4c631140b`.

[Money Factory PR 192](https://github.com/wecreates/Money-factory/pull/192)
pinned its cross-repository production gate to that immutable Content Control
merge. Its exact remote head was
`0587068bad9f950a277c185e085b99535c74760f`, with workflow blob
`56a53c5176bbdf82aa3ce3be9c70c1fa11db56b8`. Exact-head hosted run
[40117570564](https://github.com/wecreates/Money-factory/actions/runs/40117570564),
job 120941967014, passed every pinned review, recovery, rights, template,
editorial, Node, Python, package-contract and disposable-PostgreSQL stage. PR
192 was squash-merged as `55ff18b6b9ae00f3b4a917ccc966081eb0ad6514`.

## Deployment and acceptance state

Render auto-deploy observed the Content Control application merge as deploy
`dep-dbeet8bbc2fs7386ch1g`, but failed before build at
2026-10-24T17:45:05Z because free pipeline minutes were exhausted. The exact
events were deploy start `evt-dbeet8b4qb4c739nnag0`,
`pipeline_minutes_exhausted` `evt-dbeet8egej5s739qh43g`, and failed deploy end
`evt-dbeet8jsp5es73c2v7mg`. No manual retry, purchase, plan/cache change,
replacement service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one authenticated
envelope-wrapper ambiguity only; merged code and hosted CI are not live
acceptance. Production restricted database/schema/migrations, retained recovery
evidence, deployed hybrid dependencies, mounted Money Factory
authority/current grants and revocation, real
accounts/sources/rights/templates/reviewers, authorized
KDP/Redbubble/TeePublic/Zazzle/Spreadshirt adapters, actual economics and
financial reconciliation, owner-phone acceptance, monitoring/recovery drills,
measured capacity and a real authorized end-to-end launch remain unverified.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; Etsy remains excluded. No approval, clearance, revenue, publication
or continuously running self-hosted worker is claimed.
