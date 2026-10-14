# Encrypted artifact recovery (not a complete database backup)

This optional manual tool exports only `public.pod_artifacts`. It does not read
the social vault, export credentials, or include queue/account/ledger state.
Artifact recovery alone does not complete storage/recovery acceptance area 2.
No archive job is scheduled or remotely uploaded by this implementation.

Use the existing runtime PostgreSQL connection and an independently supplied
`POD_ARCHIVE_KEY`: exactly 64 lowercase hex characters representing 32 secret key
bytes. Store that key separately from archives using the owner's existing secure
secret management. Do not reuse authority/reviewer/operational signing keys,
commit keys/archives, put keys on the command line or print database URLs. The
tool never generates or provisions a real credential. Losing the key makes an
archive unrecoverable. Key rotation requires a new export under the new key.

Both publication flags must be exactly `false`:

```
node scripts/pod_artifact_archive.mjs export /ABSOLUTE/NEW/archive-directory
```

The destination directory must not exist. It is created with mode 0700; encrypted
files use 0600. Each artifact and the catalog use AES-256-GCM with independent
random nonces and authenticated context. Export uses a repeatable-read read-only
snapshot, checks content hashes, fetches one object at a time and writes/syncs the
encrypted catalog last. An incomplete directory without a valid catalog must not
be treated as a backup. Partial encrypted files are left for inspection, never
overwritten by a retry; use a new directory. A receipt reports only counts/bytes.

Retain the completed archive on an owner-authorized independent durable medium.
An archive left only on Render's ephemeral disk or in the expiring source database
is not independent recovery. This feature neither selects a retention destination
nor guarantees that local disk, hosting or the source database will persist.

Restore with the already configured destination runtime connection, real storage
expiry and bridge configuration. Set `POD_ARCHIVE_RESTORE_CONFIRM` to
`ARTIFACTS_ONLY_NO_QUEUE_RESTORE` after confirming the target and the intended
archive. Restore first runs the existing read-only preflight, including verified
TLS, restricted role, schema checksums and social-vault isolation:

```
node scripts/pod_artifact_archive.mjs restore /ABSOLUTE/existing/archive-directory
```

It authenticates the catalog, rejects symlinked files, enforces 16 MiB/object,
10,000 objects and at most 128 MiB total data, then restores within one transaction
under the existing artifact-budget lock. Exact existing bytes/type are idempotent;
any mismatch, corruption, budget exhaustion, cancellation or changed publication
flag aborts and rolls back the entire restore. Existing immutable artifacts are
never overwritten. Destination storage lifetime checks still apply. Export remains
read-only and can retrieve reachable artifacts even when production's expiry
guard is blocking new work; it does not extend provider storage lifetime.

No accounts are activated, jobs requeued, grants renewed, rights cleared, ledger
entries created or listings published. Queue/ledger recovery needs a separately
authorized complete database backup/restore strategy, identity preservation,
upstream reconciliation and crash/revocation drills. CI tests isolated databases
and synthetic bytes only. Actual production export, independent retention, key
custody, restoration drill, capacity/retention planning and expiry resolution remain
required before claiming live recovery acceptance.
