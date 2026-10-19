# Interrupted production recovery

An internal generation job whose worker dies is fenced by its production lease. The coordinator's existing recover() operation leaves it blocked with PRODUCTION_LEASE_EXPIRED. The authenticated POST /api/print/jobs/:id/retry endpoint can now requeue that specific state using a newly obtained, signed Money Factory production grant for the same job, account, business, platform and hash-bound task.

Eligibility requires a recorded expired lease, no provider listing ID, current PASS rights with no permanent tombstone, and fewer than three attempts. Other blocked states, active leases, submitted/publishing/ambiguous states and exhausted attempts are ineligible. Publication-ambiguous work must use its separate provider-readback reconciliation path; it is never regenerated or resubmitted by this recovery route.

The row lock serializes retries. Exactly one concurrent retry archives the failed attempt and clears the old lease, manifest and QA envelope. The attempt counter is retained. The next normal claim increments the attempt and fencing token, so an old worker cannot finish or overwrite the replacement job. Grant expiry is checked again after database waits and writes; failure rolls back the transition and archival event. The production worker still checks current authority and rights at its existing stage boundaries.

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
