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
to Node for this check. The exact shared artifact-media allowlist is rechecked;
unsupported legacy/foreign metadata returns EVIDENCE_ARTIFACT_MEDIA_INVALID and
its blob is not hashed. Missing evidence retains the lane-specific rejection;
mismatched bytes return EVIDENCE_ARTIFACT_CORRUPT. The transaction does not update
queue state, ledger, inbox or outbox on rejection. Existing evidence is preserved
for recovery investigation. Integrity establishes byte identity only, not source
authorization, legal clearance, listing truth or verified income.

## Reference-analysis snapshot

The Python market-intake CLI reads one bounded reference snapshot (nonempty, at
most 16 MiB, matching the existing artifact-object ceiling). Vision analysis and
`reference_sha256` use those same bytes. Replacing, overwriting or deleting the
input path during analysis cannot change the reported evidence identity. Pixel
and frame-count checks still apply before decoding the snapshot. This does not
prove that the original local file was immutable during capture, authorize its
collection, or persist the reference: durable intake must still upload the exact
snapshot bytes and pass the stored-proof integrity checks above. Re-reading a
changed path later is not equivalent evidence and must not be substituted.

## Observation timestamps

Market and financial evidence share the explicit ISO timestamp validator. An
observation time must be a string containing the full date and time, an explicit
Z or numeric offset, and at most six fractional digits. Zone-less dates/times,
normalized invalid dates, midnight overflow, non-string values, excess precision
and future observations fail before database access. Original valid timestamps
are passed unchanged to PostgreSQL, preserving microsecond identity. Equivalent
explicit offsets identify the same immutable observation regardless of the
session timezone; truly distinct microseconds remain separate observations.
This grammar does not establish that an observation actually occurred.


## JSON-LD price precision

Numeric JSON-LD prices are parsed as decimal values directly from their source
tokens and emitted as strings. They never pass through binary floating point:
`1234567890123456.78` must not become `1234567890123456.8`, and a small nonzero
exponent must not become zero. String prices and integer prices remain supported;
negative and nonfinite prices remain unassessed (`null`). Decimal scale can be
preserved, while exponent spelling may be normalized without changing its value.
The independently bound source bytes retain the original spelling.

These are observed source prices, not approved release economics or verified
revenue. No currency conversion, minor-unit rounding, plausibility approval or
collection authorization is inferred. Existing source/rights signatures, URL and
snapshot bindings, reference analysis and final expiry checks remain required.
Synthetic offline and signed-output regressions establish value preservation;
actual authorized marketplace collection and live acceptance remain open.


## Exact future-time boundary

Market, financial and official-template evidence compare the complete signed
instant, including all six supported fractional digits, against the validation
clock. JavaScript's millisecond date parser no longer discards the remaining
microseconds for this check: evidence one microsecond beyond the clock fails,
while an exact boundary or earlier instant remains valid. Explicit timezone
offsets and pre-epoch evidence retain their actual instant. The validation clock
must be nonnegative safe integer milliseconds; invalid clocks fail closed.

Eight regression tests cover sub-millisecond future values, exact boundaries,
offset equivalence, fractional scaling, epoch edges, invalid clocks and the three
signed evidence consumers. Future market/finance evidence must fail before any
transaction; both cover and KDP interior provenance reject it. Six of these tests
failed before repair, including database access reached with future evidence.
All 34 focused time/market/finance tests pass locally; hosted integration and image
verification are required before merge. Original accepted timestamp strings are
unchanged. No clock skew allowance, evidence freshness, rights, income, official
source approval, publication permission or live acceptance is fabricated.

## Scalar source identity

The signed source URL, country, source digest and any supplied price currency
must be primitive JSON strings. URL parsing and regular expressions must not
coerce arrays into accepted scalar values. Malformed scalar fields fail before
transaction entry, including on retries, rather than reaching SQL with an array
parameter or an inconsistent stored source identity. Valid values are passed
unchanged; URLs are not canonicalized and immutable replay rules remain intact.

Synthetic signed-envelope regressions cover arrays, nested arrays, objects,
null and booleans, plus unchanged insert/replay parameters. This validates the
intake contract only; collection permission, source truth and live acceptance
still require attributable real evidence.

## Lossless durable text

The signed source URL and category, plus every string key and value nested in
the observations JSON, must be representable by PostgreSQL UTF-8 text exactly.
NUL and unpaired UTF-16 surrogates fail before transaction entry instead of
reaching a text or JSONB parameter that PostgreSQL would reject or replace.
Valid Unicode, source URL spelling, object keys, array order and JSON values are
not normalized or repaired. This durability check does not establish source
authorization, observation truth, market demand, rights clearance or freshness.
