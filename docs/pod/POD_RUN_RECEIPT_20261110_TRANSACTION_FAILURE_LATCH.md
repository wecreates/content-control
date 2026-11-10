# POD transaction completion — November 10, 2026

The managed write helper recorded a rejected query's value as its failure
sentinel. A callback that consumed a rejection with an undefined, null or
other falsy reason could still cause the helper to commit earlier writes.
The helper now records the first rejection independently of its value and
uses a fixed failure code when the original rejection has no useful value.

The managed read helper returned evidence without rechecking the storage cutoff
after commit and session cleanup. It also did not await asynchronous client
release. Read completion now requires release to settle and rechecks cancellation
and storage lifetime before returning the rows; it keeps the primary query error
if cleanup fails. This does not change committed-write acknowledgment semantics.

The focused regression reproduced all six failing cases before the repair.
The disposable PostgreSQL regression forwards a real insert but rejects the
next query in the client adapter. The transaction must roll back the insert
and the healthy retry must persist exactly one row. No production database,
authority or marketplace was exercised, and neither publication flag changed.
