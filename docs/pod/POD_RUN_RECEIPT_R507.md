# R507: fail diagnostics when client release is unverified

Current CC main9122e69f893af87cf23f7df34e92b441891505be and MF
main0f4fd6397861924f69c95adaaca5134667afd807, current acceptance/status/free
deployment guides, open PRs and workflows were reconciled. No duplicate POD work
was open; latest POD gates passed. Unrelated MF monitor/browser failures are not
POD acceptance and were not weakened or reported passed. Concurrent work remains.

Authorized existing free Docker/main Render service is unsuspended, one instance,
automatic commit deployment, /health. Latest functional3900103fc3642ef0fa0cb5058eaa9ffc75f7df4d
is live as dep-dbn4d3gae00c739lf1og. No settings or credentials were changed.

## Confirmed defect and repair

Metrics previously ignored the promise returned by client.release. An asynchronous
release rejection or stall could therefore return successful metrics; a rejected
late-client destruction could be unhandled. Six new cases yielded27 pass/4 fail
against baseline (31 total), safely consuming fixture rejections to avoid process
noise. The four failures reproduce false success or missing late-rejection handling.

Metrics now initiate release even after cancellation and consume its rejection,
then await it only within the existing shared diagnostic deadline. Failed or
unsettled cleanup cannot return a successful report. Late acquisition destruction
consumes both synchronous and asynchronous cleanup errors. Existing transaction,
rollback, expiry, read-only SQL and discard decisions remain unchanged. Manual
snapshot tests verify owned-pool shutdown still runs after client-release failures.
No new activation, mutation, credentials, signing or publication capability added.

Final focused health suite passed31/31 with no skips; syntax and whitespace pass.
Full local/hosted and dependent pin results follow below. Remote commits are based
on fresh main and changed blobs checked exactly; no whole-tree equivalence is
claimed for a local source tree lacking unrelated prior QA/ledger outputs.

## Unfinished acceptance

All24 live acceptance areas remain OPEN. Fixtures, merged code and liveness are
not live database/grant/account/rights/QA/adapter/economics/capacity/owner-phone
acceptance. No changed database-admin access path was found; that failure was not
retried. Etsy excluded. Both publication flags remain false. No paid resource,
purchase, secret disclosure, social-vault access, network widening or fabricated
approval. Per-run execution is not a continuously running self-hosted worker.
Completion condition remains unmet; automation stays enabled.
