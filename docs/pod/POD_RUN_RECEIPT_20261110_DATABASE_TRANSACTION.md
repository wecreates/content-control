# November 10, 2026 UTC — require transaction evidence in database deployment

Starting Content Control main was `4679e07f02646635437afc48ea99093583f061fc`
and Money Factory main was `d38f5b0b906ddd741d3d2ceaa445f2fa8ef71391`.
The authorized free Render worker was live on the Content Control revision
as deployment `dep-dbp8e0142hec73d7nuf0`. The latest POD gates passed and no
overlapping PR was open.

The protected owner migration and read-only preflight used their own
transactions. Five local regressions reproduced successful or reusable
outcomes after a mismatched BEGIN, COMMIT, or ROLLBACK response. In particular,
a resolved COMMIT may carry PostgreSQL's ROLLBACK tag; a later runtime
inspection of an existing schema cannot prove the requested apply succeeded.

Migration now verifies exact BEGIN before owner SQL and exact COMMIT before
runtime inspection. Preflight verifies exact BEGIN before querying and exact
ROLLBACK before reporting a readable database or reusing its client.
Both discard uncertain clients; migration preserves its original error when
rollback is unverified. The hosted fixture substitutes real SELECT results
and a real ROLLBACK tag on disposable PostgreSQL and verifies that no fixture
runtime role persists. Local dependency-free POD tests passed 1,207 cases
with two expected PostgreSQL skips. Hosted results and rollout are recorded
in the PR.

No authorized production database administration route changed, so the
previous connector/browser attempts were not repeated. No live migration,
provisioning, production backup, or marketplace action was performed.
Both publication flags remain false; all 24 live acceptance areas remain open.
This scheduled execution is not evidence of a continuously running worker.
