# Dedicated POD state recovery

`scripts/pod_state_archive.mjs` exports, verifies and restores the ten dedicated
POD data tables from migrations 001–005. It does not back up the entire PostgreSQL
instance, Money Factory's ledger, roles, credentials, environment configuration,
external provider state or the social vault. The existing artifact-only command
and its archive format remain supported.

## Format and limits

Export uses a repeatable-read, read-only transaction. Rows are fetched one at a
time, encrypted with AES-256-GCM and authenticated with snapshot identity, table,
index, byte length and SHA-256. The encrypted catalog is written last and fsynced;
a directory without a valid catalog is incomplete. Files are mode 0600 in a new
0700 directory; existing directories are never overwritten. Fixed table names
prevent archive-controlled SQL identifiers. Reads reject symlinks and nonregular
files, authenticate each record and check hashes. Catalogs bind migration
checksums and ordered column definitions. A schema change requires an explicit
supported-format update; migration history is checked, not overwritten.
Catalog and row JSON use strict UTF-8 parsing and reject duplicate decoded keys
at every nesting level before any schema decision or database access.

The bounded backend permits at most 10,000 rows, 40 MiB serialized JSON per row,
320 MiB serialized JSON in total and 4 MiB for the catalog. Artifact bytes remain
subject to POD_ARTIFACT_BUDGET_BYTES (maximum 128 MiB). Bytea uses hex, so archive
plaintext accounting exceeds original blob storage. These limits are not a
throughput or free-host memory benchmark. Financial bigint values, JSON numbers,
timestamps and fencing tokens are passed as original PostgreSQL JSON text rather
than reserialized through JavaScript numbers.

Artifact rows use the same exact media allowlist as authenticated storage and the
artifact-only archive: `image/png`, `application/pdf`, `application/json`,
`font/ttf`, `text/plain` and `application/zip`. Rights/font-license text and
retained KDP template archives therefore survive both recovery paths without
relabeling. Any other legacy/foreign media type blocks the snapshot.

## Manual operation

Use an existing authorized restricted POD connection and separately retained
32-byte archive key in POD_ARCHIVE_KEY (64 lowercase hex characters). Supply
secrets through the existing protected environment, never command arguments or
committed files. Both publication flags must explicitly be false.

```sh
node scripts/pod_state_archive.mjs export /absolute/new-snapshot-directory
node scripts/pod_state_archive.mjs verify /absolute/new-snapshot-directory
```

Verification is offline and read-only; it needs no database or upstream keys.
Export does not require storage to have more than 24 hours remaining, so an
otherwise accessible expiring database can still be evacuated. It still requires
verified TLS through the existing connection factory and exact schema checksums.
No upload, retention destination, archive schedule or new resource is created.
Retain the directory and key separately on already authorized durable storage;
an archive on ephemeral Render storage is not a retained backup.

## Restore into an isolated, empty POD target

Provisioning a replacement database or role is outside this command. Initialize
the target through the existing protected migration path and configure the
restricted role, TLS, bridge and actual expiry. Keep the old service fenced off
before any eventual cutover. Restore requires the complete existing preflight,
POD_STATE_RESTORE_CONFIRM=EMPTY_POD_DATABASE_RECOVERY, and all four flags explicitly
false: PUBLICATION_ENABLED, POD_PUBLICATION_ENABLED, POD_PRODUCTION_ENABLED and
POD_OUTBOX_ENABLED. This command does not change those environment settings.

```sh
node scripts/pod_state_archive.mjs restore /absolute/new-snapshot-directory
```

The command verifies all archive records before database access, then takes table
locks and refuses any nonempty POD data table. Schema-version rows are expected
from migration and are not restored. It authenticates each record again while
inserting in dependency order, with foreign keys and immutability triggers active.
Any schema mismatch, conflict, corruption, cancellation or flag change detected
before COMMIT rolls back the entire restore. No deletes, truncation, DDL, conflict
overwrites or trigger bypass are used. A second restore is rejected because the
target is no longer empty; it cannot silently roll live state backward.

Restoration deliberately holds operations:

- Every restored account becomes DISABLED.
- Processing jobs become blocked with PRODUCTION_LEASE_EXPIRED, an expired
  lease and an incremented fencing token. Existing bounded repair still requires
  current authority and rights; attempt counts are preserved.
