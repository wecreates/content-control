# POD production settlement scope — November 10, 2026

Production authorization checked the claimed job, account and platform but
not its durable brief. Settlement checked only job ID and fence. This could
attach failure, review or QA evidence to a row whose destination or task had
changed since the worker claimed it, while the original lease was still valid.

The production stage, failure, review hold and QA completion now bind the
exact durable account, platform and brief under the queue-row lock. The
existing finite wall-clock lease and rights checks remain in force. Four
focused regressions failed on the prior query contracts. The disposable
PostgreSQL fixture changes the stored brief, account and platform in turn,
requires zero settlement mutations and events, then restores the original
scope and permits the genuine completion.

This verifies claim/settlement identity, not live market authorization,
database access or a new release approval. Both publication flags remain off;
the 24-area live acceptance stays open.
