# Interrupted production recovery

An internal generation job whose worker dies is fenced by its production lease. The coordinator's existing recover() operation leaves it blocked with PRODUCTION_LEASE_EXPIRED. The authenticated POST /api/print/jobs/:id/retry endpoint can now requeue that specific state using a newly obtained, signed Money Factory production grant for the same job, account, business, platform and hash-bound task.

Eligibility requires a recorded expired lease, no provider listing ID, current PASS rights with no permanent tombstone, and fewer than three attempts. Other blocked states, active leases, submitted/publishing/ambiguous states and exhausted attempts are ineligible. Publication-ambiguous work must use its separate provider-readback reconciliation path; it is never regenerated or resubmitted by this recovery route.

The row lock serializes retries. Exactly one concurrent retry archives the failed attempt and clears the old lease, manifest and QA envelope. The attempt counter is retained. The next normal claim increments the attempt and fencing token, so an old worker cannot finish or overwrite the replacement job. Grant expiry is checked again after database waits and writes; failure rolls back the transition and archival event. The production worker still checks current authority and rights at its existing stage boundaries.

Before resetting the queue, PostgreSQL must confirm that the archive payload
matches the attempt number, manifest, QA envelope and fixed reason that were
selected. The reset must then confirm the cleared fields, unchanged brief,
attempt and fencing token, and exact replacement grant. A mismatch rolls back
both changes. A job with an existing provider listing is ineligible even if its
row reports a QA failure. These safeguards do not regenerate or approve a job.

No automatic approval, production activation, publication, adapter call, migration or historical deletion is introduced. Request a current upstream grant through the established authority flow; do not sign one with invented clearance or reuse an expired queued envelope. Both publication switches stay false. This recovery implementation and disposable PostgreSQL tests do not establish a production restart drill, permanent backup retention or always-on hosting.

## Recovery sweep clock

The sweep uses PostgreSQL clock_timestamp() for lease expiry and the recovered
row's updated_at. Transaction-start now() can predate a lease that expires during
a relation or row-lock wait. Such a lease must be held by the current sweep once
the lock is acquired, rather than waiting for another worker cycle. Unexpired
leases are left unchanged.

Recovery still blocks interrupted production and marks interrupted publication
ambiguous. It does not requeue either state, renew a lease, reset attempts,
increment fencing, approve a job or call an adapter. Repeating the sweep leaves
already recovered rows alone. A disposable PostgreSQL test uses real relation
locks and a database-clock barrier to cover expiry during waits, already expired
leases, future leases, transition timestamps and repeated recovery for both
processing and publishing. These tests are not a live recovery drill.

Missing or non-finite PostgreSQL deadlines (including either infinity) are
not evidence of a valid or expired lease. Production and publication guards
refuse them. Recovery holds affected production as blocked with
`PRODUCTION_LEASE_UNVERIFIED` and publication as ambiguous with
`PUBLISH_LEASE_UNVERIFIED`, preserving the actual stored deadline, attempt
and fence. An unverified production lease does not qualify for the expired
lease retry route. Ambiguous publication still requires authorized
provider reconciliation; it must never be automatically resubmitted.
The read-only operations snapshot reports `UNVERIFIED_WORKER_LEASES` both
before recovery and while such holds remain unresolved.
