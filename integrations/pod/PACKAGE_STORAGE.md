# Bounded atomic package storage

Production verifies all output files before persisting any of them. Reads are
limited to 32 files, 16 MiB per file and 64 MiB per package. The open descriptor
must identify a nonempty regular file inside the output directory. Fixed-size
reads and a final length/hash check reject changed, truncated or oversized files.
The worker refreshes upstream and local production authority after reading.

`ArtifactStore.putMany([{body, mediaType}, ...])` uses one transaction and the same
advisory lock as single-file `put`. It deduplicates hashes, computes the combined
size of missing blobs and checks the total store budget before inserts. An insert
failure rolls back that batch. A lost commit acknowledgment has an unknown outcome:
the whole batch may already exist, and hash-addressed replay is idempotent. Two
writers cannot both reserve the same remaining capacity. Exact replay does not
consume additional durable bytes.

Default store capacity remains 128 MiB. A package exceeding a limit is blocked;
there is no automatic scaling, deletion of older artifacts or paid storage. Batch
failure cannot strand its earlier files. Successfully committed batches can still
outlive a later review/queue failure, so full storage reclamation and whole-system
recovery remain separate acceptance work. No existing artifacts are removed.

This contract preserves hash-addressed package restoration and independent QA.
It does not approve rights, replace retained backups, extend provider expiry or
establish measured 100/1,000-concept throughput. Publication stays disabled.
