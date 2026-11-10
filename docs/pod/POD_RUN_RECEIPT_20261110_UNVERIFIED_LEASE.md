# Hold unverified POD worker leases and keep them visible

The prior sweep and alert only compared the lease deadline to a clock.
Missing deadlines were silently omitted, and a positive-infinity deadline
could appear active forever. Local regressions reproduced the missing alert
and incomplete sweep predicate.

The production and publication paths now require a finite active lease. The
sweep quarantines invalid leases without fabricating a deadline or resetting
the fence and attempts. Read-only monitoring distinguishes invalid lease
holds from ordinary expiry, including after recovery. The expired-production
retry path cannot accept an unverified deadline.

Disposable PostgreSQL coverage exercises null and both infinite timestamps,
production guard refusal, safe quarantine and retained monitoring alerts.
Exact test and deployment results are tracked in the pull request.

No production database administration was retried, no adapter or provider was
called, and neither publication flag was enabled. The unrelated live video
review smoke remains separate from POD status and acceptance; process
liveness and fixture tests do not establish a live recovery drill.
