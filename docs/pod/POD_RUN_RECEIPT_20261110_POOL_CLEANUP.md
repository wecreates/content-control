# November 10, 2026 UTC — verify POD pool cleanup before reuse

Started from Content Control main `c7f909e2048d175f7d1fcc140ff0335f94d19f24`
and Money Factory main `59269225d9e7f6c5226b4b14d2e17aac6b7ca053`. The prior
Content Control integration gate and Money Factory cross-repository gate passed.
The authorized free Render worker was live at the Content Control revision
(`dep-dbp8o53bc2fs73b9imc0`), with no overlapping POD PR.

Two regressions reproduced unsafe reuse in managed reads/writes: a resolved
SELECT response in place of ROLLBACK reached another cleanup statement, and a
SELECT response in place of DISCARD ALL returned an unclean client to the pool.
Managed transactions now require exact ROLLBACK before issuing further cleanup,
and exact DISCARD (the node-postgres command value) before pooled reuse. The
read-only archive, capacity, and operational diagnostics also require exact
ROLLBACK. Cleanup faults do not replace the original operation error or cause
a known committed operation to be retried.

The disposable PostgreSQL test verifies the actual driver tags, substituted
SELECT responses, destruction of uncertain clients, and no leaked session
configuration on a healthy subsequent connection. Hosted gate and rollout
evidence are recorded on the PR. No production database retry, migration,
backup, account access, marketplace operation, or activation was performed.
Both publication flags stay false. All 24 live acceptance areas remain open;
the free service and scheduled checks do not establish an always-on worker.
