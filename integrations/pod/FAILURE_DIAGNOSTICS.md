# Production failure diagnostics

`produceOnce` returns `status: BLOCKED` with a fixed `reason_code`. The queue stores
that code through the existing fenced, lease-checked failure transaction. Only
the allowlist in `failure-reasons.mjs` is accepted; unknown errors become
`PRODUCTION_BLOCKED`. Credentials, URLs, paths, child output and dependency
messages are never copied into that reason or result.

For nonzero Python exits, the process adapter may read one bounded JSON object
with `status: BLOCKED` and an allowlisted `reason_code`. Its Error message remains
`PYTHON_STAGE_FAILED`, preserving signed-QA-FAIL handling. Timeout, cancellation,
spawn failure and output exhaustion take precedence over child diagnostics.
Stdout and stderr share one byte limit; stderr is counted and discarded.

| Reason family | Required follow-up before retry |
| --- | --- |
| Grant/signature/permission/expiry | Obtain current scoped upstream evidence; respect revocation and readiness limits |
| Template provenance/scope | Correct the authorized product/country/template input with actual evidence |
| Native resolution/font/text layout | Supply corrected original input and re-run the full independent QA gate |
| Python timeout/output/spawn | Repair the execution dependency or bounded input; retain failure status |
| Artifact budget/storage expiry | Restore verified capacity/lifetime through the approved infrastructure path |
| QA_FAILED | Inspect authenticated QA checks and correct the failed product; a technical failure is not a review hold |

`requeueRepair` retains the prior sanitized reason in `pod.repair.archived` and
clears it from the new raw attempt. Current upstream authority, valid rights and
the existing three-attempt bound remain mandatory. A signed QA failure sets
`QA_FAILED`; a successful authenticated QA clears the old reason. External review
acceptance remains restricted to `REVIEW_REQUIRED` jobs. No automatic image
upscaling, renewed approval, publication or additional retry is granted here.

These diagnostics support monitoring and failure-specific repair implementations.
Actual remediation outcomes, production alerts and all live acceptance checks
still require attributable operational evidence.
