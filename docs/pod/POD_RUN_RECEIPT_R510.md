# R510: exact recorded-activity observation windows

Reconciled current checklist/status/free-deployment docs, open PRs, POD workflows,
CC maind94b0e6fb5c99f86883af182c8d2aba42c44a790 and MF
maincd0d91b825a78933529eb96e1202c0133afc6350. No duplicate in-scope PR or job.
Latest CC POD push42318894438 and MF cross-repo42318960428 passed. Unrelated
narration42313044842, monitor42318234427 and browser42315893023 failures are not
marked passed or weakened. Etsy is excluded.

Authorized free Docker/main Render service srv-darsdb8u01pc73dn4i2g in
tea-darsafojo6nc739844hg remains unsuspended, one instance, /health, auto deploy.
Existing live dep-dbn73efavr4c73dmng70 runs functional merge
dbddb961cabeb04a35b62be7ca329ead5bd5717f. No environment or infrastructure changed.

## Confirmed defect and bounded repair

The capacity report accepted arbitrary short timestamp strings. Date parsing
silently normalized February30/31 into a valid-looking 24-hour window; date-only,
zone-less and 24:00 inputs were also ambiguous. Microseconds could be truncated,
making an inexact window look exactly24 hours. Regression failed against baseline
(13 pass/1 fail of14). Fixtures are synthetic, not real production activity.

String adapters now require exact UTC seconds or three-digit milliseconds with
calendar round-trip verification. Native PostgreSQL Date results remain supported
without invoking overridable methods. Non-UTC strings and sub-millisecond strings
fail closed rather than silently changing the observation interval. Focused tests
pass14/14; syntax/whitespace checks pass. Read-only SQL/count semantics and explicit
capacity_verified=false, acceptance_verified=false, publication_enabled=false
are unchanged. All24 live acceptance areas remain OPEN.

Local source lacks unrelated concurrent media/QA/ledger outputs, so no whole-tree
identity is claimed. Remote trees must start from fresh main and replace only
the intended blobs, preserving concurrent work. Full local/hosted tests, dependent
MF pin and rollout evidence will be appended after verification.

## Execution limits and unfinished acceptance

No credible changed database-admin path exists; that failed path was not retried.
Configured December1 cutoff is not provider retention/recovery evidence. No new
live database/grant/account/rights, independent QA, adapter, economics, capacity,
recovery or owner-phone acceptance is claimed. Both publication flags stay false.
No paid resource, purchase, message to others, secret disclosure, social-vault,
network widening or fabricated approval. Per-run tools are not a continuous
self-hosted worker. Completion condition is unmet; automation remains enabled.
