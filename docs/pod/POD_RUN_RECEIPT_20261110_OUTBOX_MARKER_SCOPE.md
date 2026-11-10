# POD outbox receipt: mark only the observation that was sent

Content Control base `fcacb24a13c9f8f92c4f6827e6796d96a2920b91` marked a
pending sender row delivered by ID alone after an acknowledgement. The
local regression demonstrated that a same-ID replacement payload could
receive the delivery marker even though the receiver acknowledged the old
payload. The marker now conditionally updates only a still-pending row with
the exact job, event kind, signed JSONB payload and selected PostgreSQL
timestamp. The timestamp comparison retains sub-millisecond precision. A
nonmatching row stays pending and counts as a failure. No automatic repair,
new event ID or change to the signed wire format is introduced.

The hosted PostgreSQL test changes one field at a time in a disposable
fixture during delivery (including a one-microsecond timestamp change).
It checks that the new content stays pending and that restoring the original
fixture permits delivery. The pull request records exact test and deployment
results. The related receiver-side repair in
[Money Factory #494](https://github.com/wecreates/Money-factory/pull/494)
also verifies stored content rather than trusting only its digest.

These tests are not evidence of production data corruption, a live authority,
financial reconciliation, or completed end-to-end acceptance. All 24 live
acceptance areas remain open. Both publication flags remain held off.
