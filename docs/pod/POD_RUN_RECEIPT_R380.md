# POD Run Receipt R380

Date: 2026-10-30
Scope: reject executable Amazon KDP/POD service bootstrap configuration before disabled-state and storage boundaries.

## Change

Content Control now reads caller-owned service options only through descriptor-safe data properties. It rejects accessor- or Proxy-backed option and environment objects without invoking them. Startup consumers receive a safe environment data snapshot, while the already descriptor-safe production and outbox runtimes retain live off-switch behavior. This run did not administer a database, enable publication, or submit content to a marketplace.

- Expected-red regression commit: `67ec6c0c083eebda7c5147062d393398aee2a3f3`
- Repaired exact head: `7dc85d75174fc5bab268b32b547683d49c6ddd87`
- Content Control PR: #895
- Content Control merge: `42558665cc607ba3f21f13ec32b86aa75d07e7fb`

## Verification

### Expected red

- Workflow run: `41079669543`
- Job: `124145111199`
- Node: 1004 total, 1003 passed
- Result: only `POD service rejects executable startup configuration without invocation` failed
- Failure evidence: the caller-owned `env` getter executed before the repair

### Repaired exact head

- POD integration run: `41080003527`
- Job: `124146267334`
- Node: 1004/1004
- Python: 385
- Production E2E and free-review guards: passed
- `PUBLICATION_ENABLED=false`
- `POD_PUBLICATION_ENABLED=false`
- Result: success

- Production container run: `41080003512`
- Job: `124146656305`
- Node/PostgreSQL: 1004/1004
- Python: 385
- Disabled hosted startup: `publication_enabled:false`, `production_status:DISABLED`, `outbox_status:DISABLED`
- Result: success

### Merged-head checks

- Post-merge POD integration run: `41081183705`
- Job: `124150429490`
- Result: success
- System wiring audit run: `41081183702`
- Job: `124150429500`
- Result: success

### Money Factory authority pin

- Money Factory PR: #335
- Pin head: `2b2732218ea7672675d28586cfdaf203d2213c84`
- Cross-repository workflow run: `41081246358`
- Job: `124150654831`
- Content Control contracts: 647
- Python groups: 34, 23, 40, 28, 28, 93, 5, 6, 23
- Bridge: 121
- Adapters: 81
- Result: success
- Money Factory merge: `73f852a0a4727af96997475b97d6df6a0a09ecb1`
- Pinned Content Control commit: `42558665cc607ba3f21f13ec32b86aa75d07e7fb`
- `PUBLICATION_ENABLED=false`
- `POD_PUBLICATION_ENABLED=false`

## Hosted deployment observation

Render service `content-control-render-worker` observed the functional merge:

- Deploy: `dep-dbibfm2vcj2c73cepa40`
- Deploy started: `evt-dbibfm6a5vhs73a4lqog`
- Pipeline minutes exhausted: `evt-dbibfm6a5vhs73a4lqr0`
- Deploy ended failed: `evt-dbibfmf0bdec73e0s7bg`

The free workspace rejected the deploy before build. No manual retry was issued because the resource path had not changed. This is deployment observation, not live acceptance.

## Acceptance state

All 24 live acceptance areas remain open. The implementation-status file still records no completed acceptance area, and code/CI evidence does not replace live database, account, marketplace, finance, capacity, recovery, end-to-end, or controlled-launch acceptance. Publication remains held for explicit owner approval.
