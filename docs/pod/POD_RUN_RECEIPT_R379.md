# POD Run Receipt R379

Date: 2026-10-30
Scope: reject executable Amazon KDP/POD outbox configuration before delivery boundaries.

## Change

Content Control now reads outbox runtime options and nested environment fields only through descriptor-safe data properties. It rejects accessors and proxies without invoking them, preserves the live outbox off-switch through safe re-reads, and snapshots the validated URL, key, and poll interval before dispatch. This run did not administer a database, enable publication, or submit content to a marketplace.

- Expected-red regression commit: `9f0b40e7e48a71a18d14d9e834c05a292c1bf165`
- Repaired exact head: `e91430b6199cb2e2a8ee3595145d3236caad46d5`
- Content Control PR: #893
- Content Control merge: `c761bde53db41d56032c744a9c1129fd4e87ac9e`

## Verification

### Expected red

- Workflow run: `41064460606`
- Job: `124092121734`
- Result: failed only the new regression, `outbox runtime rejects executable configuration without invocation`
- Node: 1003 total, 1002 passed
- Failure evidence: caller-owned outbox option getter executed before the repair

### Repaired exact head

- POD integration run: `41064680245`
- Job: `124092876583`
- Node: 1003/1003
- Python: 385
- Production E2E: 1
- Free-review guards: 4
- Result: success

- Production container run: `41064680375`
- Job: `124093460551`
- Node/Postgres: 1003/1003
- Python: 385
- Production E2E: 1
- Disabled hosted startup: `publication_enabled:false`, `production_status:DISABLED`, `outbox_status:DISABLED`
- Result: success

### Merged-head checks

- Post-merge POD integration run: `41065643193`
- Job: `124096186939`
- Result: success
- System wiring audit run: `41065643049`
- Job: `124096184099`
- Result: success

### Money Factory authority pin

- Money Factory PR: #334
- Pin head: `f3bc586c275ce0b74479fe0f7cd73f3c00f82735`
- Cross-repository workflow run: `41065713236`
- Job: `124096438882`
- Content Control contracts: 646
- Python groups: 34, 23, 40, 28, 28, 93, 5, 6, 23
- Bridge: 121
- Adapters: 81
- Result: success
- Money Factory merge: `648664211a4a315dad696ccf6b0e35d3241780e6`
- Pinned Content Control commit: `c761bde53db41d56032c744a9c1129fd4e87ac9e`
- `PUBLICATION_ENABLED=false`
- `POD_PUBLICATION_ENABLED=false`

## Hosted deployment observation

Render service `content-control-render-worker` observed the functional merge:

- Deploy: `dep-dbi9u8jm8hqs73avee8g`
- Deploy started: `evt-dbi9u8oq2hqs73af75bg`
- Pipeline minutes exhausted: `evt-dbi9u8qa6svs738otq50`
- Deploy ended failed: `evt-dbi9u8uh2hjs73br9hkg`

The failure occurred before a build could run because the free workspace had no pipeline minutes. No manual retry was issued because the access/resource path had not changed. This is deployment observation, not live acceptance.

## Acceptance state

The 24-area completion checklist remains open and the implementation-status completion table still has no verified completed acceptance areas. Code and CI evidence do not prove live database, account, marketplace, financial, capacity, recovery, or end-to-end acceptance. Publication remains held for explicit owner approval.
