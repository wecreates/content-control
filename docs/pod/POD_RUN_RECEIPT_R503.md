# R503: independently visible configured storage cutoff

CC began at 30f54275fcd3ab00b4e1d7faedf7f055e797cbd5 and MF at
087d981a784a05699810c4d7c4b8371b18d60069. Current completion/status/free-deployment
guides, open PRs, workflows and authorized free Render service were read.
Unrelated drafts were preserved; no duplicate POD work existed. Render was live
on dep-dbmvvslg1s2s73c2me70, with activation/publication held.

## Delivered behavior

R502 could verify provider quota metadata and apply a Render cutoff, but the
public disabled status did not expose its configured value. The public status now
includes a minimal storage_lifetime projection without reading secrets, database,
provider API or owner credentials. It is available while disabled and in sanitized
503 status failures. Missing/invalid dates and invalid clocks fail closed; expired,
final-24-hour and valid configured windows are distinct. The reported cutoff is
canonical UTC, not the raw environment value. Every report states its scope is
configured_cutoff_only and acceptance_verified=false. Publication stays false.

New tests cover date/clock/24-hour boundaries, disabled/error HTTP readback,
no auth/database/private credential access and inert environment projection.
Full local and exact-head hosted outcomes, pin and rollout evidence are retained
in the PR and final receipt update. No baseline defect reproduction is claimed:
this adds a missing operations capability rather than repairing a test failure.

## Acceptance and limits

All 24 live areas remain OPEN. This telemetry does not prove provider retention,
quota capacity, independently retained backup/recovery, current authority/rights,
marketplace adapters, measured capacity or real end-to-end acceptance. No unchanged
database-administration path was retried; no credentials or approvals were invented.
Etsy is excluded. Free existing resources only; no purchase, paid infrastructure,
social-vault access, widened network or continuous self-hosted worker claim.

## Verified implementation and live readback

Focused suites: 52/52; complete local Node: 1,204 passed, nine expected
environment skips (1,213 total); complete Python: 385/385 in 487.588s.
Syntax/whitespace checks passed. Exact local/remote tree:
`eccbd7d90a7cb683052f54a648d3452fa3eaad1d`.
CC #1128 passed integration 42269904109/job 128071452652 and container
42269903935/job 128071451610. It merged as
`ecf87e49cb32242ee7584506d2887943d5ce3133`.

Render auto-deploy `dep-dbn1oo4s728c73cu80fg` reached live on that exact merge
at 2026-11-06T18:30:02.172642Z. Fresh public /api/print/status readback returned:
storage_lifetime.status=CONFIGURED_WINDOW_VALID,
operational_cutoff=2026-12-01T00:00:00.000Z,
scope=configured_cutoff_only, acceptance_verified=false.
This closes R502's deployed-cutoff readback limitation without reading secrets.
Service, production and outbox remained DISABLED with zero cycles;
publication enabled/requested=false; adapters_verified=false.
Health alive=true/production_approved=false/publication=false; readiness
ok=false/captionReady=false. No operational acceptance is inferred.
The extension tool returned Unknown tool; available cloud browser public probes
were used. No database/admin access was attempted.

MF #458 pins the exact merge and adds pod-storage-status.test.mjs to pinned
contracts. Local bridge: 279 Node passes/one expected PostgreSQL skip, Python
81/81. Exact-head cross-repository outcome is recorded in the final receipt.

Exact-head cross-repository run 42271147876/job 128075727420 passed every
pinned contract, Python/KDP, Node/PostgreSQL and Python bridge stage.
MF #458 merged as `e73f81aa5c350f3b6ca50d2773d88f4b47b09d73`.
All 24 live acceptance areas remain OPEN, so the automation remains enabled.
No publication enablement is permitted by this automation.

## Concurrent work preserved

Before receipt publication, CC main advanced to
db8aa0feb4debf5ff9fce967417e3f1feeba850f via 874568defa5b5ca8db12c47b3fb9219a7bf2feb4
and db8aa0feb4debf5ff9fce967417e3f1feeba850f. Only qa-output/free/final-receipt.json,
qa-output/free/semantic.json and state/accepted-candidate-ledger.json changed.
Those unrelated QA/ledger updates are preserved by basing this documentation-only
receipt on the current head. They automatically started Render rollout
dep-dbn1r80l69ns73e2a0v0. The public cutoff probes above were observed on the
functional deployment, not claimed as probes of an unfinished successor rollout.
