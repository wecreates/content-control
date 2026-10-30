# POD run receipt R377 — reject executable nested runtime configuration

Date: 2026-10-30 America/Los_Angeles

## Scope

This run hardened the nested production-runtime configuration boundary without
enabling production or publication. `startProductionRuntime` already rejected
accessor- and Proxy-backed outer options, but it still read nested environment
and authority fields directly and spread the caller-owned production object.
A getter for the production enable flag, signing key, authority readiness, task
or grant resolver, or production root could therefore execute during startup
or immediately before production.

Content Control now reads supported nested environment and production fields
only through data descriptors. Invalid nested configuration is blocked without
invoking caller code. The live production off-switch is preserved through
descriptor-safe re-reads, while authority resolvers, the signing key, and the
optional production root are explicitly snapshotted and passed to
`produceOnce` without an object spread. No provider adapter, publication path,
database migration, network rule, credential, paid resource, or database
administration changed.

## Regression and repair evidence

- Regression commit: `7e1f8e413b9fa4df6a46a3bb600bcf863887ccba`
- Expected-red integration run/job: `41051518504` / `124048465935`
  - 1,001 Node tests, 1,000 passed
  - the only failure was the new nested runtime-configuration regression
- Repaired branch head: `9eb11e5fd6ac2a6bdc2f19766a14e83e62008cb3`
- Passing integration run/job: `41051709564` / `124049112526`
  - 1,001/1,001 Node tests
  - 385 Python tests
  - one production E2E test
  - syntax/workflow validation and four free-resource guards
- Passing container run/job: `41051709590` / `124049568214`
  - image build, non-root and offline dependency checks
  - 385 Python and 1,001 Node/PostgreSQL tests
  - real print generation, durable review, and disabled hosted startup
- Content Control PR: #889
- Functional merge: `aac226705c86e4a25920aba6c2253ffb2380ea17`

## Money Factory exact-head pin

- Money Factory PR: #332
- Pin branch head: `e6ff31d307aa8623c019675b9f6f45e3daf0c00f`
- Cross-repository run/job: `41052805760` / `124052774650`
  - 646/646 pinned Content Control contracts
  - all nine Python verification groups passed
  - 121/121 bridge tests
  - 81/81 adapter tests
  - `PUBLICATION_ENABLED=false`
  - `POD_PUBLICATION_ENABLED=false`
- Money Factory merge: `dbf6d5691106f652125815221798e31045b5df89`
- Pinned Content Control commit:
  `aac226705c86e4a25920aba6c2253ffb2380ea17`

## Render observation

The authorized free service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) detected the functional merge.

- Deploy: `dep-dbi8g3jncjis73anbd4g`
- Start event: `evt-dbi8g3v23o6c73espdi0`
- Pipeline event: `evt-dbi8g3qa6svs738nm0g0`
- End event: `evt-dbi8g3oq2hqs73ae0020`
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
