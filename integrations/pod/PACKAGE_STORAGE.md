# Bounded atomic package storage

Production verifies all output files before persisting any of them. It holds the
package directory descriptor across manifest verification, the intervening
authority refresh and every declared member read. Manifest, KDP receipt and member
opens are rooted through the verified Linux descriptor alias, so replacing or
moving the caller-visible package path cannot splice files from another directory
into the accepted snapshot. A runtime without that descriptor alias fails closed;
it does not fall back to path-based reads. Final member symlinks are refused.

Reads are limited to 32 files, 16 MiB per file and 64 MiB per package. Each open
descriptor must identify a nonempty regular file inside that held output directory.
Fixed-size reads and a final length/hash check reject changed, truncated or oversized
files. The worker refreshes upstream and local production authority before artifact
reads and again after the snapshot.

The production boundary also binds output names to exact media metadata. Every
platform package must contain exactly `print.png`, `art-mask.png` and
`text-mask.png`; KDP additionally requires `cover.pdf`, `interior.pdf` and
`interior.receipt.json`. Empty, incomplete, extra or unknown output sets fail
before artifact persistence. Media types come from this fixed contract, never a
filename-extension fallback. Before persistence, PNG members must have the PNG
signature, first IHDR chunk and terminal IEND chunk; PDFs must have a supported
PDF header and terminal EOF marker; and receipts must decode as strict UTF-8 JSON
objects. Matching hashes do not let HTML, a primitive/array receipt or malformed
bytes inherit trusted PNG/PDF/JSON metadata. These are bounded media-envelope
checks, not complete parser safety or design approval; the independent QA stages
remain responsible for full decoding and substantive review.

The parent rejects malformed UTF-8 and duplicate decoded keys at every depth of
`manifest.json` before artifact storage or review hold. Repeated nested fields
cannot be interpreted differently by the parent, Python QA, or a reviewer. The
package and embedded-template digests continue to bind the exact producer bytes,
including Python's lossless distinction between integer and floating-point JSON
spellings; independent QA later requires the producer's canonical semantic form.

`ArtifactStore.putMany([{body, mediaType}, ...])` uses one transaction and the same
advisory lock as single-file `put`. It deduplicates hashes, computes the combined
size of missing blobs and checks the total store budget before inserts. An insert
failure rolls back that batch. A lost commit acknowledgment has an unknown outcome:
the whole batch may already exist, and hash-addressed replay is idempotent. Two
writers cannot both reserve the same remaining capacity. Exact replay does not
consume additional durable bytes.

The store rechecks the configured storage-retention cutoff after acquiring the
write lock, after immutable-row and occupied-byte queries, and after every blob
insert. If an asynchronous database wait crosses the cutoff, the transaction
stops before the next query or insert and rolls back. The transaction wrapper
also retains its final pre-commit cutoff check. This bounds work after expiry;
it does not extend the provider lifetime or replace retained backups.

Storage-backed market intake, financial intake and listing reconciliation apply
the same rule inside their transactions. They recheck retention after each
evidence lookup, conflict/readback query and mutation, so a wait that crosses the
cutoff cannot issue a later query or acknowledge a result. The transaction's
pre-commit check remains the final safeguard and rolls back any earlier mutation.

The store copies validated caller buffers before any asynchronous database wait.
Hashing and insertion use that private snapshot, so callers cannot change stored
bytes after identity is calculated. Copies are bounded by the existing 64 MiB
batch limit. Identical hashes must also agree on media type; conflicting types in
one batch fail before opening a transaction. Under the same write lock, existing
rows have their SHA-256 recomputed by PostgreSQL and their media type compared.
Only the small digest/metadata result returns to Node, not duplicate blob bodies.
Corrupt legacy rows and metadata conflicts return `ARTIFACT_CONFLICT` before any
new batch insert. Existing evidence is never overwritten or deleted automatically;
an operator must investigate through the recovery process. These checks do not
claim to validate the actual media format, rights or design quality.

