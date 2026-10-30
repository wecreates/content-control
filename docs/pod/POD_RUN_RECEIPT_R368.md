# POD run receipt R368 — QA path snapshot

Date: 2026-10-29 America/Los_Angeles (2026-10-30 UTC)

## Outcome

Content Control now binds the resolver-authorized QA reference, unsigned QA output, and signed QA output paths before authority, database, artifact-storage, or reviewer callbacks can mutate task data. The bound paths are used for independent QA and signed-result verification. Executable signed-output accessors are rejected without invocation.

This is verified code and CI evidence only. It is not live acceptance, publishing approval, marketplace acceptance, revenue, or proof that the Render service deployed this commit.

## Regression-first evidence

- Regression commit: `0728fdc49d908f464dbe10a749562237c4dbfb77`
- Regression workflow: Content Control run `40996176202`, job `123869713259`
- Expected failure: 992 Node tests, 991 passed, with only `production binds QA paths before authority callbacks` failing after an authority callback redirected `qaSignedOutput`.
- Repair commits: `f5742fd77b51205ee82f7214c93b0f559d3f1f33` and `d617068839e8b64399d3116871b7bafe307f4526`

## Exact-head verification and merges

Content Control PR #869 was squash-merged as `8e94eaf8dc7c6ca366dc9fa6190e9d2f3aa61678`.

- Integration run `40996341405`, job `123870473031`: 992/992 Node contracts, 385/385 Python tests, 1/1 production E2E, 4/4 free-review guards, workflow-control verification, and server syntax verification passed.
- Container run `40996341371`, job `123870581425`: Docker build, non-root/dependency checks, Python QA/rendering, Node/PostgreSQL tests, real print/review workflow, and hosted startup with production/publication disabled all passed.

Money Factory PR #323 was squash-merged as `12c969c821dae8dc653eb97a497a89d1ba4d1786` and pins Content Control `8e94eaf8dc7c6ca366dc9fa6190e9d2f3aa61678`.

- Cross-repository run `40997105006`, job `123872666037`: 645/645 pinned contracts; Python groups 34, 23, 40, 28, 28, 93, 5, 6, and 23 all passed; 121/121 Money Factory bridge tests and 81/81 adapter tests passed.

## Render verification

The authorized Render service `content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`) remains active, unsuspended, on the free Docker plan, tracking `main` with auto deploy enabled.

Render detected `8e94eaf8dc7c6ca366dc9fa6190e9d2f3aa61678`:

- deploy started: `dep-dbi0r73ncjis73afc1eg`, event `evt-dbi0r73tu7ds73bu7neg`
- pipeline minutes exhausted before build: event `evt-dbi0r72kdidc73b6vld0`
- deploy ended failed: event `evt-dbi0r769j67c73fo6hbg`

No successful deployment of the functional commit is claimed.

## Controls and acceptance state

- `PUBLICATION_ENABLED=false`
- `POD_PUBLICATION_ENABLED=false`
- Etsy remains outside this lane.
- No marketplace publication, purchases, paid infrastructure, external messages, credential disclosure, or database administration occurred.
- The previously blocked database-administration path was not retried because no credible access-path change was present.
- The current checklist blob is `cda5ae58cc58562d686193093c4ab812939241b3`; all 24 acceptance areas remain open pending live evidence.
- The current implementation-status blob is `cce7888a8ea54ff5d4c06429371978be8a379914` and remains intentionally empty.
- The current free-deployment guide blob is `1d5b989a0c73e6d528502a613d6253ce439bd271`.

## Remaining work

Continue collecting live evidence for all 24 acceptance areas. A successful Render build/deploy and the outstanding live database, marketplace/account, regional-rights, capacity, end-to-end, reconciliation, monitoring, and controlled-launch evidence are still required. Publication remains held for explicit owner approval.
