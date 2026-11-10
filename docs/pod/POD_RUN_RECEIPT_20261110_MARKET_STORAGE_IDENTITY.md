# Market observation database identity

Acceptance area 7 remains open. Synthetic regression cases reproduced two
false acknowledgements on Content Control `51ba2dc16a138f321dcea06917017c7835c4ea0e`:
the insert accepted any returned text ID, and a replay accepted a result without
independently matching its platform, exact source URL or observation instant.

The write now requires the UUID submitted by this operation. A conflicting
insert may acknowledge an immutable replay only if its result has the exact
platform, URL and PostgreSQL timestamp equality, in addition to existing payload
and proof comparisons. PostgreSQL checks the instant without losing microseconds
in a JavaScript Date; equivalent explicit offsets remain idempotent.

The disposable database regression alters the result after actual SQL, requires
rollback of the unverified insert, and checks a clean retry and equivalent-offset
replay. No live database access, marketplace collection, new grant, or
publication is attempted. Production acceptance and continuous worker uptime
cannot be inferred from a scheduled implementation run or a free Render rollout.
