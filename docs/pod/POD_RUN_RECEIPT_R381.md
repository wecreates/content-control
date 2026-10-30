# POD Run Receipt R381

Date: 2026-10-30
Scope: reject executable Amazon KDP/POD grant-authority configuration before endpoint, key, and fetch validation.

## Change

Content Control now reads grant resolver options and authority environment fields only through descriptor-safe data properties. It rejects accessor- or Proxy-backed option and environment objects without invoking them, snapshots the validated authority URL and keys, and preserves existing grant and revocation authority behavior. This run did not administer a database, enable publication, or submit content to a marketplace.

- Expected-red regression commit: `0aebda9622befbd26fcd4c2a5e1cb52d765f61a1`
- Repaired exact head: `665377a02c9f80296bc9e6a871f5439c5d2c1388`
- Content Control PR: #897
- Content Control merge: `38ad74d439c71b0b4e2a67be401ea1c05c7163b1`

## Verification

### Expected red

- Workflow run: `41087820396`
- Job: `124173517195`
- Node: 1005 total, 1004 passed
- Result: only `grant resolver rejects executable authority configuration without invocation` failed
- Failure evidence: the caller-owned grant option getter executed before the repair

### Repaired exact head

- POD integration run: `41088032203`
- Job: `124174260385`
- Node: 1005/1005
- Python: 385
- Free-review guards: 4/4
- Production E2E and workflow checks: passed
- `PUBLICATION_ENABLED=false`
- `POD_PUBLICATION_ENABLED=false`
- Result: success

- Production container run: `41088032426`
- Job: `124175021463`
- Node/PostgreSQL: 1005/1005
- Python: 385
- Disabled hosted startup: `publication_enabled:false`, `production_status:DISABLED`, `outbox_status:DISABLED`
- Result: success

### Merged-head checks

- Post-merge POD integration run: `41089345096`
- Job: `124178795373`
- Result: success
- System wiring audit run: `41089345063`
- Job: `124178795106`
- Result: success

### Money Factory authority pin

- Money Factory PR: #336
- Pin head: `e25c26612217854fe8cb76b14497c51e480270b2`
- Cross-repository workflow run: `41089392078`
- Job: `124178955120`
- Content Control contracts: 648
- Python groups: 34, 23, 40, 28, 28, 93, 5, 6, 23
- Bridge: 121
- Adapters: 81
- Result: success
- Money Factory merge: `bfbc1fb6be669cc77722b2f70262432876938d5f`
- Pinned Content Control commit: `38ad74d439c71b0b4e2a67be401ea1c05c7163b1`
- `PUBLICATION_ENABLED=false`
- `POD_PUBLICATION_ENABLED=false`

## Hosted deployment observation

Render service `content-control-render-worker` observed the functional merge:

- Deploy: `dep-dbic8mg473hc73evk4vg`
- Deploy started: `evt-dbic8mgq2hqs73aheo3g`
- Pipeline minutes exhausted: `evt-dbic8mif2vlc73e47kc0`
- Deploy ended failed: `evt-dbic8mv0bdec73e1m130`

The free workspace rejected the deploy before build. No manual retry was issued because the resource path had not changed. This is deployment observation, not live acceptance.

## Acceptance state

All 24 live acceptance areas remain open. The implementation-status file still records no completed acceptance area, and code/CI evidence does not replace live database, account, marketplace, finance, capacity, recovery, end-to-end, or controlled-launch acceptance. Publication remains held for explicit owner approval.
