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
256 characters; occurrence must be a real past/present time, not a forecast.

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
