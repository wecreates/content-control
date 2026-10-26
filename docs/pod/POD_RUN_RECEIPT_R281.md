# POD run receipt r281 — restricted Neon database and recovery drill

Date: 2026-10-26 (America/Los_Angeles)

## Reconstructed state

Content Control main was
`4e6f754df40d8bd9e6aad0836931b7b8f64b3eb1`; Money Factory main was
`2022f19339cc6d1a1908a31c7b70d93cb6e047c8`. The current completion,
implementation and free-deployment records, open pull requests, workflow results
and authorized existing Render service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) were inspected before mutation. Existing open pull
requests did not overlap this database work. The newly authorized Neon connector
was a credible changed administration path, so the previous failed Render/browser
database path was not repeated.

No paid resource, marketplace account, publication permission, network allowlist,
social-vault access or service was created. No runtime, migration or signing secret
is present in this receipt.

## Restricted database and exact migrations

The authorized free Neon project `damp-base-09108632` in AWS US West has primary
branch `br-orange-sun-arizhns5`, PostgreSQL 18 and database
`content_control_state`. The database initially contained no public tables.

A dedicated login, `pod_runtime_restricted`, was created with `NOSUPERUSER`,
`NOCREATEDB`, `NOCREATEROLE`, `NOINHERIT`, `NOREPLICATION` and `NOBYPASSRLS`.
Live catalog checks verified no administrator attributes or memberships and no
database-create or public-schema-create privilege. The exact five repository
migrations were then applied under an advisory lock in one transaction. The
database records these exact repository hashes:

| Migration | SHA-256 |
|---|---|
| `001_pod.sql` | `657736eb1854eec758337034631b0341dcbbafa3aff6e40d19c679b12e18ca98` |
| `002_pod.sql` | `f78acf8c212f40be80683b0fe64d0affb5d35f3d29b0527d0a01e6c752e2f57f` |
| `003_pod.sql` | `ad0a1d948b1ad50e97a79b47bd0d983f201dbcde7c012fd1181db850822bc4e5` |
| `004_pod.sql` | `b4d7996731a5bd73a61c9f7076b531fdeb95503dfcf22e69653eb32e5694ce11` |
| `005_pod.sql` | `7567344b1912a5009d29988ee84180d1ddd6e03a9644b8e9524c722df1d80d1b` |

The runtime login owns neither the schema nor tables. It has only
SELECT/INSERT/UPDATE on the ten named POD data tables and SELECT on
`pod_schema_version`; the version table denies INSERT and UPDATE. Live checks found
no excess privilege and no social-vault table. Eleven public tables and the five
exact version rows were visible under the restricted login.

An API-managed Neon role named `pod_runtime` was also created during access-path
evaluation. Neon assigned it managed elevated attributes that the connector would
not remove. Its initially returned credential was immediately rotated and was not
stored; the role has no POD table grants and is not used by Render or migration.
Deleting that unused provider-managed role is intentionally deferred because role
deletion is destructive and is not necessary for the restricted runtime path.

## Snapshot and isolated restoration

Manual snapshot `snap-broad-rice-arc4u25c` was created at
2026-10-26T14:06:19Z from production branch `br-orange-sun-arizhns5`, with expiry
2026-11-01T00:00:00Z. It was restored without replacing production to isolated
branch `br-polished-thunder-ar0d4qka`, named `pod-r281-recovery-drill`. The branch
reached ready state and reports the snapshot as its restore source.

Under `pod_runtime_restricted`, the recovered branch independently returned:

- database `content_control_state` and 11 public tables;
- all five exact migration rows and hashes above;
- no database-create or public-schema-create privilege; and
- no superuser, database-create, role-create, replication or bypass-RLS attribute.

This verifies provider-local snapshot restoration of the current empty operational
schema and privilege model. It does not prove restoration of production job data,
independent off-provider retention or long-term capacity. The verified free project
limit is 1 GiB with a six-hour point-in-time restore window. No provider project
deletion date was found. The snapshot expiry and current quota-period end are both
2026-11-01T00:00:00Z, which is used as a conservative operational cutoff rather
than represented as a data-deletion date.

## Render configuration and deployment result

The authorized Render service now stores the restricted Neon runtime URL with TLS
and channel binding required, plus
`POD_STORAGE_EXPIRES_AT=2026-11-01T00:00:00Z`. The migration owner URL was not
stored. These controls were explicitly retained false:

- `POD_SERVICE_ENABLED`
- `POD_PRODUCTION_ENABLED`
- `POD_OUTBOX_ENABLED`
- `PUBLICATION_ENABLED`
- `POD_PUBLICATION_ENABLED`

The environment update triggered deploy `dep-dbfls0o473hc73dlmjag` at
2026-10-26T14:04:51Z. Event `evt-dbfls138vfls739d82cg` records the start,
`evt-dbfls138vfls739d82k0` records `pipeline_minutes_exhausted`, and
`evt-dbfls14egpmc73cbjmv0` records the failed end. The failure occurred before an
application build. No manual retry, quota bypass, paid change or replacement
service was attempted.

The scheduled execution environment could not resolve the public Neon hostname,
so it did not independently complete an external TLS database session. Provider
control-plane SQL did verify the restricted role and recovered schema, and the
stored runtime URL requires TLS/channel binding, but neither fact substitutes for
the full production preflight with the real bridge, operations key and distinct
signing authorities. The service, production loop and outbox therefore remain
disabled.

## Acceptance result

All 24 live acceptance areas remain **OPEN**. Database and storage have materially
stronger live evidence, including real role isolation, exact migrations and a
provider-local restore drill, but their checklist rows still require full production
preflight, external TLS observation, independently retained backup and adequate
capacity/recovery duration. Render has not deployed the configuration. Live Money
Factory authority, current grants/revocation, authentic account/source/rights/
template/reviewer evidence, authorized five-platform submissions, actual economics
and financial reconciliation, owner-phone acceptance, measured capacity and a real
authorized end-to-end launch also remain unverified.

Both publication flags remain false; Etsy remains excluded. No approval, clearance,
marketplace result, revenue, completion or continuously running self-hosted worker
is claimed.
