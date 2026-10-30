# POD run receipt R367 — output path snapshot

Date: 2026-10-30 UTC

## Outcome

Content Control now binds the resolver-authorized production output directory before authority or database callbacks can mutate task data. The bound path is used for asset generation, KDP package generation, package snapshot/hash reads, durable artifact storage input, and independent QA. Executable `output` accessors are rejected without invocation.

This is verified code and CI evidence only. It is not live acceptance, publishing approval, marketplace acceptance, revenue, or proof that the Render service deployed this commit.

## Regression-first evidence

- Regression commit: `f6155829f2442a0e629c3552e32aa76efa00706c`
- Regression workflow: Content Control run `40991011912`, job `123853153543`
- Expected failure: 991 Node tests, 990 passed, with only `production binds the output path before authority callbacks` failing because a callback redirected `task.output`.
- Repair commit: `885b96ada2e9326f728df2be8345d919f0e461e5`
- Repair workflow `40991159291`, job `123853634050`, showed the new regression passing and the former accessor expectation failing closed; 991 Node tests, 990 passed.
- Contract alignment commit: `f1614ee87f62e36a9e117b0a356215c13633908e` records that executable output accessors are rejected without invocation.

## Exact-head verification and merges

Content Control PR #866 was squash-merged as `984dd5e59f48d06028fb9b11d6ff7d96a4f559e2`.

- Integration run `40991352128`, job `123854255136`: 991/991 Node contracts, 385/385 Python tests, 1/1 production E2E, 4/4 free-review guards, workflow-control verification, and server syntax verification passed.
- Container run `40991352101`, job `123854349025`: Docker build, non-root/dependency checks, Python QA/rendering, Node/PostgreSQL tests, real print/review workflow, and hosted startup with production/publication disabled all passed.

Money Factory PR #322 was squash-merged as `da9b4bd3486445fddb06e3a4fa451945ae950f94` and pins Content Control `984dd5e59f48d06028fb9b11d6ff7d96a4f559e2`.

- Cross-repository run `40992084256`, job `123856639748`: 644/644 pinned contracts; Python groups 34, 23, 40, 28, 28, 93, 5, 6, and 23 all passed; 121/121 Money Factory bridge tests and 81/81 adapter tests passed.

## Render verification

The authorized Render service `content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`) remains active, unsuspended, on the free Docker plan, tracking `main` with auto deploy enabled.

Render detected `984dd5e59f48d06028fb9b11d6ff7d96a4f559e2`:

- deploy started: `dep-dbi02bbncjis73aek540`, event `evt-dbi02be9j67c73fnkvkg`
- pipeline minutes exhausted before build: event `evt-dbi02baa6svs738hm1ig`
- deploy ended failed: event `evt-dbi02bn23o6c73emoghg`

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

Continue collecting live evidence for the 24 acceptance areas. In particular, a successful Render build/deploy and the outstanding live database, marketplace/account, regional-rights, capacity, end-to-end, reconciliation, monitoring, and controlled-launch evidence are still required. Publication remains held for explicit owner approval.
