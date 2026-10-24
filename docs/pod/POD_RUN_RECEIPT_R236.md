# POD run receipt r236 — canonical signed-envelope numbers

Date: 2026-10-24

## Reconstructed state and scope

Content Control started from main
`66c023e27c6c9aa8d020e0df46d57a865258c760`; Money Factory started from
`558e30d13034e4a7a6713da05c2d4730a4b27c83`. Current POD completion,
implementation-status and free-deployment documents, the r235 receipt, open
pull requests, exact-head workflow results and the authorized existing Render
service were inspected. The only open Content Control pull request outside this
work was unrelated draft OpenFilm media work and did not overlap this repair.
The previously failed database-administration path had no credible access
change and was not retried. No resource, credential, account, network rule or
marketplace state was created or changed.

## Repair and regression evidence

Content Control's signed-JSON parser rejected duplicate members and nonfinite
numeric overflow, but its HMAC envelope verifier still accepted unsafe or
noncanonical JSON number tokens. A validly authenticated payload could therefore
contain an integer that JavaScript cannot represent exactly, negative zero, a
redundant decimal/exponent spelling, a rounded fraction, or an underflowing
value. Native parsing and later serialization could silently change the signed
wire value. The focused pre-fix regression passed seven tests and failed the new
case with `Missing expected exception`.

[Content Control PR 568](https://github.com/wecreates/content-control/pull/568)
now enables canonical-number validation specifically for HMAC-authenticated
envelopes. It rejects integer-valued numbers outside JavaScript's safe range as
`ENVELOPE_JSON_UNSAFE_INTEGER` and rejects finite tokens whose exact wire
spelling is not `JSON.stringify` canonical as
`ENVELOPE_JSON_NONCANONICAL_NUMBER`. This covers positive and negative unsafe
integers, `-0`, redundant decimal and exponent forms, lossy fractions and
underflow. Recovery-record parsing deliberately retains its prior exact JSON
token behavior so PostgreSQL bigint text such as `9007199254740993` remains
lossless. The exact remote PR head was
`a3c39a5710c6b2f53aae04ebe41dd17d37b95ad9`. Remote blobs matched the tested
local contents: `43d7e93f2e03a796b1cb98e865c98eaf98ccd4a1` for
`GRANT_AUTHORITY.md`, `5338756337936607df147a59fad676982c52935b` for
`policy.mjs`, `670e4bbb5def81afa1d2a822fcb2926d387c03ac` for
`signed-json.mjs`, `54be7fb9ea42a81413d91c6a3dace92da95936a1` for the
clock regression and `55cd25a6c315618c6e1e92e0fdde56c2e874fdd3` for the
number regression.

The final focused envelope, clock, HTTP, grant, task and state-archive suites
passed 129/129. The broad dependency-free local POD Node suite reached 697
tests with 695 passed, two expected skips and zero failures. The unfiltered
local command reached 703 tests: 695 passed, two skipped, and six unchanged
import failures because this scratch checkout lacks `pg` and `express`; no
local PostgreSQL or Express pass is claimed. Exact-head hosted runs
[40115216352](https://github.com/wecreates/content-control/actions/runs/40115216352),
job 120934995879, and
[40115216336](https://github.com/wecreates/content-control/actions/runs/40115216336),
job 120934995853, both passed. They supplied pinned dependencies, disposable
PostgreSQL, full Python/rendering, real print/durable-review and
publication-disabled production-image startup gates. PR 568 was squash-merged
as `b698a1de447831aa731ae750db418e611151637b`.

[Money Factory PR 191](https://github.com/wecreates/Money-factory/pull/191)
pinned its cross-repository production gate to that immutable Content Control
merge. Its exact remote head was
`c1504f422a5feaac21a91c5e01929513c293a0f5`, with workflow blob
`8a47257f37e2e40aebd17792e65a99bbb774fc57`. Exact-head hosted run
[40115818195](https://github.com/wecreates/Money-factory/actions/runs/40115818195),
job 120936749308, passed every pinned review, recovery, rights, template,
editorial, Node, Python, package-contract and disposable-PostgreSQL stage. PR
191 was squash-merged as `677da9cb6dfb11c706e08083dec9645a07d1ebd4`.

## Deployment and acceptance state

Render auto-deploy observed the Content Control application merge as deploy
`dep-dbeeiauk1f9s73f8bpkg`, but failed before build at
2026-10-24T17:21:48Z because free pipeline minutes were exhausted. The exact
events were `pipeline_minutes_exhausted` `evt-dbeeib04cbqc73dcbkug`, deploy
start `evt-dbeeib0a6lpc73e6ul7g`, and failed deploy end
`evt-dbeeibkegpmc73bgn6tg`. No manual retry, purchase, plan/cache change,
replacement service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one signed-number
identity ambiguity only; merged code and hosted CI are not live acceptance.
Production restricted database/schema/migrations, retained recovery evidence,
deployed hybrid dependencies, mounted Money Factory authority/current grants
and revocation, real accounts/sources/rights/templates/reviewers, authorized
KDP/Redbubble/TeePublic/Zazzle/Spreadshirt adapters, actual economics and
financial reconciliation, owner-phone acceptance, monitoring/recovery drills,
measured capacity and a real authorized end-to-end launch remain unverified.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; Etsy remains excluded. No approval, clearance, revenue, publication
or continuously running self-hosted worker is claimed.
