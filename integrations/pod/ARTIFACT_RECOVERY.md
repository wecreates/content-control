# Encrypted artifact recovery (not a complete database backup)

Restore respects the smaller of its explicit archive limit and the validated
`POD_ARTIFACT_BUDGET_BYTES` deployment write limit (128 MiB by default). A caller
cannot override a lower deployment limit. Target occupied bytes and incoming new
bytes share this limit in the existing locked transaction. Invalid deployment
configuration blocks before archive reads or database writes. Export and offline
verification retain independent read bounds so lowering the write budget does not
prevent recovery inspection or export of existing data.

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

Export also enforces the 16 MiB object bound in its SQL projection. An empty or
oversized legacy row stays visible as an error without transferring its body to
Node; it is never silently omitted from a successful backup. Restore compares
existing object length, type and SHA-256 inside PostgreSQL without downloading
existing bodies. A length mismatch skips hashing and fails the restore. These
checks supplement the migrated table's size constraint and do not repair or
discard corrupt history. The ordinary read-only snapshot, budget lock, rollback
and immutable conflict rules still apply.

The archive accepts exactly the same media contract as authenticated artifact
storage: `image/png`, `application/pdf`, `application/json`, `font/ttf`,
`text/plain` and `application/zip`. This includes retained regional-rights
and font-license text plus retained KDP template archives. Any legacy/foreign
media type blocks export or verification; recovery never relabels stored bytes.

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
flag detected before COMMIT aborts and rolls back the entire restore. Existing immutable artifacts are
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

## Offline integrity verification

With the archive key and both publication flags explicitly false, run:

```
node scripts/pod_artifact_archive.mjs verify /ABSOLUTE/existing/archive-directory
```

This command needs no database URL, bridge file, signing key or network connection.
It authenticates the encrypted catalog and every referenced object, enforces the
same catalog/object/count/aggregate limits, and checks exact lengths and SHA-256
hashes. It reads one object at a time. The JSON receipt contains only scope,
object/byte counts, archive creation/verification times and archive_sha256 (the
hash of the authenticated encrypted catalog). No plaintext content, archive key or
database credentials are printed. It does not alter the archive or destination.
Catalog JSON is decoded as strict UTF-8 and rejects duplicate decoded keys at
every nesting level before any referenced object or database is accessed.

Root directory symlinks and symlinked catalog/artifact files are rejected. File
opens are nonblocking, followed by regular-file checks, so a FIFO substituted for
a catalog or object cannot hang waiting for a writer. Cancellation is checked
between bounded reads and objects. Missing, truncated or unauthenticated content
fails closed; a readable catalog by itself is insufficient.

Restore now verifies all archived objects before starting its insertion transaction
(the CLI's existing configuration preflight still runs first). It authenticates
and hashes them again inside the transaction. A file changed after the initial
verification still causes rollback, including any earlier inserts. This adds a
second bounded read pass; it does not weaken locks, expiry or publication checks.

A VERIFIED receipt proves only that the referenced artifact bytes were readable
and authentic at that time. It does not prove independent retention, future
availability, queue/account/financial recovery, current grants, production role
access or a successful destination restoration drill. Keep the separate live
acceptance requirements above open until actual evidence is recorded.


## Filesystem completion boundary

Both exporters fsync each encrypted file, then the completed archive directory,
then its existing parent directory before returning EXPORTED. Flushing a file or
directory alone does not ensure its entry in the containing directory reached
storage; see the [Linux fsync documentation](https://man7.org/linux/man-pages/man2/fsync.2.html)
(checked October 16, 2026). A directory open/flush failure rejects the export.
Opened handles are closed even when a flush fails.

Creation, encrypted writes and directory flushes stay bound to held descriptors
for the original parent and newly created archive directory. A concurrent rename,
symlink or replacement of either pathname cannot redirect archive output; a
changed destination identity rejects the export instead of returning EXPORTED.
The final check binds both the archive and its parent by device/inode. Moving the
same archive inode beneath a replacement parent during the flush is rejected,
because fsync of the former parent cannot prove the new directory entry durable.
Verification and restore likewise read every catalog/object through one held
archive-directory descriptor rather than resolving the pathname for each file.
Offline verification also rejects success if the requested root pathname no
longer names that opened directory after all authenticated reads complete.
Restore rechecks that device/inode identity inside its database transaction so
a root replacement before commit rolls back every inserted artifact.
It checks again after the transaction returns. A late replacement rejects the
receipt, but the committed artifacts may remain and require reconciliation before
any retry.

A rejected final flush can leave a readable catalog and ciphertext. Offline
VERIFIED means those bytes currently authenticate; it is not evidence that the
failed export completed durably. Preserve the failed attempt for diagnosis and
use a new destination after resolving the storage problem; exports never silently
overwrite it. Use a previously established durable parent directory and a
filesystem that supports directory fsync. This does not synchronize newly created
ancestors owned by another process, qualify storage hardware against power loss,
create off-host retention, extend database expiry or complete a live restore drill.

## Transaction completion boundary

Restore rechecks cancellation and required disabled flags after the transaction
and connection release finish. If either changes during COMMIT, the command
rejects instead of returning RESTORED, but the database may already contain the
complete restored data. This rejection is not evidence of rollback. Keep workers
and publication disabled and inspect the target before retrying; never delete
restored data to make a retry pass. Artifact retries remain idempotent only when
existing bytes, hashes and media types match exactly. A lost COMMIT response also
requires checking the target rather than assuming the transaction failed.