Reads apply the same exact media allowlist in PostgreSQL before transferring a
blob and recheck it in the application. A legacy or foreign row with a valid
hash but unsupported media metadata is unavailable to tasks and the authenticated
artifact endpoint; it must be investigated rather than relabeled on read.
Review-package downloads additionally bind the stored media type back to every
manifest filename that references the requested digest. PNG roles require
`image/png`, KDP PDF roles require `application/pdf`, and the KDP receipt requires
`application/json`. A digest reused across roles with incompatible media contracts
is unavailable rather than interpreted according to whichever filename a client
chose. The retrieved bytes must also pass the same bounded PNG signature/chunk,
PDF header/EOF, or strict JSON-object envelope check used before production
storage. A legacy or foreign row cannot become downloadable merely because its
hash and role-correct media metadata agree. These retrieval checks preserve the
production media contract; they do not replace full decoding or independent QA.

The manifest identity used by authenticated package and artifact retrieval comes
only from the immutable `pod.production.review_required` event for that job.
Another event cannot shadow the hold merely by carrying a field also named
`manifest_sha256`; the selected identity must still match the current stored
manifest exactly. This event-kind binding preserves review provenance but does
not itself establish independent approval or live retention.

Package and artifact retrieval both recheck the configured storage lifetime
after their database wait. Crossing the safety cutoff while a query is pending
therefore returns `POD_STORAGE_EXPIRING` instead of releasing a manifest or
artifact from storage whose remaining retention is no longer acceptable.

Publication claims recheck that same retention boundary after every awaited SQL
statement while locking an account, checking quota, selecting a reviewed job,
moving it to `publishing`, reserving quota and setting account cooldown. The
transaction still rolls back if retention expires, and the prompt checkpoints
also prevent later queue, reservation or account mutations from being issued
after the cutoff.

The shared `PodDB.tx` boundary applies this rule to every transactional POD
operation. It rechecks after connection acquisition, `BEGIN`, both local timeout
statements and every query exposed to the transaction callback. Expiry during an
earlier wait therefore cannot reach a later concept, queue, review, settlement,
recovery, evidence or archive statement. An opened transaction is rolled back;
a connection that expires before `BEGIN` is released without issuing SQL.

Default store capacity remains 128 MiB. `POD_ARTIFACT_BUDGET_BYTES` sets a lower
deployment-wide write limit shared by uploads, production and artifact restore.
If present it must be a positive decimal integer string of at most 134217728;
empty, fractional, exponential and oversized values fail closed rather than
silently selecting the default. Preflight reports `ARTIFACT_STORAGE_BUDGET` and
production validates configuration before claiming a job. All writer instances
must receive the same deployment setting; this is not a database-persisted quota.
Reducing a limit does not delete existing data. Ordinary upload/production batches
containing only existing hashes remain idempotent; restore also requires its
catalog to fit the selected read bound.
Export and offline verification keep their separate archive read bounds so existing
backups remain readable after a write budget reduction.

A package exceeding a limit is blocked;
there is no automatic scaling, deletion of older artifacts or paid storage. Batch
failure cannot strand its earlier files. Successfully committed batches can still
outlive a later review/queue failure, so full storage reclamation and whole-system
recovery remain separate acceptance work. No existing artifacts are removed.

This contract preserves hash-addressed package restoration and independent QA.
It does not approve rights, replace retained backups, extend provider expiry or
establish measured 100/1,000-concept throughput. Publication stays disabled.

## Verified generation inputs

The Python layout renderer captures each source image and font with one bounded
read (nonempty, at most 16 MiB). The CLI checks the signed source identity against
that captured image; font identities are checked against captured font bytes.
Pillow decodes those same byte snapshots. Changing, replacing or removing paths
after capture cannot substitute different artwork or typography after verification.
Pixel/frame limits still apply before image decoding. A mismatched source blocks
before output-directory creation; a later font failure leaves only a failed local
workspace, never a successful CLI result or committed production package.

This establishes input-byte identity, not original authorship, license clearance,
current template approval, independent visual acceptance or live throughput.
