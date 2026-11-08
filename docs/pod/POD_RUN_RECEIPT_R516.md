# R516 — require explicit commit evidence in the shared POD database bridge

Reviewed all 24 acceptance areas, deployment instructions, both current main
branches, open PRs, CI and the authorized free Render worker. Starting heads:
Content Control `993f50f1135f12629f0905da207f0a39ffa50047` and Money Factory
`e128cad02299789f343adede71329debd778e4b4`. The latter includes the R515 inbox
fix and an independent cadence update. No duplicate POD PR was open.
Render was live on `dep-dbnar0nb9u1s73cglheg` at the starting sender revision.

## Defect and verification

The shared read/write bridge previously treated a resolved PostgreSQL COMMIT as
success, even when the actual command tag was ROLLBACK. A local regression
failed before the fix. Both paths now require an own, inert `COMMIT` command tag
before returning the result. A missing, unexpected or executable tag makes the
transaction outcome unverified, so the connection is destroyed without further
SQL. Existing cancellation and confirmed-session cleanup behavior is unchanged.

The focused local run passed 272 Node tests with one disposable PostgreSQL skip.
The wider local run requires pg/Express dependencies absent from this checkout's
offline cache; it is not credited as a pass. Hosted integration/container gates
use their existing disposable PostgreSQL and test a genuine aborted transaction:
the write must be absent after the ROLLBACK tag and present exactly once after a
healthy retry. Actual hosted results and rollout readback belong in the PR.

## Acceptance boundary

No real production DB transaction, migration, paid resource, marketplace action,
network change or credential access. No credible changed DB-admin path was
identified. No live Money Factory inbox or controlled release was verified. Both
publication flags remain false and the 24 acceptance items remain open. A live
Render revision and disposable test evidence do not establish always-on operation.
