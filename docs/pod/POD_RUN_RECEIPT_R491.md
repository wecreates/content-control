# POD run receipt R491

Date: 2026-11-06 UTC

## Scope and result

This scheduled run continued the Amazon KDP/POD lane across `wecreates/content-control` and `wecreates/Money-factory`. Etsy remained excluded. The run repaired one unblocked Python-stage cancellation/resource-safety defect, merged the exact passing implementation and consumer pin, and verified the free Render deployment. This is implementation and verification evidence, not live acceptance: all 24 acceptance areas remain **OPEN**.

`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remained mandatory throughout. The run did not enable publication, spend money, contact a third party, access a social vault, widen network access, or claim marketplace approval, revenue, credentials, or clearance.

## Reconciled starting heads and concurrent work

- Content Control: `f89d70ff4214ab09c6108610e05e4e6b8032679a`
- Money Factory: `b6cdfe812dd08afda88e27a17bb0ee2071b80998`
- Current open pull requests were inspected before creating work. None duplicated R491; unrelated work was preserved and Etsy PRs remained excluded.
- Scratch worktrees removed by workspace maintenance were not treated as user deletion. Fresh clean clones were made from the exact current remote heads before editing.

## Defect and repair

`integrations/pod/python-stage.mjs` launched the Python QA/render child process before its abort listener was registered. If listener registration threw, process work had already started without cancellation control while the caller received a raw private setup failure. A signal that aborted synchronously during registration could also start process work, and a throwing listener-removal hook could strand otherwise settled success or failure.

The pre-repair focused regression failed by exposing `private listener failure` instead of the fixed `PYTHON_STAGE_ABORTED` error after process launch had already been admitted. The repair:

- establishes abort-listener control before spawning the Python process;
- rejects with fixed `PYTHON_STAGE_ABORTED` without launching work if listener setup fails;
- prevents process work after synchronous cancellation during registration;
- treats an inaccessible post-registration abort state as cancellation;
- makes listener removal best-effort so cleanup failure cannot strand settlement;
- preserves process-group termination, output bounds, monotonic deadlines and descendant cleanup.

Three regression tests cover failed registration, synchronous cancellation and throwing cleanup.

## Content Control verification and merge

Local evidence:

- focused Python-stage, production, QA and worker suite: 153 passed, 0 failed;
- complete Node POD workflow suite: 1,170 tests; 1,161 passed, 9 expected skips, 0 failed;
- complete Python POD workflow suite: 385 passed, 0 failed;
- `git diff --check`: passed.

PR [#1096](https://github.com/wecreates/content-control/pull/1096) used immutable head `af3d0f436969b10a27da7ac20c9361ac5dab2628` and passed:

- POD integration gates: run `42174463978`, job `127749608491`;
- POD container runtime gates: run `42174463958`, job `127749608193`.

It merged as `ad9a22a1f210eab376a714117cf84e80126ebecc`.

## Free Render deployment

Authorized workspace/service:

- workspace `tea-darsafojo6nc739844hg`;
- service `srv-darsdb8u01pc73dn4i2g` (`content-control-render-worker`);
- free Docker web service, `main`, commit-triggered auto-deploy, not suspended.

Exact functional merge `ad9a22a1f210eab376a714117cf84e80126ebecc` deployed as `dep-dbmn9lnavr4c738umnr0`. Build-started event `evt-dbmn9m47j7js73bdg8pg`, successful build-ended event `evt-dbmn9t1uqbhc73b0v82g`, deploy-started event `evt-dbmn9lpuqbhc73b0v3kg`, and successful deploy-ended event `evt-dbmna7tfbbac73bgae60` all bind the exact merge. Fresh public probes showed:

- `/health`: alive; `production_approved=false`; `publication=false`;
- `/livez`: alive; `production_approved=false`; `publication=false`;
- `/readyz`: `ok=false` as required for a held launch, `qaStatus=GREEN`, `hashBound=true`, and exact expected/actual SHA-256 `54f37c847c79e632e26648a3f31f11f24266d316217dd71025187b1924c1b127`; `captionReady=false`; `renderStatus=v2-validation-complete`.

The live health response is deployment evidence only. It does not establish marketplace acceptance or any of the 24 live acceptance areas.

## Money Factory authority pin

The Money Factory workflow now pins Content Control functional merge `ad9a22a1f210eab376a714117cf84e80126ebecc`.

Local bridge evidence:

- Node: 279 tests; 278 passed, 1 expected skip, 0 failed;
- Python: 81 passed, 0 failed;
- `git diff --check`: passed;
- publication flags remained false.

PR [#446](https://github.com/wecreates/Money-factory/pull/446) used immutable head `1c684b9d3d467142fdb4c2b2d0566c0c4b48d474`. Cross-repository run `42175351450`, job `127752431450`, passed and the PR merged as `3bf66d8ec5a5ee5e9b898941e2284ddc6c7ab4a7`.

## Database administration and execution limits

The prior database administration attempts through the connector/browser had failed. No credible changed database administration access path appeared in R491, so the run did not repeat the same failed action. The code and tests above are not a substitute for live database provisioning, backup/restore evidence, account verification, platform preview, or controlled launch acceptance.

This receipt describes one bounded scheduled execution with the tools and permissions actually available to it. It does not claim a continuously running self-hosted worker.

## Acceptance status

All 24 acceptance areas in `POD_COMPLETION_CHECKLIST.md` remain **OPEN**. In particular, live dedicated database/durable recovery, current external grants and account records, authorized marketplace intelligence, regional-rights evidence, official-template provenance, independent human/platform QA and remediation, authorized platform-account adapters, live economics/reconciliation, measured capacity, end-to-end live acceptance, and controlled launch readiness still require real evidence. Publication remains held for explicit owner approval, and this automation cannot enable it.

The continuation automation therefore remains enabled.

## Receipt deployment suppression

Pending verification after this receipt is merged with `[skip render]`.
