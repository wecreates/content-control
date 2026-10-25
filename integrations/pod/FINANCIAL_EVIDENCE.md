# Financial event identity and reconciliation

The authenticated `/api/print/financial-events` endpoint accepts a fresh signed
`content-control:pod:finance` envelope. It records observations backed by Money
Factory authority and a stored evidence artifact; it does not itself verify a
provider statement or create upstream verified profit.

Each immutable financial line has two identities:

- `(provider, provider_event_id)`: a stable provider statement-line/event identity.
- `authority_event_id`: the unique upstream verified event authorizing that line.

Both must refer to the same row. Exact retries return its original ID without
another outbox event. Reusing either identity with a different job, provider,
provider event, amount, kind, currency, occurrence time, evidence hash or authority
identity is a conflict. Changing provider IDs must never multiply one upstream
event into additional recorded income. Refreshed envelope timestamps do not
change the underlying transaction. Identity strings must be nonblank and at most
256 characters, contain no NUL and round-trip through UTF-8 exactly; occurrence
must be a real past/present time, not a forecast.

Use upstream-authorized line-level IDs for compound statements. This module does
not invent allocation IDs or apportion one upstream event among multiple rows.
If the authority has only a statement-level event, obtain actual verified line
events through its established ledger process before importing separate lines.
Corrections require independently verified new events, never rewriting history.

Migration `004_pod.sql` enforces authority uniqueness. Existing duplicate authority
IDs cause the migration to fail closed; there is no automatic deletion, rewrite,
or new authority ID generation. Such a failure requires authorized ledger
reconciliation. Preflight now requires all four checksummed migrations. Apply only
through the protected manual migration path with already authorized connectivity.

Amounts are integer minor units, currencies are not combined, and refunds/fees/
costs/taxes cannot be positive. Adjustments still require direct authoritative
evidence. Recorded net amounts are not verified business profit: complete costs,
provider reconciliation and the Money Factory ledger remain independent gates.
Fixture events and passing CI provide no real revenue, account access or approval.

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

## Occurrence precision

Occurrence timestamps must include an explicit Z or numeric timezone offset and
zero through six fractional-second digits. Ambiguous local dates, normalized
invalid calendar dates, 24:00 and finer-than-microsecond values are rejected before
transaction entry. Producers must preserve the statement's verified instant; this
endpoint does not silently round or invent timezone information.

Exact replay compares occurred_at inside PostgreSQL against the original bound
timestamp parameter. JavaScript Date values truncate PostgreSQL microseconds and
must not decide financial identity. Equivalent offsets for the same instant are
accepted; a one-microsecond difference or truncated fractional value is a conflict.
Historical rows are not rewritten. Fresh signatures and stored proof are still
required for every replay. This establishes timestamp identity, not verified profit.
