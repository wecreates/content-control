# November 10, 2026 UTC — require archive snapshot transaction evidence

Follow-up to the managed transaction-start repair. The direct artifact and state
exporters used their own repeatable-read transactions. Both could seal a
catalog after an unexpected but resolved BEGIN or COMMIT result. Four
regressions reproduced those false successes on the prior implementation.

Both exporters now require exact inert BEGIN and COMMIT tags. Unverified
BEGIN stops before session setup or reads; unverified COMMIT prevents the
final catalog from being sealed. The connection is discarded without sending
additional SQL. Partial encrypted objects, if any, remain non-restorable
without a catalog. Existing offline verification and storage limits are
unchanged. The managed restore paths already use the guarded write helper.

Local archive suite: 133 passed. The broader dependency-free POD suite passed
1,201 tests with two expected PostgreSQL skips. The hosted disposable test also
checks actual SELECT and ROLLBACK tags, lack of a catalog in both failure
cases, and a healthy subsequent export and restore. Hosted results are recorded
in the pull request; these tests do not establish production backup or recovery.

No production database access, marketplace calls or paid resources. Publication
switches remain false; all 24 live acceptance areas remain open.
