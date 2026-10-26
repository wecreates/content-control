# POD run receipt r283 — pin runtime PostgreSQL search path

Date: 2026-10-26 (America/Los_Angeles)

## Reconstructed state

Content Control main was
`1feae21a0742ce36d66cdbae2e58cb6b81188a4e`; Money Factory main was
`2022f19339cc6d1a1908a31c7b70d93cb6e047c8`. Current acceptance and
deployment records, open pull requests, recent workflow results, the authorized
Render service and retained Neon recovery evidence were re-read. Content Control
draft PR 692 concerns the separate social-database retention lane and was left
untouched. No open Money Factory pull request overlapped this POD work.

The r281/r282 database evidence remained intact: Neon project
`damp-base-09108632`, production branch `br-orange-sun-arizhns5`, restored
branch `br-polished-thunder-ar0d4qka`, canary clone
`br-jolly-pond-ar5yo4f8`, and snapshot `snap-broad-rice-arc4u25c` remained
ready/retained. Database administration was not repeated because this run found
an independent unblocked runtime-security gap and had no reason to mutate those
resources.

## Content Control implementation and verification

The POD runtime used unqualified PostgreSQL object and function names while
`createPodPool()` accepted the role/database ambient `search_path`. A
configuration that placed an untrusted schema before `public` could therefore
shadow verified POD objects even though migrations, privileges and TLS passed
preflight.

The runtime pool now supplies PostgreSQL startup option
`-c search_path=pg_catalog,public`. Preflight reads
`current_schemas(false)` inside its read-only transaction and fails closed
unless the effective path is exactly `pg_catalog,public`. Regressions cover an
untrusted leading schema, a missing `public` schema and the pool startup
option.

- Focused local preflight/pool tests: 36 total, 35 passed, one expected
  database-gated skip, zero failures.
- Complete local POD Node suite: 871 total, 863 passed, eight expected
  database/environment-gated skips, zero failures.
- Syntax and whitespace checks passed.
- Content Control PR 695 exact head:
  `c4790333a1cf9515321e4ebc09fdd21052b3c0df`.
- POD container runtime gates run `40356783318`, job `121691336104`:
  success.
- POD integration gates run `40356783186`, job `121691273404`: success.
- Guarded squash merge:
  `d13bccec7520b2553306b4142dbdf73a10682c9c`.
- The signed merge tree was
  `351f6bbb8eb4edfedf5be66cd40d907d67f50459`, exactly matching the
  locally tested and PR trees.

## Money Factory dependent pin and verification

- Money Factory PR 237 exact head:
  `8420acfb770a81ec0f94c19c496155fd0b178391`.
- The cross-repository workflow pins Content Control merge
  `d13bccec7520b2553306b4142dbdf73a10682c9c` while retaining
  `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`.
- Local Money Factory POD integration tests: 81 total, 76 passed, five
  expected environment-gated skips, zero failures.
- POD cross-repository review verification run `40358401186`, job
  `121696945045`: success.
- Guarded squash merge:
  `0e181a838c47824edc519c32735d12da6f190d2a`.
- The signed merge tree was
  `08fb108f28581a54ba3d319d251d928c62555971`, exactly matching the
  locally tested and PR trees.

## Authorized Render verification

The authorized free service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) remained attached to Content Control `main`
with commit-triggered deploys. It detected the exact Content Control merge and
created deployment `dep-dbfnrpvf3r2c7385ip30` at
`2026-10-26T16:20:55.646730Z`.

- Deploy-started event `evt-dbfnrq72ovcs739g5eog` recorded new commit
  `d13bccec7520b2553306b4142dbdf73a10682c9c` at
  `2026-10-26T16:20:56.007572Z`.
- Event `evt-dbfnrq7ss4as73ftt20g` recorded
  `pipeline_minutes_exhausted` at `2026-10-26T16:20:56.132882Z`.
- Deploy-ended event `evt-dbfnrq2f52qc73euohlg` recorded failed status at
  `2026-10-26T16:20:56.557539Z`.

The attempt failed before build; the changed runtime is not deployed and no
hosted production preflight was claimed. No manual retry, paid capacity,
replacement service, cache/plan change, secret access or widened network was
attempted.

## Acceptance result

This closes one PostgreSQL name-resolution/configuration gap in tested code and
keeps Money Factory pinned to the exact verified revision. It does not prove the
change deployed or establish live marketplace acceptance.

All 24 acceptance areas remain **OPEN**. Full deployed production preflight,
independent TLS observation, separately retained backup and adequate recovery
capacity, deployed hybrid dependencies, mounted current Money Factory authority
and real grants/revocation, authorized accounts and market sources, current
regional-rights and official-template evidence, substantive KDP editorial and
preview acceptance, calibrated independent QA/remediation, permitted live
adapters for KDP, Redbubble, TeePublic, Zazzle and Spreadshirt, actual economics
and financial reconciliation, owner-phone operations, monitoring/recovery
drills, measured capacity, real end-to-end acceptance and controlled launch
readiness remain unverified.

`POD_SERVICE_ENABLED`, `POD_PRODUCTION_ENABLED`,
`POD_OUTBOX_ENABLED`, `PUBLICATION_ENABLED` and
`POD_PUBLICATION_ENABLED` remain false. Etsy remains excluded. No
publication was attempted. No approval, clearance, marketplace result, revenue,
completion or continuously running self-hosted worker is claimed.
