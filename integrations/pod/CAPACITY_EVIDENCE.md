# Production activity and capacity evidence

Authenticated `GET /api/print/capacity` observes dedicated POD history in one
read-only, repeatable-read transaction. The database establishes a rolling
24-hour window; future and older events are excluded. Request callers cannot
change its window, run generation or select another database. Diagnostics remain
available near storage expiry while ordinary production writes remain blocked.

Counts are decimal strings so large values do not lose integer precision:

| Field | Meaning |
|---|---|
| registered_concept_records | Concept rows registered during the window, including blocked concepts |
| generated_concept_records | Distinct concept IDs with a recorded generation completion |
| generated_jobs | Distinct queue jobs with a recorded generation completion; variants and revisions remain separate jobs |
| generated_package_hashes | Distinct package hashes in those generation events |
| jobs_with_pass_event | Distinct jobs with a QA pass event during the window |
| jobs_with_fail_event | Distinct jobs with a QA fail event during the window |

Generation completions use `pod.production.review_required` plus direct worker
`pod.production.qa_passed`/`pod.production.qa_failed` events with a fencing token.
The later manual review pass event has no fencing token and does not count as a
new generation. Only valid package hashes on supported POD platform jobs count.
Duplicate events cannot inflate distinct counts. A failed QA output can count as
a generated package; a job may appear in both pass and fail history. Current
queue state, concept tombstones and permissions still control actual readiness.

This reports retained event history, not proven unique artwork or an always-on
measurement interval. The same artwork in several concept records may still
inflate concept counts; byte-distinct packages do not establish originality.
Missing, deleted or pre-instrumentation history cannot be reconstructed. The
response contains aggregates only, not job/account IDs, artwork hashes or payloads.

The 100 and 1,000 unique-concept/day targets are displayed as targets. Neither
target is auto-approved from these counts: `capacity_verified`,
`acceptance_verified` and `publication_enabled` always remain false. No fixture
data, forecast or 24-hour extrapolation is a completed capacity acceptance.

For live acceptance, retain attributable start/end observations from the actual
deployment across a complete day, with independent evidence of unique concepts,
QA outcomes, active worker/resource measurements and durable recovery. Separately
demonstrate the 1,000/day target under the same quality and budget constraints.
Keep variation/job counts distinct and publication disabled pending approval.
This endpoint creates no jobs, accounts, synthetic revenue, clearances or release
authorization. Live measurement and all dependent acceptance remain open.

## Read-only operations dashboard

The existing authenticated dashboard loads `/capacity` alongside metrics and jobs.
It displays only the six defined aggregate counts and the database's UTC window,
without converting decimal strings to JavaScript numbers. Targets and limitations
stay visible even when the endpoint is unavailable. Invalid schema, window, counts
or claims of capacity/acceptance/publication approval reject the activity panel.
Independent endpoint failures preserve other successfully loaded panels. Refresh,
key changes, session clearing and page exit invalidate pending responses and clear
activity, just as they clear job previews. No credentials are persisted and no
mutation or approval control is added. Automated DOM tests are not owner-phone or
production acceptance; those checks remain open.
