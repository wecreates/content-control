# Immutable outbox pagination cursor — November 10, 2026

Three current-source regressions failed: cursor accessors were admitted as valid
batch results, and mutating the delivery-owned cursor between polls changed the
next pagination position. Top-level count validation alone did not bind its nested
cursor. This could skip or repeat a page and defer executable properties to I/O.

Cursor admission now requires exactly two enumerable own data fields, UUID id
and bounded nonblank UTF-8/NUL-free timestamp text, on an ordinary non-Proxy
object. Both values are copied into a frozen object before counts, health or
pagination state changes. PostgreSQL timestamp text, including microseconds and
offset, is preserved exactly, not converted through a millisecond Date. This
does not certify the timestamp's provenance or relax database parsing.

Tests reject malformed/incomplete/extra-field, Proxy and accessor cursors, and
prove later callbacks cannot mutate the retained pagination position. The existing
pagination fixture now supplies the complete real cursor shape. Hosted workflow,
exact merge and deployment evidence are recorded on the PR and dependent MF pin.

All 24 live acceptance areas remain OPEN. No real event delivery, authority,
storage recovery, marketplace, revenue or measured capacity is established.
No activation, credentials/social-vault access, network expansion or purchase;
both publication flags remain off. Unchanged DB administration was not retried.
Available scheduled tools do not establish continuous worker uptime.
