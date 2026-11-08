# Configured storage window telemetry

The existing public GET /api/print/status includes storage_lifetime even when
POD service/production/outbox are disabled, or status health is unavailable.
It reads no database, operations key, connection URL, snapshot or provider API.

The object contains status, operational_cutoff (canonical UTC or null),
scope=configured_cutoff_only and acceptance_verified=false. Status is one of
UNCONFIGURED, INVALID, CLOCK_INVALID, EXPIRED, EXPIRING (at most 24 hours remain),
or CONFIGURED_WINDOW_VALID (more than 24 hours remain). Invalid raw values and
other environment settings are not returned. Existing status errors still return
503 and public publication_enabled/adapters_verified remain false.

This permits independent deployed cutoff readback without reading secrets or
activating POD. A configured date is not provider retention, free-quota capacity,
backup/restore evidence, production permission or closure of any acceptance area.
The actual runtime storage guards remain authoritative for work admission.

The read-only operations dashboard includes an explicit Check storage cutoff
button. It works without an operations key and sends neither authorization nor
cookies. It accepts only the scoped, unverified status contract, renders known
labels/canonical cutoff through text nodes, and bounds reads to 8 KiB and the
existing 30-second deadline. Malformed/error/oversized responses show unavailable,
not readiness. Session clearing, key changes and page exit cancel pending checks.
Checking clears protected panels; no credentials are persisted or mutations sent.
