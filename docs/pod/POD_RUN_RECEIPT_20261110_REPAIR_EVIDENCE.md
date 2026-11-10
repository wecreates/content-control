# Verify repair evidence before resetting a production job

On Content Control base `b4f33acbf6bd0c13dbabc6d2a0e9b1dd3c6fc5b4`, a
successful archive ID and raw queue state could acknowledge a repair without
verifying that the outgoing manifest and QA evidence were preserved or that
the new job retained its attempt and fencing state. The local regression
reproduced the incorrect successful receipt.

The repair transaction now confirms exact archived JSONB before clearing the
old row. It confirms the persisted reset, including unchanged brief, attempt
and fencing token and the exact fresh grant. Rows with a provider listing
are not requeued as QA failures. The disposable PostgreSQL check modifies
only a test fixture's archive or reset and verifies rollback before a genuine
retry. Exact workflow and deployment results are tracked in the pull request.

No live authority, production database or marketplace was exercised. Both
publication flags remain false. This does not establish a live recovery
drill or close any of the 24 acceptance areas.
