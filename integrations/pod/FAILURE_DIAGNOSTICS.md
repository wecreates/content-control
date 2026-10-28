# Production failure diagnostics

`produceOnce` returns `status: BLOCKED` with a fixed `reason_code`. The queue stores
that code through the existing fenced, lease-checked failure transaction. Only
the allowlist in `failure-reasons.mjs` is accepted; unknown errors become
`PRODUCTION_BLOCKED`. Credentials, URLs, paths, child output and dependency
messages are never copied into that reason or result.

The existing worker health snapshot and error callback retain the same sanitized
reason. An authenticated QA_FAILED result increments consecutive failures instead
of clearing the incident as a successful cycle. REVIEW_REQUIRED and IDLE retain
their non-error semantics. This does not configure external alert destinations.

For nonzero Python exits, the process adapter may read one bounded JSON object
with `status: BLOCKED` and an allowlisted `reason_code`. Its Error message remains
`PYTHON_STAGE_FAILED`, preserving signed-QA-FAIL handling. Timeout, cancellation,
spawn failure and output exhaustion take precedence over child diagnostics.
Stdout and stderr share one byte limit; stderr is counted and discarded.

| Reason family | Required follow-up before retry |
| --- | --- |
| Grant/signature/permission/expiry | Obtain current scoped upstream evidence; respect revocation and readiness limits |
| Template provenance/scope | Correct the authorized product/country/template input with actual evidence |
| Task media type | Re-upload the exact role input with its required bounded media type and issue a newly reviewed hash-bound descriptor |
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

The retry route authenticates the current grant before inspecting its target,
then requires the requested job identity and signed `job_id` to be the same
bounded, nonblank, NUL-free, exact UTF-8 text. A wrong or malformed target fails
before database connection acquisition, so a valid grant for one job cannot be
used to select or lock another job while waiting for the later brief check. This
binding does not make the job repairable; queue state, retry budget, current
rights and the complete signed brief are still enforced transactionally.

Authenticated package retrieval and signed review acceptance also reject job
route identities outside the existing 1–100 character ASCII letter, digit,
underscore and hyphen contract before acquiring PostgreSQL. Review acceptance
still authenticates its QA envelope first, so target validation cannot mask a
bad signature. These admission checks prevent out-of-contract route values from
reaching database parameter binding; they do not prove that a package exists or
that a review is authorized for its stored bytes.

After locking the current review hold and rights row, signed review acceptance
also validates the complete stored package against the latest durable
`pod.production.review_required` manifest identity before any queue or event
write. A missing event, mismatched identity, malformed package, marketplace
mismatch or publication-enabled claim therefore cannot become `qa_passed`, even
when the QA envelope itself is authentic and names the package hash. This binds
acceptance to the same retrievable package contract as owner review; it does not
substitute for an authorized, calibrated independent reviewer.

The two durable package-write boundaries now enforce that same bounded manifest
shape, a supported non-Etsy marketplace, an exact marketplace match, a complete
marketplace file set, a valid template identity and
`publication_enabled=false` before acquiring PostgreSQL. A caller therefore
cannot create an unreadable review hold or QA result and rely on later read or
release checks to contain it. This validates package structure and provenance
identity only; it does not establish live rights, editorial quality, account
authorization or marketplace acceptance.

These diagnostics support monitoring and failure-specific repair implementations.
Actual remediation outcomes, production alerts and all live acceptance checks
still require attributable operational evidence.


## Stage process-tree cleanup

The supported Render/Linux stage runner starts each trusted Python stage in its own
POSIX process group. Cancellation, timeout and output exhaustion signal the group,
then escalate ignored SIGTERM to SIGKILL. On direct-child exit it also kills any
remaining group members before settling and allowing workspace cleanup. A nominally
successful parent that leaves helpers running fails with
PYTHON_STAGE_DESCENDANTS_REMAIN rather than reporting successful production.
The direct child is reaped; orphan zombies may briefly await the container's PID 1,
but cannot execute or hold file descriptors. Windows fails closed with
PYTHON_STAGE_PLATFORM_UNSUPPORTED because this runner has no Windows job-object
implementation. Unexpected group-signaling errors have the fixed
PYTHON_STAGE_TERMINATION_FAILED code.

This handles ordinary inherited OCR/render subprocesses. It is not a sandbox for
hostile executables that deliberately create new sessions/process groups; keep stage
scripts and executable configuration controlled. No untrusted executable input,
extra host permission, container privilege or external service is introduced.
