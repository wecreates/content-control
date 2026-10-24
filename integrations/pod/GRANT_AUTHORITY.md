# Current approval at execution time

POD_GRANT_URL selects the Money Factory HTTPS grant endpoint. POD_GRANT_AUTH_KEY authenticates the caller and must differ from POD_UPSTREAM_KEY, which verifies the signed reply. Both require at least 32 bytes. The worker sends only job_id, never approvals, readiness, facts or requested privilege. Configure the endpoint before using a backlog that can outlive stored grants.

The Money Factory createPodAuthorityHandler export belongs in the existing authoritative HTTP host. Supply a server-owned loadSnapshot(jobId) that loads the job, current readiness, current approval and verified facts from their actual sources. Mount the handler at the configured route behind HTTPS. The handler is code, not a deployed service or a fabricated approval source. Request JSON containing extra fields is rejected.

Before dispatch, the client requires the durable job ID to be one primitive
1–100 character authority identifier and to match the brief ID exactly. Arrays,
boxed strings, objects with `toJSON`, unsupported characters and mismatched
durable/brief scopes fail with `GRANT_REQUEST_INVALID` without contacting the
authority. JSON serialization cannot normalize a malformed local scope into a
valid remote lookup.

Successful authority responses must use the `application/json` media type, with
optional parameters such as `charset=utf-8`. HTML, problem JSON and missing
media types fail closed before the signed envelope is parsed. A correctly signed
body delivered under a different response contract is not accepted as a current
grant.

The response body must be the authority's exact two-member object containing
only `payload` and `signature`. Additional status, error or private members fail
closed even when the payload and signature would otherwise verify. This prevents
a mixed or confused response from authorizing execution.

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


## Exact readiness mode types

Both the authority and consumer require primitive, exact RESEARCH, PRELAUNCH or
LAUNCH strings for the requested mode and readiness ceiling. Arrays and objects
are rejected before a grant or accepted brief is returned. JavaScript property
lookups otherwise coerce an array such as ["LAUNCH"] into a mode name while exact
launch comparisons do not, which can skip launch-specific checks. Invalid inputs
are rejected rather than normalized; valid mode ceilings, publication permission,
launch readiness and economic checks are unchanged. Regression fixtures verify
issuer, HTTP snapshot and signed-consumer rejection; they do not establish live
authority mounting, approval, revocation, or publication acceptance.


## Unambiguous signed envelopes

The shared verifier accepts payloads up to 262144 UTF-8 bytes and requires an
exact primitive 64-character lowercase hexadecimal signature. Arrays, boxed
strings and trailing line terminators cannot enter hex decoding. The HMAC still
authenticates the original payload before semantic JSON parsing; payloads are
never normalized or reserialized to make a signature match.

The bounded HTTPS response parser also requires strict UTF-8 and rejects
duplicate decoded keys before choosing the outer payload/signature pair. An
escaped spelling cannot override an earlier response member even when the final
pair would otherwise contain a valid signature.

After authentication, duplicate decoded object member names, numeric overflow,
unsafe integers and noncanonical numeric spellings are rejected at every
nesting level. A number must retain the same value and token when serialized by
the native JSON implementation; negative zero, redundant decimal/exponent
spellings, underflow to zero and excess fractional precision fail closed.
Escaped spellings of the same key count as duplicates, including identical
repeated values. Separate objects may reuse names, and text containing JSON-like
strings is unchanged. The root must be an object; timestamp, audience and schema
checks still apply. Canonical numeric enforcement applies to every
HMAC-authenticated payload passed through the shared envelope verifier,
including grants, QA, intake, evidence and listing observations. The underlying
strict parser retains exact JSON text for bounded recovery records whose
PostgreSQL bigint fields must not be coerced through JavaScript numbers. These
rules align signed bridge payloads with the Money Factory event parser and
require their senders to serialize finite safe numbers canonically. They do not
establish arbitrary-precision numeric semantics, real approvals or live
acceptance.


## Claim and price evidence references

A signed verified flag alone does not supply evidence. The consumer includes a
fact in its brief only when its name is a nonblank string of at most 256
characters, its value is a nonblank string and its evidence_ids array contains
1–32 distinct nonblank primitive strings of at most 256 characters each. These
reference bounds match the existing release-economics convention. An array in
place of the fact collection is not an allowlist. Malformed or unsupported
claims are omitted; identifiers and claim text are never repaired or normalized.

Provider verification remains required for shipping, safety and warranty claims.
Money Factory event verification remains required for revenue and profit claims.
The upstream forbidden-claim list still removes a claim by name or exact value.
Verified price metadata additionally needs a valid evidence reference and an
exact three-uppercase-letter primitive currency string; malformed prices become
null. Publication still requires the separate complete economic release budget.

These are reference-shape checks, not proof that an event exists or supports the
claim. The authoritative Money Factory host must supply authentic current source
records and verification. Synthetic contract tests do not establish verified
revenue, provider facts, rights, deployment or marketplace acceptance.
