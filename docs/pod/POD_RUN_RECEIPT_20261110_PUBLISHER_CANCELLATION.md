# Publisher option/cancellation boundaries — November 10, 2026

Confirmed defect: publishOnce parameter destructuring invoked executable options
before publication-off checks, and both publisher entry points trusted public
signal fields. A shadowed aborted getter could report DRY_RUN after cancellation.
The original focused regression had 13 failures; no real provider was called.

Both entry points now snapshot only data capabilities. Native AbortSignal state
and checkpoints replace caller-overridable members. The loop's wait forwards
native cancellation to an owned timer signal and always removes its listener.
Live gate objects remain live; their values are not cached as approval.

Tests cover executable options, forged/proxy signals, shadowed cancellation,
polling interruption, and the existing synthetic release fixture. Hosted
PostgreSQL/print verification and deployment results are linked from the PR.
All enabled-flag cases are isolated in-memory fixtures, not service settings.

All 24 live acceptance areas remain open. No production database, live authority,
marketplace, network restriction, credential or publication flag is changed.
