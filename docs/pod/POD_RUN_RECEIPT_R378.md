# POD run receipt R378 — reject executable worker configuration

Date: 2026-10-30 America/Los_Angeles

## Scope

This run hardened the production worker-loop boundary without enabling
production or publication. `runPodWorker` previously destructured caller-owned
options and directly accessed the abort signal and database recovery method.
Accessors or Proxy traps could therefore execute before the production database
contract protected the queue.

The worker now reads all supported options and the recovery capability through
data descriptors, rejects accessor- or Proxy-backed configuration without
invocation, validates cancellation through the native `AbortSignal` getter,
and binds the recovery method before entering the loop. Existing lifecycle,
polling, continuation, and receiver behavior is preserved. No provider adapter,
publication path, database migration, network rule, credential, paid resource,
or database administration changed.

## Regression and repair evidence

- Regression commit: `fdac55add7632ec5af6b3ef83405a85145ef927f`
- Expected-red integration run/job: `41058558006` / `124072173372`
  - 1,002 Node tests, 1,001 passed
  - the only failure was the new worker-configuration boundary regression
- Repaired branch head: `753226df0cf259ed2d611fba6f6a60911baabcdc`
- Passing integration run/job: `41058731323` / `124072758177`
  - 1,002/1,002 Node tests
  - 385 Python tests
  - one production E2E test
  - syntax/workflow validation and four free-resource guards
- Passing container run/job: `41058731344` / `124073402016`
  - image build, non-root and offline dependency checks
  - 385 Python and 1,002 Node/PostgreSQL tests
  - real print generation, durable review, and disabled hosted startup
- Content Control PR: #891
- Functional merge: `10ea4a9aa711d28e870819286bb1c0daa0f8ae54`

## Money Factory exact-head pin

- Money Factory PR: #333
- Pin branch head: `a7a5ce747acbbaffaa64c305a8120fe400639ffa`
- Cross-repository run/job: `41059616052` / `124075783935`
  - 646/646 pinned Content Control contracts
  - all nine Python verification groups passed
  - 121/121 bridge tests
  - 81/81 adapter tests
  - `PUBLICATION_ENABLED=false`
  - `POD_PUBLICATION_ENABLED=false`
- Money Factory merge: `68c8ebc7f92aa9d9a7cb1b74b333b72d06d2e0b8`
- Pinned Content Control commit:
  `10ea4a9aa711d28e870819286bb1c0daa0f8ae54`

## Render observation

The authorized free service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) detected the functional merge.

- Deploy: `dep-dbi99hrncjis73aogaeg`
- Start event: `evt-dbi99i723o6c73etf460`
- Pipeline event: `evt-dbi99i3tu7ds73c49s3g`
- End event: `evt-dbi99i3tu7ds73c49s6g`
- Result: `build_failed` before application build because free pipeline minutes
  remain exhausted.

This is deployment-attempt evidence, not live deployment acceptance. No manual
retry, plan change, purchase, replacement service, widened access, or database
administration was attempted.

## Remaining acceptance state

All 24 live-acceptance areas in `POD_COMPLETION_CHECKLIST.md` remain open.
`POD_IMPLEMENTATION_STATUS.md` remains intentionally empty. Existing code and
synthetic CI are not proof of production database migration, live provider
acceptance, financial reconciliation, measured live capacity, or controlled
launch readiness. Publication and POD publication remain disabled pending
explicit owner approval.
