# POD run receipt R406 — verified adverse-intake revocation mutations

Date: 2026-10-31 UTC

## Scope and starting state

This scheduled run resumed from Content Control
`375c94e47a744709d7d8be4b93eb2657e93ef2cb` and Money Factory
`4e9257fed160d48726ebd1dce32dc718d920a26e`. Fresh repository heads, open
pull requests, workflow results and the authorized Render service were inspected
before implementation. No open POD/KDP pull request or duplicate R406 job existed.
The pre-existing dirty checkout was preserved; implementation and receipt work used
isolated clean worktrees.

The completion checklist still leaves all 24 live acceptance areas open. There was
no credible changed database-administration access path, so the previously failed
connector/browser route was not retried. This run did not access social-vault,
contact a marketplace, create a paid resource, include Etsy, widen network access,
or enable production or publication.

## Confirmed defect and expected-red evidence

Duplicate intake correctly treated newly adverse rights evidence as a permanent
concept tombstone, but trusted both the concept update and audit insert without
verifying either database result. A missing, malformed, accessor-backed or
Proxy-backed driver response could therefore let `registerIntake` report success
without exact durable proof of the rights revocation and its audit event.

The regression added to `tests/pod-intake-revocation.test.mjs` failed before the
repair with `Missing expected rejection`. The existing implementation accepted an
unverified mutation receipt instead of throwing `POD_MUTATION_UNVERIFIED`.

## Implementation

Content Control PR #947 changed only `pod-db-bridge.js` and two focused tests:

- the duplicate-concept rights update now uses `RETURNING
  id,rights_state,permanently_unpublished` and must exactly match the intended
  concept, adverse state and permanent tombstone;
- the `pod.concept.rights_blocked` insert now uses `RETURNING id,kind` and must
  exactly match the generated event identity and fixed event kind;
- both checks use the existing inert, descriptor-based mutation verifier, so
  accessors, Proxies, missing rows, extra fields and mismatched identities fail
  closed without being invoked;
- authority-expiry fixtures now model the exact PostgreSQL result contract.

The transaction already rolls back both mutations when either proof fails. No
publication path, adapter, marketplace credential or activation setting changed.

## Verification

Local evidence on the repaired tree:

- focused intake, authority-expiry, concept-budget and evidence-time suites: 42/42
  passed;
- full `npm run test:pod`: 1,049 tests, 1,040 passed, 9 PostgreSQL-only skips, 0
  failures;
- `node --check pod-db-bridge.js` and `git diff --check` passed;
- the local Python command ran 266 tests, but two suites could not import because
  this scheduled runner lacks `cv2`. That run is not counted as a Python pass.

Exact PR head `51f1119752ef9feeb76f32a43299589938761509` passed both hosted gates:

- integration run `41221912303`, job `124598057205`: all 1,049
  Node/PostgreSQL tests, all 385 Python/OpenCV tests, stored production E2E,
  syntax, workflow-control and review-guard stages passed;
- container run `41221912194`, job `124598056999`: the production image built,
  non-root/dependency probes passed, all 385 Python tests and all 1,049
  Node/PostgreSQL tests passed, print/review E2E passed, and startup smoke recorded
  `publication_enabled=false`, `production_status=DISABLED` and
  `outbox_status=DISABLED`.

PR #947 merged as `c42c11567b1e761cbb89789009a53ee3d6b9f2fa`.

## Money Factory pin

Money Factory PR #361 changed only `.github/workflows/pod-production.yml`, pinning
Content Control merge `c42c11567b1e761cbb89789009a53ee3d6b9f2fa` while keeping
`PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` literal `false`.

Exact pin head `0ad2d2c231d06ad289b61c7037aa705f86c1c9bb` passed cross-repository
run `41222524697`, job `124599869777`: 682 pinned Node contracts; Python groups
of 34, 23, 40, 28, 28, 93, 5, 6 and 23 tests; 121 bridge Node tests; and 81
bridge Python tests. PR #361 merged as
`71f05acc01ec9d5ab388fe1ec586c1a88a070eb1`.

## Hosted observation and remaining acceptance

Render auto-deploy detected the functional merge and created deploy
`dep-dbj1tujncjis73d4i7mg`. Event `evt-dbj1tup7h2ec73dhs1cg` reported exhausted
pipeline minutes, followed by failed deploy event `evt-dbj1tup2tl4s73e7ig10`.
The attempt ended before build or startup, so it is not live acceptance. No manual
retry was triggered because auto-deploy is enabled and the unchanged free quota is
the limiting condition.

This repair is code and hosted-test evidence only. It does not establish a live
database mutation, marketplace authorization, real submission, revenue or any of
the 24 live acceptance areas. Both publication flags remain false. The completion
automation remains enabled because all 24 areas are still open.
