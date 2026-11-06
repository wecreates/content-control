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
