# Verified outbox monitoring counts — November 10, 2026

Regression fixtures demonstrated NaN, negative, string and oversized delivery
counts could corrupt runtime totals, advance a rejected result's cursor and even
record a healthy cycle. Result accessors also ran during those state updates.

The runtime now reads count/cursor data descriptors, rejects Proxy/accessor
results without invoking those properties, and requires nonnegative integer
counts whose sum fits the existing twenty-event batch. Omitted failed remains
zero for compatibility; malformed values are never coerced. No state is updated
before this validation. An invalid result retains the prior cursor, records one
failed cycle and uses existing backoff; a valid retry restores healthy telemetry.
This does not establish that a custom adapter's reported count actually occurred.

Focused local outbox suites passed 53 tests, no skips. Hosted gate, merge and
deployment evidence is recorded on the PR and dependent Money Factory pin.
All 24 live acceptance areas remain OPEN. No production database/marketplace,
service/publication activation, credentials, network expansion, paid resource or
continuous worker operation is established. The unchanged database-administration
blocker was not retried. Health fixtures are not live acceptance or revenue.
