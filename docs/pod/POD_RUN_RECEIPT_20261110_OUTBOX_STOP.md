# Native outbox shutdown — November 10, 2026

Three regressions failed against current main. Delivery receives the lifecycle
AbortSignal; shadowing its public properties turned successful or rejected
delivery into FAILED, and a synthetic abort event also failed a healthy poll.

Lifecycle checks now use the captured native aborted getter. Polling forwards
genuine native cancellation into a separate owned timer signal, ignores synthetic
events without consuming the listener, and removes its listener in finally.
Existing retry bounds, counters, cursor and in-flight delivery drain are preserved.
The focused local outbox/runtime/Date tests passed. Exact hosted tests, merged
revisions and deployment observations are linked from the PR, along with the
dependent Money Factory pin and explicit regression step.

All 24 live acceptance areas remain OPEN. No production database, live authority,
marketplace, backup, measured capacity or launch acceptance is established.
No publication/service activation, credential access, network expansion or paid
resource change is made. Database administration was not retried without a new
access path. Available scheduled tools are not a continuous self-hosted worker.
