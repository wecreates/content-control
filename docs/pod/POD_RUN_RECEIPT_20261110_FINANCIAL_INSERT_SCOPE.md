# Verify a new POD financial statement and its audit linkage

On Content Control base `71b03bc940ad9ca563410350fda82029aab4bf96`, the
financial insert checked the returned ID but did not check the rest of the
written statement. The paired outbox insert checked ID, job and kind, but
not its linkage payload. The focused regression reproduced a false successful
receipt when the expected identity was returned with different content.

The new checks require PostgreSQL to confirm exact inserted statement fields
and exact JSONB audit linkage in the same transaction. An absent, mismatched or
non-boolean comparison cannot authorize a receipt. The hosted disposable test
uses scoped test-only triggers to change an amount, shift an occurrence time
by one microsecond, or change the audit payload without changing IDs. It checks
that neither record commits and that an unmodified retry records one statement
and one linked audit event. Exact CI and deployment outcomes are tracked in the
pull request.

This does not create an authority or verify any provider statement, income or
live financial reconciliation. No production database access was attempted;
no changed authorized administration path was established. Both publication
flags remain off, and all 24 live acceptance areas remain open.
