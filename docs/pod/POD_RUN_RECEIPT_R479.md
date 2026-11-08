# POD run receipt R479

Date: 2026-11-05 (UTC)

## Outcome

This run repaired the shared POD diagnostic deadline so manual operations snapshots, direct metrics, and capacity diagnostics enforce an absolute monotonic 40-second budget even when event-loop delay postpones native timer dispatch. Late success or rejection is classified as the fixed diagnostic timeout, a late-acquired client is destroyed, and no rollback is attempted after the budget is exhausted.

Publication was not enabled. Live and tested state remains `production_approved:false`, `publication:false`, and readiness fail-closed.

## Concurrent work preserved

- Initial Content Control head: `0454abb00302cf42a920b2ff9460f0dbb899a335`.
- Before publication, `main` advanced through non-overlapping evidence/state commits `b4a718c1397fc92556e6c7748b1ae36951fabab4` and `509193d3552fc294896091cfd31b86731c2df5fe`.
- The implementation commit was rebased onto `509193d3552fc294896091cfd31b86731c2df5fe`; its exact tree was re-tested before opening a PR.
- Initial Money Factory head remained `81b1df243d80f83ba0a00511e5b3a3604f627e96`.

## Changes and merges

- Content Control PR #1063, **Enforce absolute POD diagnostic deadlines**, passed and was squash-merged as `858c83a0ade49c61dba6b82fce3589e3e06f4f35`.
- Money Factory PR #434, **Pin POD verification to content-control R479**, advanced the immutable verification pin to that Content Control merge and was squash-merged as `c2732de9e267fba1822bb5b5d10dd481461f637a`.
- Etsy was not modified or included.

## Verification evidence

### Content Control

- Focused exact-rebased-tree regression: 30 passed, 0 failed.
- Full local Node POD suite before the non-overlapping evidence-only replay: 1,143 passed, 9 expected local PostgreSQL skips, 0 failed.
- Full local Python POD suite before that replay: 385 passed, 0 failed.
- GitHub Actions `POD integration gates`, run `42082953789`, job `127440498437`: success. It completed Node, Python, production E2E, syntax, workflow-control, and review-guard steps.
- GitHub Actions `POD container runtime gates`, run `42082953291`, job `127440497729`: success. It completed the image build, non-root/dependency checks, Python QA/rendering, Node/PostgreSQL, durable review workflow, and disabled-publication startup checks.

### Money Factory

- Local Node authority/bridge suite: 273 passed, 1 expected local PostgreSQL skip, 0 failed.
- Local Python adapter suite: 81 passed, 0 failed.
- GitHub Actions `POD cross-repository review verification`, run `42084293327`, job `127445136911`: success. All pinned contracts, recovery, original-art/layout, independent KDP PDF/cover, font-rights, official-template, metadata/editorial QA, Node, and Python steps completed successfully.

## Render evidence

- Authorized workspace/service: `tea-darsafojo6nc739844hg` / `srv-darsdb8u01pc73dn4i2g`.
- Service remains an unsuspended one-instance free Docker web service on branch `main`, with auto-deploy enabled and health path `/health`.
- Deploy `dep-dbmck2eq1p3s73aqtgl0` for Content Control merge `858c83a0ade49c61dba6b82fce3589e3e06f4f35` finished live successfully.
- Documentation-only evidence PR #1064 merged as `acbff58f464e86cdd11e097d9310e51d51e0ecbd`; Render event `evt-dbmco27lk1mc73ennc50` recorded it as `commit_ignored`, preserving the verified functional deployment.
- Live probe `/health`: HTTP 200, `production_approved:false`, `publication:false`.
- Live probe `/livez`: HTTP 200, `production_approved:false`, `publication:false`.
- Live probe `/readyz`: HTTP 503, `ok:false`, `production_approved:false`, `publication:false`; current QA hash remains bound.

## Acceptance state and limitations

All 24 acceptance areas remain **OPEN** because code, tests, and a live fail-closed worker are not proof of live marketplace acceptance, current account evidence, production database acceptance, independent human/platform review, financial reconciliation, measured launch capacity, or controlled-launch approval.

The previously failed database administration path was not retried: no credible connector or browser access change was present. No credential, clearance, revenue, marketplace approval, or completed acceptance was inferred. This scheduled run used only the GitHub and Render permissions actually available; it did not claim a continuously running self-hosted worker.

The completion automation remains enabled because the 24-area completion gate has not been met.
