# November 9, 2026 — verify both publication flags are off

Content Control started at `78a1ca189d51aceab73b8b2c7717ab3996e0d85a`;
Money Factory started at `c53b1bb1a5290235341ffab994b663f444bd2f29`.
The prior archive repair's main integration gate and bridge PR gate passed.
Render's existing free worker was live on the exact Content Control revision
(`dep-dbpaa8m417fc739es4e0`); no concurrent POD PR was open.

The startup smoke previously accepted false, absent, and non-boolean
confirmation because the aggregate request bit was false unless both flags
were true. Three negative smoke regressions reproduced the acceptance gap.
The public route now adds a boolean requiring both own flag values to be the
literal string false, without returning their values or executing accessors.
It samples the live source at request time rather than the startup snapshot.
The local container smoke requires that boolean and emits it in its receipt.
The existing requested/enabled fields keep their meanings. All 25 smoke cases
passed locally; the service and router HTTP cases require the hosted Node
dependencies, which are not installed in the scheduled workspace.

This changes monitoring and the verification gate, not publication permissions
or either flag. Hosted runs and deployment evidence are recorded on the PR.
No changed production database access path was available; database
administration was not retried. This is not continuous-worker, production
database, marketplace, or acceptance evidence. All 24 live acceptance areas
remain open.
