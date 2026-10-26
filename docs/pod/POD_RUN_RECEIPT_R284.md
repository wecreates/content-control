# POD run receipt r284 — block temporary-relation shadowing

Date: 2026-10-26 (America/Los_Angeles)

## Reconstructed state

Content Control main was
`b6e5bed59a9c9839a4f0ee83d41e7cbe33931d51`; Money Factory main was
`0e181a838c47824edc519c32735d12da6f190d2a`. The current completion,
implementation and free-deployment records, open pull requests, workflow
results and authorized Render service were re-read before changing code. No
open pull request overlapped this repair. Draft Content Control PR 692 remains
the separate social-database retention lane and was left untouched.

The retained r281/r282 database and recovery evidence was not re-administered.
This run found an independent runtime-security gap and had no credible changed
access path that justified repeating the previously blocked database
administration route.

## Content Control implementation and verification

The r283 startup option fixes the explicit PostgreSQL `search_path`, but
PostgreSQL implicitly searches a session's `pg_temp` schema before that path.
The default database-level `TEMPORARY` privilege granted to `PUBLIC` could
therefore still allow the restricted runtime to shadow an unqualified POD
relation.

The transactional storage migration now builds a safely identifier-quoted
statement server-side and revokes `TEMPORARY` on the dedicated current database
from `PUBLIC`. Preflight now blocks when the runtime identity or any reachable
member role has database `TEMP`, including an indirect `NOINHERIT` role. Tests
prove the migrated runtime lacks the effective privilege, cannot create a
temporary `pod_events` relation, and is blocked after an indirect re-grant.

- Focused local Node tests: 69 total, 65 passed, four expected
  database-gated skips, zero failures.
- Complete local POD Node suite: 872 total, 864 passed, eight expected
  environment-gated skips, zero failures.
- Local Python discovery ran 266 tests; 264 passed and two modules could not
  import because this scheduled runner lacks `cv2`. The same production-image
  Python suite passed in hosted CI with the pinned dependency installed.
- Content Control PR 698 exact head:
  `0dc0e1c7d26b2ef0bba2441b7b734bfb114dadf8`.
- The exact PR tree
  `7e34d9beca27bcd6e7093d269ca3a8458e39b92c` matched the locally tested
  tree.
- POD integration gates run `40368584004`, job `121732863389`: success.
- POD container runtime gates run `40368584096`, job `121732863534`:
  success, including Node/PostgreSQL tests in the production image.
- Guarded squash merge:
  `a7f9e7880c07a4cf9bf95569c0e2f4d7903c9f38`.
- Merge tree `76a4b41e118aa0d00e1eaa1a3046283f5fb034c1` preserves the tested
  repair plus the concurrent unrelated runtime-audit update
  `eca62b671eff31f38cf87053043b214e8ebb164e`.

The concurrent audit record reports zero critical, nine high and one moderate
dependency findings. This receipt does not treat the security acceptance area
as closed or claim those findings remediated.

## Money Factory dependent pin and verification

- Money Factory PR 238 exact head:
  `2d31045ee93174a1bb235b32c4b915ee3984d2a4`.
- Its cross-repository workflow now pins Content Control merge
  `a7f9e7880c07a4cf9bf95569c0e2f4d7903c9f38` while retaining
  `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`.
- Local Money Factory Node integration: 117 total, 116 passed, one expected
  database-gated skip, zero failures.
- Local Money Factory Python integration: 81 passed, zero failures.
- POD cross-repository review verification run `40369914156`, job
  `121737563010`: success.
- Guarded squash merge:
  `2d387a636150ce7d3c00f029fe783414be795e00`.
- The tested PR and signed merge tree were both
  `ba780dc8a3572a6e926afa925b28390219543763`.

## Authorized Render verification

The authorized free service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) remains attached to Content Control `main`, on
the free plan, with commit-triggered deploys and publication disabled. It
detected the exact Content Control merge and created deployment
`dep-dbfotk7f3r2c7387h5cg` at `2026-10-26T17:33:04.452582Z`.

- Deploy-started event `evt-dbfotkfvnr4c73doj940` recorded commit
  `a7f9e7880c07a4cf9bf95569c0e2f4d7903c9f38` at
  `2026-10-26T17:33:05.769344Z`.
- Event `evt-dbfotkb2c24c73ak70k0` recorded
  `pipeline_minutes_exhausted` at `2026-10-26T17:33:05.918383Z`.
- Deploy-ended event `evt-dbfotkphvnjc73e5u420` recorded failed status at
  `2026-10-26T17:33:07.653077Z`.

The attempt failed before build. The new runtime and preflight are not deployed,
and the live dedicated database has not been shown to have `PUBLIC TEMPORARY`
revoked. No manual retry, paid capacity, new service, plan/cache change,
credential disclosure, widened network or publication attempt was made.

## Acceptance result

This closes one tested PostgreSQL name-resolution privilege gap and keeps Money
Factory pinned to the exact verified Content Control revision. It does not prove
live migration, deployment or marketplace acceptance.

All 24 acceptance areas remain **OPEN**. In particular, full deployed production
preflight, independent TLS observation, separately retained backup and adequate
recovery capacity, deployed hybrid dependencies, current Money Factory
authority and grants/revocation, authorized marketplace accounts and market
sources, current regional-rights and official-template evidence, substantive
KDP editorial and preview acceptance, calibrated independent QA/remediation,
permitted live adapters for KDP, Redbubble, TeePublic, Zazzle and Spreadshirt,
actual economics and financial reconciliation, owner-phone operations,
monitoring/recovery drills, measured capacity, real end-to-end acceptance and
controlled launch readiness remain unverified.

`POD_SERVICE_ENABLED`, `POD_PRODUCTION_ENABLED`, `POD_OUTBOX_ENABLED`,
`PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remain false. Etsy remains
excluded. No approval, clearance, marketplace result, revenue, completion or
continuously running self-hosted worker is claimed.
