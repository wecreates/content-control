# R514 — verify the financial ledger write before acknowledgement

Checked all 24 acceptance areas, current implementation and deployment docs,
open pull requests, hosted workflows and the authorized free Render service.
Content Control main: 89a53122e533ab71bf9eb2d28ac8d474f754a0a3.
Money Factory main: 7d2d3e69844cf98715660f34a3d61bad0bdf35fc.
No duplicate POD PR or workflow was active. Concurrent watchdog, QA and
rollback-ledger updates remain intact.

## Reproduction and repair

Three baseline regressions reproduced a financial insert acknowledging an
unverified RETURNING result, an exact replay accepting a coercible amount, and a
signed array currency reaching the transaction. The ledger insert now requires
one inert returned ID equal to the UUID supplied for the write, before its audit
event can be created. Replays compare exact scalar amounts (native safe number
or PostgreSQL integer text), require an inert valid ID, and never invoke amount
conversion. Signed currency must be primitive three-letter text. Exact replay,
occurrence precision, authenticated evidence, and transaction/expiry guards are
unchanged. These are adapter fixtures, not actual royalties or statements.

Local: 49 focused tests passed; full Node POD suite 1,246 passed and nine expected
disposable-database skips. Python was not run locally for this JS-only repair.
The exact-head hosted integration and container gate results, merge, consumer
pin and rollout readback are linked from the implementation pull request.

## Live acceptance limits

No production DB/admin retry: no credible changed access path was found. No
new credentials, paid resources, marketplace traffic or financial facts were
created. Both publication switches remain false. Existing provider statements
and live authorized Money Factory ledger reconciliation were not available; all
24 live acceptance areas remain open. Deployment liveness, code and synthetic
tests do not establish live acceptance or a continuously running worker.
