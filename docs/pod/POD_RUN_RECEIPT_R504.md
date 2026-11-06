# R504: key-free read-only storage check in operations dashboard

CC began at 2116b990e0b24688bbc5f80cb1a896ee7a994c0e; MF at
e73f81aa5c350f3b6ca50d2773d88f4b47b09d73. Current checklist/status/free-deployment
guides, open PRs, workflows and authorized Render service were inspected. Existing
free service was live on db8aa0feb4debf5ff9fce967417e3f1feeba850f, deploy
dep-dbn1r80l69ns73e2a0v0. Narration Transcription Gate failures are outside this
POD lane; no unrelated failure guard or draft was changed. No duplicate POD job
or PR was found.

## Delivered behavior

The configured cutoff was visible in the public JSON API but not the operations
page. The dashboard now has an explicit Check storage cutoff control needing no
operations key. It uses only the existing public GET status endpoint, omits
authorization/cookies, bounds response bytes to 8 KiB and reuses the 30-second
request deadline. Only known labels, scoped unverified evidence and a canonical
UTC cutoff are rendered as text. Malformed/approval-claiming/error responses show
unavailable. A valid configured window is explicitly not storage acceptance.

Checking clears protected panels; session clearing/key change/page exit abort
pending checks and prevent late repaint. Preview and protected operations retain
their existing authentication and limits. There is no activation/publication
button, mutation, credential persistence, database access or provider access.

Tests cover key-free credentialless fetch, scope/date/status validation, warning
states, hostile markup, response-size and error redaction, stale session repaint,
and stalled headers/bodies. Exact local/hosted/rollout results are recorded in the
PR and final receipt update. This is new operations capability, not a claimed
baseline-red defect.

## Limits

All 24 live acceptance areas remain OPEN, including actual owner-phone acceptance.
Automated browser/fixture evidence is not the owner's mobile acceptance or proof
of retention/recovery, real grants/rights/QA/adapters/capacity/end-to-end jobs.
The failed database-administration path has not changed and was not retried.
Etsy is excluded; both publication flags remain false. No paid resource, purchase,
secret disclosure, social-vault access, widened network or continuous worker claim.
