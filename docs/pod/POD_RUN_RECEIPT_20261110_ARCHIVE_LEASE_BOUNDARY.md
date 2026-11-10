# POD archive lease-boundary repair — November 10, 2026

Scope: manual artifact and state export, and recovery of stored worker leases.
Base: Content Control `3607b6a28ab1af0928b3c8a03fec4eb1df367e01`.

- Both exporters could seal their catalog and return `EXPORTED` even when the
  source database client release rejected or was still pending. A synchronous
  release error could mask the original query failure. Eight focused cases
  reproduced the old behavior. Export now finishes release under its existing
  deadline before sealing a catalog, consumes late rejections, and closes the
  directory without masking the primary failure.
- The previous runtime repair distinguishes missing/non-finite leases from
  ordinary expiry. State restore previously rewrote both as routine recovery
  outcomes. Restore now preserves the original unverified deadline, applies a
  distinct quarantine reason, fences the prior owner and keeps the attempt count.
  Finite leases retain the previous restore behavior. SQL proves the affected
  count and returned state, reason, deadline, attempt and fence before commit.

Verification uses local fixture and existing disposable PostgreSQL workflows.
No production database administration was retried; no verified changed access
path was available. No live archive or separate retention resource was created.
Both publication flags remain off. The 24 live acceptance areas remain open.