- Publishing jobs become ambiguous with RECOVERY_RECONCILIATION_REQUIRED, no
  lease and an incremented fencing token. They cannot be automatically resubmitted.
- Other job states, tombstones, immutable proof/financial rows, provider inbox
  identities, quotas, event IDs and delivery markers are preserved. One
  pod.recovery.restored audit event records the archive digest and hold counts.

The snapshot only contains facts committed as of its database snapshot. It
cannot know later sales, submissions, revocations or ledger acknowledgments.
Before any activation, verify current upstream grants and rights, reconcile
provider submissions and statements since that point, verify old-worker
isolation and account ownership, and assess the actual recovery gap. Outbox event
IDs are retained for Money Factory deduplication. Nothing in a backup constitutes
a new approval or verified profit. No activation or publication follows restore.

## Acceptance evidence

Disposable PostgreSQL tests exercise restricted-role restoration, all ten tables,
concurrent source changes, exact large integers/microsecond timestamps, late-file
corruption rollback, nonempty/schema-drift rejection, preserved tombstones and
immutability, held in-flight work and persistence after reconnect. Unit tests
cover offline verification, encryption, cross-snapshot substitution, source
integrity, budget checks and worker flags. Record actual run results separately.

Production acceptance still needs a retained live snapshot, independently held
key, an authorized restoration drill, measured recovery time/data loss and a
storage-expiry solution. Passing synthetic tests or writing these commands does
not complete those acceptance criteria.

## Filesystem completion boundary

Both exporters fsync each encrypted file, then the completed archive directory,
then its existing parent directory before returning EXPORTED. Flushing a file or
directory alone does not ensure its entry in the containing directory reached
storage; see the [Linux fsync documentation](https://man7.org/linux/man-pages/man2/fsync.2.html)
(checked October 16, 2026). A directory open/flush failure rejects the export.
Opened handles are closed even when a flush fails.

Creation, encrypted writes and directory flushes stay bound to held descriptors
for the original parent and newly created snapshot directory. A concurrent rename,
symlink or replacement of either pathname cannot redirect archive output; a
changed destination identity rejects the export instead of returning EXPORTED.
Verification and restore likewise read the catalog and every row through one held
snapshot-directory descriptor rather than resolving the pathname for each file.
Offline verification also rejects success if the requested root pathname no
longer names that opened directory after all authenticated reads complete.
Restore rechecks that device/inode identity inside its database transaction,
before safety-state mutations, so replacement rolls back the entire snapshot.
It checks again after the transaction returns. A late replacement rejects the
receipt, but the committed snapshot and safety holds may remain and require
reconciliation before any retry.

A rejected final flush can leave a readable catalog and ciphertext. Offline
VERIFIED means those bytes currently authenticate; it is not evidence that the
failed export completed durably. Preserve the failed attempt for diagnosis and
use a new destination after resolving the storage problem; exports never silently
overwrite it. Use a previously established durable parent directory and a
filesystem that supports directory fsync. This does not synchronize newly created
ancestors owned by another process, qualify storage hardware against power loss,
create off-host retention, extend database expiry or complete a live restore drill.

State export also rechecks both explicitly false publication flags after its
read-only COMMIT and after the final directory flush. A flag change during
COMMIT prevents catalog creation; a change during later file/directory flushing
rejects EXPORTED even when readable, authenticated ciphertext remains. The
completed read-only transaction is not undone by this rejection. Offline
VERIFIED describes the remaining bytes, not successful completion of the
rejected export or permission to activate workers or publication. Resolve the
flag change and use a new destination; failed exports are never overwritten.

## Transaction completion boundary

Restore rechecks cancellation and all four required disabled flags after the
transaction and connection release finish. A cancellation or flag change during
COMMIT rejects the returned result even if the full restore and its audit event
have committed. This rejection is not evidence of rollback. Likewise, a lost
COMMIT response can leave the outcome uncertain. Keep workers and publication
disabled, inspect the target and reconcile the recovery audit before deciding
what to do next. A committed state restore leaves a nonempty target, so another
restore is rejected; never delete restored rows or bypass that protection to
force a retry. No recovery failure authorizes automatic activation or publication.
