# Release claim admission — November 10, 2026

Thirteen negative claim cases reproduced the gap on the preceding main; the
unsafe-number case was already rejected. Falsy non-null results could report
IDLE, and malformed fencing/account/destination claims could reach downstream
work or settlement.

Only explicit null now means idle. A release claim must match the requested
account, a supported platform and destination, and a positive safe integer or
canonical positive int8 string fence. Contradictions emit the fixed uncertainty
signal before artifact/grant/local-guard/provider/settlement callbacks.

The real PostgreSQL fixture claims a ready row with an inconsistent destination
using a restricted role. It preserves the acquired publishing lease and quota
reservation, retains only the original QA event and invokes no downstream
callback. Existing recovery owns that uncertainty; no blind retry is authorized.

Tests with enabled values use isolated function inputs and fake providers only.
Hosted results and deployment evidence are linked from this PR. No production
database, live marketplace, authority, credential or network access is changed.
All 24 live acceptance areas remain open and publication remains off.
