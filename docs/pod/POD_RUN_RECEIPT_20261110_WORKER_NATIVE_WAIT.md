# Worker polling cancellation — November 10, 2026

Four regressions failed on the preceding main. runPodWorker checked native
AbortSignal state at cycle boundaries but passed its caller-visible signal to
the timer API, which reads overridable public properties. A recovery callback
could shadow those members and turn a healthy idle runtime into FAILED.

The polling wait now forwards native abort events into an owned timer signal.
It rechecks native state after registering and removes the forwarding listener
in finally, on cancellation and ordinary interval completion. Existing cycle
error reporting remains redacted; no extra production/publication call is added.

Tests cover idle, recovery failure, publication failure, runtime stop after a
dependency shadows the signal, and listener cleanup after an ordinary interval.
Hosted gates and the dependent Money Factory pin are linked from the PR.

These are lifecycle fixtures, not live worker uptime or database acceptance.
All 24 live acceptance areas remain open. No service/publication activation,
production database, marketplace, credential or network restriction is changed.
