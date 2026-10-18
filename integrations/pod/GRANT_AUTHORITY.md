# Current approval at execution time

POD_GRANT_URL selects the Money Factory HTTPS grant endpoint. POD_GRANT_AUTH_KEY authenticates the caller and must differ from POD_UPSTREAM_KEY, which verifies the signed reply. Both require at least 32 bytes. The worker sends only job_id, never approvals, readiness, facts or requested privilege. Configure the endpoint before using a backlog that can outlive stored grants.

The Money Factory createPodAuthorityHandler export belongs in the existing authoritative HTTP host. Supply a server-owned loadSnapshot(jobId) that loads the job, current readiness, current approval and verified facts from their actual sources. Mount the handler at the configured route behind HTTPS. The handler is code, not a deployed service or a fabricated approval source. Request JSON containing extra fields is rejected.

Each execution calls the authority again, verifies signature, age, remaining lifetime, account/business/platform/task scope and readiness ceiling. A failed authority call never falls back to an old approval. Abort signals cancel the request. If no URL is configured, the built-in stored-task resolver reports authorityReady=false and production remains BLOCKED_GRANT_AUTHORITY. A stored queue envelope is intake evidence, never a fallback execution approval.

The authority re-evaluates approval after loading its snapshot. Revoked or expired approval fails closed. It cannot make an unready business ready, authorize Etsy, or elevate PRELAUNCH to LAUNCH. Configure snapshot database reads with bounded timeouts and consistent transactions. Test changes to readiness and revocation in the deployed authority before enabling queue production.

Publication remains separately disabled. Grant renewal does not validate rights, QA, provider eligibility, print templates, storage, or profits and cannot substitute for those gates.

## Strict verifier time

Content Control requires the current verifier clock and signed issued_at_ms and
expires_at_ms values to be nonnegative safe integer milliseconds. NaN, infinity,
fractional values, numeric strings and coercible objects cannot decide expiry.
The existing fifteen-minute maximum lifetime remains; issuance is inclusive and
expiry exclusive. An invalid clock blocks verification even for an otherwise
correct signature. It never refreshes or extends the signed approval.

This applies to every audience using the shared verifier, including QA and
intake evidence. Normal Money Factory integer timestamps remain compatible.
Clock validation is not proof of synchronized production clocks, current grants
or live revocation; those acceptance checks remain required.
