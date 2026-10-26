# POD run receipt r285 — dependency hardening and deployment-budget controls

Date: 2026-10-26

## Scope and starting heads

- Content Control started at `dcec4087a53650c071ea46acb5191abc3fb1d34e`.
- Money Factory started at `2d387a636150ce7d3c00f029fe783414be795e00`.
- The current completion checklist still leaves all 24 live acceptance areas open.
- `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remained false. Etsy was
  excluded. No marketplace publication or external write was attempted.

## Runtime dependency repair

[Content Control PR 701](https://github.com/wecreates/content-control/pull/701)
merged as `b94e378644119baee9151b65d3af0fcda885b111`. It:

- constrained `body-parser` to 1.20.9 and `fast-uri` to 3.1.9;
- reduced the normalized npm audit from 9 high plus 1 moderate finding to
  8 high findings and no moderate, low or critical findings;
- retained Remotion 4.0.529 and its supported Zod 4.5.4 after both the current
  and latest available Remotion releases rejected Zod 4.6.6 in their version
  compatibility check;
- routed the generated dependency-audit receipt through the exact staged-path
  Render skip policy without exempting dependency manifests or lockfiles.

Local evidence included 1,331 Node tests with 1,322 passing and 9 expected
skips, 872 POD tests with 864 passing and 8 expected skips, 124 social tests
with 123 passing and 1 expected skip, a passing workflow-control audit, and a
clean installed dependency graph. Hosted runs `40373583159`, `40373583168`,
`40373583363`, `40373583141` and `40373583074` all completed successfully,
including the production Docker image, real print generation, PostgreSQL and
disabled-host startup checks.

The normalized post-merge report is commit
`3d8f2bad2582a8d37ecd3c84d2166eb704c29f46`; it records 0 critical, 8 high,
0 moderate and 0 low findings with publication disabled. Render event
`evt-dbfpcrc9v7es7398g7c0` records that exact report-only commit as
`commit_ignored`, proving the new suppression path was active.

## Money Factory authority propagation

[Money Factory PR 239](https://github.com/wecreates/Money-factory/pull/239)
merged as `d58681e93df751366515d0663d7184772566f629`, pinning the cross-repository
POD verification workflow to Content Control merge `b94e3786`. Local Money
Factory integration tests passed 81/81 and the pinned Content Control subset
passed 580/580. Hosted cross-repository run `40374854850` completed
successfully.

## Render deployment evidence

The authorized free Render service attempted Content Control merge `b94e3786`
as deploy `dep-dbfpcluk1f9s73e5ktp0`. Event
`evt-dbfpcm1k4pus738qdl1g` records pipeline-minutes exhaustion before a build
could run, and `evt-dbfpcmtgfkps73aalieg` records the deploy ending failed.
This is not live deployment acceptance and does not establish a code-level
build failure.

The generated integrity-manifest commit
`2fc8787ce0ae520067c7601877e62e82d8889c63` then consumed a redundant blocked
deploy attempt (`dep-dbfpcro473hc73d9h1eg`) even though its only changed file
was `state/runtime-integrity-manifest.json`. PR 702 contains the tested
exact-path suppression repair. Its POD integration and production-container
gates passed, but its independent caption/render workflow remained stalled in
the runner's `apt-get install ffmpeg` step during this receipt; PR 702 was left
open and unmerged rather than treating an incomplete check as success.

## Remaining boundaries

There was no credible changed database-administration access path, so the
previously failed connector/browser database action was not repeated. Live
database migration, successful Render deployment, external account evidence,
platform previews, independent human review, measured live capacity,
reconciliation and controlled-launch acceptance remain open. No approval,
clearance, marketplace result, revenue, completion or continuously running
self-hosted worker is claimed.
