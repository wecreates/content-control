# Durable market-observation intake

`POST /api/print/market` requires operational authentication and a fresh signed
`content-control:pod:market` envelope from the configured market authority. This
is an observation interface, not permission to collect from a marketplace. The
authority must establish permitted collection separately. Etsy is excluded.

Upload the permitted evidence to the existing bounded artifact store first.
`source_sha256` is mandatory; optional `image_sha256` and ranked observations'
`rank_evidence_sha256` must also name stored immutable artifacts. All references
use lowercase SHA-256. Rank proof is mandatory for a positive observed rank and
is stored in its own column. An unranked observation must not claim rank proof.
If a raw source format is not an accepted artifact MIME type, preserve it in a
documented JSON evidence wrapper and hash that exact wrapper; never relabel or
pretend a screenshot reveals exact print-template dimensions.

Observation identity is `(platform, source_url, observed_at)`. An exact retry
returns `{inserted:false,id:<original>}`; refreshing envelope timestamps does not
create another observation. Country, category, price/currency, rank, every proof
hash and the observations JSON must agree with that immutable row. Conflicts
fail closed with `MARKET_REPLAY_CONFLICT` internally (the HTTP endpoint retains
its redacted error). JSON object key order is not significant; array order is.

Migration `003_pod.sql` adds rank-proof storage and append-only protection. It
does not backfill evidence or certify old rows. A legacy ranked row without the
proof hash cannot pass an exact replay check. A genuinely new observation needs
a real new observation time and authoritative evidence, not a fabricated time to
evade a conflict. New code requires all three checksummed migrations in preflight;
do not modify the already-versioned 001/002 migrations or migrate at web startup.

Stored hashes establish durable references, not truth, freshness, demand,
trademark clearance or profitability. Historical records must not be called
current trends without current source evidence. CI uses synthetic source data
and temporary PostgreSQL; it confers no collection rights or production acceptance.

## Stored proof integrity

Every referenced proof must exist and its stored bytes must hash to its claimed
SHA-256. The intake transaction recomputes digests in PostgreSQL before recording
or acknowledging either new evidence or a replay; blob bodies are not downloaded
to Node for this check. Missing evidence retains the lane-specific rejection;
mismatched bytes return EVIDENCE_ARTIFACT_CORRUPT. The transaction does not update
queue state, ledger, inbox or outbox on rejection. Existing evidence is preserved
for recovery investigation. Integrity establishes byte identity only, not source
authorization, legal clearance, listing truth or verified income.
