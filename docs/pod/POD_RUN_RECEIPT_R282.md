# POD run receipt r282 — restricted runtime canary clone

Date: 2026-10-26 (America/Los_Angeles)

## Reconstructed state

Content Control main was
`c30ea7100b4c440cb9a2103156f874916f3ca76a`; Money Factory main was
`2022f19339cc6d1a1908a31c7b70d93cb6e047c8`. Current acceptance and deployment
records, open pull requests, recent workflow results, the authorized Render service
and Neon project were re-read. Content Control draft PR 692 concerns the separate
social-database retention lane and was left untouched. No open Money Factory pull
request overlapped POD work. The latest POD gates remained successful.

Render's most recent executable attempt remained
`dep-dbfls0o473hc73dlmjag`, failed before build by exhausted pipeline minutes.
Both r281 evidence merges were correctly recorded as `commit_ignored`. No duplicate
deploy, paid change, quota bypass, new service, widened network or publication
permission was attempted.

## Data-bearing isolated clone

The existing r281 provider-local recovery branch
`br-polished-thunder-ar0d4qka` was ready and contained the exact schema restored
from snapshot `snap-broad-rice-arc4u25c`. Before mutation, the restricted runtime
role confirmed that canary `recovery-drill-r282-20261026T1443Z` did not exist.
It then inserted exactly one row into `pod_daily_concept_budget`:

| Field | Value |
|---|---|
| `business_id` | `recovery-drill-r282-20261026T1443Z` |
| `day` | `2026-10-26` |
| `used` | `17` |

The write used `pod_runtime_restricted`, not the database owner. It occurred only
on the isolated branch; a separate restricted-role query against production branch
`br-orange-sun-arizhns5` returned `production_canary_count=0`.

A second manual snapshot was requested from the canary-bearing branch, but Neon
returned `snapshots limit exceeded`. This is a verified current free-tier limit, not
a transient success. The existing r281 snapshot was retained; it was not deleted or
overwritten to make the drill pass.

Neon branch `br-jolly-pond-ar5yo4f8`, named
`pod-r282-runtime-canary-clone`, was then created non-destructively at the recovery
branch's HEAD. It identifies `br-polished-thunder-ar0d4qka` as its parent. Under the
restricted runtime role, the ready child returned:

- the exact canary row and all three values above;
- 11 public tables;
- the exact five repository migration hashes;
- no database-create or public-schema-create privilege; and
- no superuser, database-create, role-create, replication or bypass-RLS attribute.

The verified migration hashes remained:

| Migration | SHA-256 |
|---|---|
| `001_pod.sql` | `657736eb1854eec758337034631b0341dcbbafa3aff6e40d19c679b12e18ca98` |
| `002_pod.sql` | `f78acf8c212f40be80683b0fe64d0affb5d35f3d29b0527d0a01e6c752e2f57f` |
| `003_pod.sql` | `ad0a1d948b1ad50e97a79b47bd0d983f201dbcde7c012fd1181db850822bc4e5` |
| `004_pod.sql` | `b4d7996731a5bd73a61c9f7076b531fdeb95503dfcf22e69653eb32e5694ce11` |
| `005_pod.sql` | `7567344b1912a5009d29988ee84180d1ddd6e03a9644b8e9524c722df1d80d1b` |

This verifies a live restricted-role write and exact data-bearing HEAD clone while
leaving production data unchanged. It does **not** prove another snapshot restore,
point-in-time recovery, independent/off-provider retention or adequate long-term
capacity. The project still has the verified 1 GiB logical limit, six-hour restore
window and one occupied manual-snapshot slot. The two isolated branches also consume
bounded branch capacity. No branch or snapshot was deleted because those are
destructive operations and are not required to preserve this evidence.

## Acceptance result

All 24 live acceptance areas remain **OPEN**. The database/storage evidence now
includes exact migrations, restricted live writes, one provider-local snapshot
restore and a separate data-bearing branch clone. Full production preflight,
independent TLS observation, separately retained backup, adequate capacity/recovery,
deployment, live Money Factory authority, authentic domain evidence, authorized
five-platform submissions, economics/reconciliation, phone acceptance, measured
capacity and a real controlled launch remain unverified.

`POD_SERVICE_ENABLED`, `POD_PRODUCTION_ENABLED`, `POD_OUTBOX_ENABLED`,
`PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remain false. Etsy remains
excluded. No approval, clearance, marketplace result, revenue, completion or
continuously running self-hosted worker is claimed.

## Durable merge evidence

[Content Control PR 693](https://github.com/wecreates/content-control/pull/693)
merged exact tested tree `5622aecc026ca530739af104036c96036465fd80` as
`3df22d5a504333d20008d64b46f5389cf74f91b4`. Render event
`evt-dbfmgag473hc73a9ena0` records that exact `[skip render]` merge as
`commit_ignored`; the evidence-only update did not consume another blocked build
attempt or change runtime activation.
