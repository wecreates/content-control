# All 24 acceptance areas

No item is complete merely because code or a test exists. This registry preserves the requested scope while live dependencies are unavailable. All publication flags remain off. The criteria below require saved, attributable evidence from the actual deployment; test fixtures do not count.

| # | Area | Remaining completion evidence |
|---|---|---|
| 1 | Database | Restricted production role, migrations and preflight executed successfully |
| 2 | Storage | Capacity plan beyond bounded database blobs; backup and restoration verified; expiry resolved |
| 3 | Hosting | Existing service uses tested hybrid image; dependency probe and availability verified |
| 4 | Authority | Current-snapshot grant handler and event inbox mounted and authenticated in live Money Factory |
| 5 | Approval lifecycle | Fresh-grant client wired; live revocation, expiry and queued execution tests |
| 6 | Accounts | Real owner-authorized account records, countries, categories and quotas |
| 7 | Intelligence | Authorized source per platform; timestamped evidence and source-specific adapters |
| 8 | Concepts | Evidence-based ranking, diversity checks and measured unique-concept budget |
| 9 | Rights | Current regional/category registry coverage and asset/font license evidence |
| 10 | Generation | Approved generation provider or local model, demonstrated quality and known cost/capacity |
| 11 | Templates | Current official product specifications imported, versioned and print-verified |
| 12 | KDP | Substantive manuscripts, editorial approval, correct cover/interior pairing and actual preview acceptance |
| 13 | QA | Trusted independent reviewer calibrated on representative products; rights/comparative evidence |
| 14 | Remediation | Failure-specific repair implementations and verified bounded repair outcomes |
| 15 | Adapters | Authorized submission and readback verified separately for all five marketplaces |
| 16 | Publishing | Verified quotas, duplicate/recovery tests, suspension handling, scoped release authorization |
| 17 | Economics | Actual price/cost/fee/royalty evidence and enforceable minimum margins |
| 18 | Finance | Actual provider statements reconciled to immutable events and the MF ledger |
| 19 | Mobile operations | Owner phone authentication, previews and audited operational actions accepted |
| 20 | Monitoring | Heartbeats, actionable failure alerts, storage expiry and recovery drills |
| 21 | Security | Production role/key isolation, rotation and endpoint abuse tests |
| 22 | Capacity | Measured 100 unique concepts/day; separately demonstrated 1,000/day capacity |
| 23 | End-to-end | Real authorized job through generation, independent QA, permitted submission and observed result |
| 24 | Launch | Explicit publication approval and successful limited monitored release |

## Current code additions

The repository already contains dedicated queue migrations, durable hash-addressed artifacts, worker leases, technical QA, review holds, read-only deployment preflight, production container/deployment tooling, internal outbox delivery and exact review-package restoration. Current-grant renewal now requests a fresh scoped grant from the existing Money Factory authority interface instead of relying only on an aging queue envelope. None of these additions creates credentials, paid resources, legal clearance or marketplace permission.

## External blockers

On October 26, 2026 the authorized Neon replacement path materially changed the
database state. A dedicated database, five checksum-matched migrations and a
non-administrator runtime role were verified live. A manual snapshot was restored
to an isolated branch and the restored role, 11-table schema and all five migration
checksums were reverified. The Render worker now holds only that restricted runtime
URL, with every service/production/outbox/publication activation flag false.

This does **not** close database or storage acceptance. The full production
preflight has not run with the live bridge, operations and signing authorities;
the scheduled execution environment could not independently open the public TLS
socket; the free database is capped at 1 GiB with a six-hour restore window; and
no separately retained backup exists beyond the provider snapshot. The conservative
operational cutoff remains November 1, 2026 at 00:00:00 UTC, the end of the current
verified quota period, not a claim that Neon deletes data then. Render also rejected
the environment-triggered deploy before build because pipeline minutes remain
exhausted. No network allowlist should be broadened to work around either limitation.
Free web hosting is not an always-on guarantee. The live authority, rights inputs
and authorized marketplace adapters still need actual configuration and acceptance.
Do not replace these requirements with mock adapters, synthetic statements, renewed
stale approvals, or automatic QA passes. See
[the r281 receipt](docs/pod/POD_RUN_RECEIPT_R281.md) for exact evidence and limits.
