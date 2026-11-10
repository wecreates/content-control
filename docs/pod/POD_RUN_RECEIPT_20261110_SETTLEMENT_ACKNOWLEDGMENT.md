# POD settlement acknowledgment — November 10, 2026

Confirmed on the preceding main: a rejected hold/QA acknowledgment entered the
general failure handler, and malformed QA receipts could report success through
truthiness or invoke executable fields. Nine focused cases failed before repair.

Settlement now requires the final synchronous guard and the exact inert return
contract. After that guard succeeds, any rejected acknowledgment is uncertain,
including a falsy rejection. Cleanup is awaited but no second failure settlement
is attempted. Pre-write authorization/stop rejection still uses the existing
fenced failure path. Unknown outcomes require durable inspection/lease recovery,
not blind retry.

The PostgreSQL E2E includes a genuinely committed review hold followed by a lost
adapter acknowledgment and verifies exactly one retained hold event and zero
secondary failure calls. Synthetic stages test the QA return boundary separately.
CI results, merge and deployment evidence are linked from this change's PR.

No live database/authority or marketplace is exercised. All 24 live acceptance
areas remain open; both publication flags must remain false. Local execution has
no PostgreSQL service and cannot substitute for the hosted disposable DB test.
