# Provider listing observations

The authenticated observer signs `content-control:pod:listing-observation`
envelopes after actual provider readback. A successful submit alone is not proof
of a live listing. Store the observation evidence in ArtifactStore first.

An observation binds job, account, platform, provider listing ID, provider event
ID, package hash and evidence hash. Status must be LIVE and provider_verified must
be true. Identities are nonempty strings of at most 256 characters. The existing
short-lived signature, exact account/package checks and stored proof checks apply.
Never manufacture provider readback, permission or evidence to satisfy this gate.

Replaying the same provider event must preserve every observed field, including
its evidence hash. Only envelope issue/expiry times can differ. Exact retries
return duplicate:true and emit no additional event. Changed content under the
same provider event ID is a conflict, not a correction mechanism.

A genuinely new observation of an already published listing may carry a new
provider event ID and a new stored proof. It is retained in the provider inbox,
returns published:true and already_published:true, and does not emit another
pod.published transition or rewrite the original publication state timestamp.
Concurrent observations are serialized by the existing job row lock.

Migration 005 makes (platform, account_id, provider_id) unique when provider_id is
present, including submitted receipts and reconciled ambiguous jobs. A provider
listing cannot be attributed to another job in the same account by changing its
event ID. A conflict rolls back the entire observation transaction, including its
inbox entry. Listing IDs in different accounts remain independent. Provider IDs
are opaque and case-sensitive; do not trim, lowercase or replace them to bypass a
conflict. A provider lacking stable listing identities requires a separate verified
adapter contract before publication can be enabled.

Preflight requires migrations 001 through 005 with their exact checksums. Existing
duplicate listing assignments must fail migration. Do not delete rows, clear IDs,
drop the index or fabricate new identities to force deployment. Resolve historical
conflicts through actual provider and upstream financial evidence before retrying
the protected migration. This code does not apply production DDL automatically.

Synthetic concurrent PostgreSQL tests verify these boundaries; they do not verify
any real marketplace adapter, account, listing, sale or profit. Both publication
flags remain false and all five marketplace adapters still require live acceptance.
