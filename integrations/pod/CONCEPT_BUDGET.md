# Daily concept admission budget

The intake limit is a per-business UTC-day admission cap, from 1 to 1,000
new fingerprint records, defaulting to 100. It is not proof of generated
unique artwork or daily production capacity. Product variants remain queue
jobs; they do not consume a new concept admission unless they introduce a
new fingerprint.

Fingerprint deduplication runs first under its existing transaction lock.
Existing concepts return their canonical identity without another budget
charge. New adverse rights evidence still tombstones duplicates and emits
the denial event; later PASS does not revive them.

For new records, registration acquires a business budget advisory lock,
then reads the database's wall-clock UTC date in a separate statement.
The insert and increment both use that explicit date. The concept creation
timestamp also uses database wall time. After writes, a second UTC-date
check rejects a changed day and rolls back the concept and budget together.
The final signed-intake expiry check remains mandatory. Budget exhaustion,
missing clock data, lock timeout or date change never commits partial work.

A day-change rejection may be retried as a new intake transaction with current
signed authority; it does not justify bypassing the cap, changing a fingerprint,
extending a grant or silently treating the previous attempt as successful.
This defines admission at registration, not at eventual job production or
the wall-clock instant of transaction commit. All writers should use this
transactional intake path. No migration or historical timestamp rewrite is
performed.

Tests distinguish controlled rollover-clock fixtures from actual PostgreSQL
concurrency and advisory-lock waits. Neither is a live 100/1,000-per-day
capacity measurement. Publication remains disabled.


## Exact fingerprint text admission

Signed intake fingerprints must be primitive, nonblank strings before any
transaction or lock is acquired. Numbers, booleans, arrays and objects are
rejected with INTAKE_SCOPE_INVALID rather than passed to PostgreSQL text
parameters. The original envelope is authenticated before this shape check.
Valid opaque strings retain their exact text, including leading/trailing spaces
and Unicode; the consumer does not trim, normalize or derive a replacement.

This prevents driver coercion from selecting an existing text fingerprint and
returning or tombstoning its concept under a differently typed signed value.
Exact-string deduplication, adverse-rights tombstones and unique-concept budget
rules remain unchanged. Disposable PostgreSQL fixtures check numeric/array text
aliases, unchanged rights, exact replay and budget counts. They do not establish
authentic concept identity, actual regional clearance, market demand or measured
production capacity. Publication remains disabled.
