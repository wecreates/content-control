# Provider listing observations

The authenticated observer signs `content-control:pod:listing-observation`
envelopes after actual provider readback. A successful submit alone is not proof
of a live listing. Store the observation evidence in ArtifactStore first.

An observation binds job, account, platform, provider listing ID, provider event
ID, package hash and evidence hash. Status must be LIVE and provider_verified must
be true. Identities are nonempty strings of at most 256 characters, must
round-trip through UTF-8 exactly and cannot contain NUL. The existing short-lived
signature, exact account/package checks and stored proof checks apply.
Never manufacture provider readback, permission or evidence to satisfy this gate.

Schema version 1 accepts only those listing fields plus the required signed-
envelope fields. Extra response fields and unsupported platforms fail before
database access. The inbox payload is reconstructed from the exact allowlist;
adapter bodies, headers, URLs, credentials and private diagnostic text are not
durable provider evidence. A future field requires an explicit schema-version
change rather than silently widening retained evidence.

Replaying the same provider event must preserve every observed field, including
its evidence hash. Only envelope issue/expiry times can differ. Exact retries
return duplicate:true and emit no additional event only while the locked queue
row remains published. The inbox write and publication transition are one
transaction, so a retained event attached to a submitted or ambiguous row is an
invalid durable state and fails closed rather than being acknowledged. Changed
content under the same provider event ID is a conflict, not a correction mechanism.

A genuinely new observation of an already published listing may carry a new
provider event ID and a new stored proof. It is retained in the provider inbox,
returns published:true and already_published:true, and does not emit another
pod.published transition or rewrite the original publication state timestamp.
Concurrent observations are serialized by the existing job row lock.

A row already marked published must retain the exact nonempty provider identity
that the new observation names. A missing or different durable identity rejects
the observation before its inbox insert. It must also have no failure reason or
active lease; a contradictory terminal row cannot collect more evidence as if it
were healthy. Readback may fill a missing identity only while resolving submitted
or ambiguous work; it cannot retroactively legitimize a malformed published row
or attach fresh evidence to one.

When authenticated readback resolves submitted or ambiguous work to published,
the same atomic queue update clears its prior failure reason. A live listing must
not retain `SUBMISSION_UNCERTAIN`, `LEASE_EXPIRED` or another stale remediation
code that contradicts its durable state. The prior reason remains available in
immutable events; clearing the queue field does not fabricate provider evidence
or imply that publication acceptance has passed.

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

## Submission receipt identity

A successful adapter response must identify the listing with a primitive string
containing non-whitespace text and at most 256 JavaScript string characters,
matching the observation identity contract. The identifier must be valid UTF-8
text and cannot contain NUL, because PostgreSQL would otherwise replace or reject
its JavaScript spelling. The publisher, signed observer and direct submitted
database transition all enforce this boundary before database access. Valid
opaque IDs retain their original case, spacing and characters; they are never
trimmed or invented.

A blank, oversized, missing or non-string receipt cannot mark a job submitted.
Because the adapter may already have created a listing, the publisher records
ambiguous with SUBMISSION_UNCERTAIN and no malformed provider ID. It makes only
one submission attempt. Existing authenticated, evidence-backed readback may
resolve that ambiguous job to its actual listing ID without resubmission.
A database failure still requires the existing ambiguity/recovery investigation;
no successful state write or live listing is inferred from an exception. Once a
valid provider receipt reaches the submitted transition, a rejected settlement
response emits only `SUBMISSION_SETTLEMENT_UNCERTAIN` and stops that publisher.
It never starts a second settlement transaction because the first commit outcome
may be unknown. Durable lease recovery and authenticated readback determine the
actual state without resubmission.

The same diagnostic boundary applies to the first and only fallback settlement.
If recording an ambiguous provider outcome fails, the publisher emits only
`SUBMISSION_SETTLEMENT_UNCERTAIN`; if recording a pre-submission release block
fails, it emits only `RELEASE_SETTLEMENT_UNCERTAIN`. Provider, database and
credential-bearing exception text is never returned. These fixed errors do not
claim that a state transition committed; they stop the publisher so durable lease
recovery can determine the stored state. No second settlement is attempted.

Synthetic adapter and signed-readback tests cover both malformed and valid
receipt boundaries, plus direct database-transition admission. Test publication
flags enable in-memory doubles only; live publication flags remain false and
actual adapters/readback still require separate acceptance.

An already-aborted publisher returns `STOPPED` before a dry-run queue read or an
enabled publishing claim. This prevents shutdown from acquiring a release lease,
reserving quota or applying account cooldown before cancellation is observed.
If cancellation arrives while the dry-run queue read is in flight, its completed
read is discarded and the publisher reports `STOPPED` without emitting a healthy
dry-run log. The read-only scan still acquires no lease and performs no write.
Cancellation after a claim continues through the existing fail-closed settlement
path so a claimed lease is never silently abandoned as if no work began. If the
signal changes while the claim itself is in flight, the publisher settles that
lease as blocked before starting artifact verification or adapter work. If the
claim returns no job after cancellation, it reports `STOPPED` rather than `IDLE`.
The same post-claim boundary observes either publication kill switch changing to
false. A returned lease is settled as blocked before artifact or authority work;
an empty claim reports `STOPPED`. The switches are still checked again immediately
before the external side effect, so a later disable also remains fail-closed.

## Release lease settlement

The final submitted, ambiguous or blocked transition locks the publishing row
and then checks the live PostgreSQL clock. Fencing identity and a still-valid
release lease are both required after that lock wait and again by the update.
An adapter response arriving after the five-minute lease cannot overwrite the
job, even if recovery has not yet swept it to ambiguous. The expired row remains
available for the existing recovery and provider-readback reconciliation path;
the stale worker must not retry submission or infer a successful listing.

Release settlement also accepts only three exact durable shapes: submitted has
one opaque provider `id` and no reason; ambiguous has an empty receipt plus
`SUBMISSION_UNCERTAIN`; blocked has an empty receipt plus `RELEASE_BLOCKED`.
Extra adapter fields, non-plain objects and arbitrary reason text are rejected
before database access. Adapter response bodies, headers, URLs, credentials and
private failure messages therefore cannot become queue or event evidence.
