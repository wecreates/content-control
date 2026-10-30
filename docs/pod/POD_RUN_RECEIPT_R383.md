# POD Run Receipt R383

Date: 2026-10-30
Scope: reject executable Amazon KDP/POD stored-task invocation, cancellation, artifact-store and claimed-job boundaries before hash-bound restoration.

## Change

Content Control now reads task invocation options, native cancellation state, the host artifact-store read capability, and claimed-job fields only through descriptor-safe boundaries. Accessor- or Proxy-backed values are rejected without invocation, the store method is bound once and called with its original receiver, and cancellation remains live across every restoration step. This run did not administer a database, enable publication, or submit content to a marketplace.

- Expected-red regression commit: `d097d7683be92eafd89023d788841bb18f039e9f`
- Repaired exact head: `9e8aa8e568723096f28095dce7d5502af64e90db`
- Content Control PR: #901
- Content Control merge: `a557b85b5519a29300d63117a3a7ff3b99b79c88`

## Verification

### Expected red

The shared Actions runner initially left both workflows queued. A read-only local checkout reproduced the defect while preserving the queued commit, and the hosted integration run later executed with the same result.

- Local focused test: 23 total, 22 passed, 1 failed
- Hosted workflow run: `41101310773`
- Job: `124218856589`
- Node: 1007 total, 1006 passed
- Result: only `stored task resolver rejects executable invocation and store capabilities without invocation` failed
- Failure evidence: the caller-owned task invocation getter executed before the repair

### Repaired exact head

- Local focused test: 23/23
- Local Node suite: 1007 total, 998 passed, 9 PostgreSQL/environment tests skipped, 0 failed
- Local Python suite: 385/385 after installing the repository-pinned free OpenCV dependency
- Local evidence did not replace hosted gates.

- POD integration run: `41102036769`
- Job: `124220740977`
- Node: 1007/1007
- Python: 385
- Free-review guards: 4/4
- Production E2E and workflow checks: passed
- `PUBLICATION_ENABLED=false`
- `POD_PUBLICATION_ENABLED=false`
- Result: success

- Production container run: `41102036499`
- Job: `124221077963`
- Node/PostgreSQL: 1007/1007
- Python: 385
- Disabled hosted startup: `publication_enabled:false`, `production_status:DISABLED`, `outbox_status:DISABLED`
- Result: success

### Merged-head checks

- Post-merge POD integration run: `41104320986`
- Job: `124229576009`
- Result: success
- System wiring audit run: `41104320878`
- Job: `124229579649`
- Result: success

### Money Factory authority pin

- Money Factory PR: #338
- Pin head: `d97ddb92a08988e35abdee6c3b81909caf9482f4`
- Cross-repository workflow run: `41104371334`
- Job: `124229780022`
- Content Control contracts: 650
- Python groups: 34, 23, 40, 28, 28, 93, 5, 6, 23
- Bridge: 121
- Adapters: 81
- Result: success
- Money Factory merge: `a70230463db6728ccc23355d09769bbb68eacde4`
- Pinned Content Control commit: `a557b85b5519a29300d63117a3a7ff3b99b79c88`
- A concurrent free-monitor cadence update was preserved before merge.
- `PUBLICATION_ENABLED=false`
- `POD_PUBLICATION_ENABLED=false`

## Hosted deployment observation

Render service `content-control-render-worker` observed the functional merge:

- Deploy: `dep-dbidqa7avr4c73bk31d0`
- Deploy started: `evt-dbidqa55l9js73ae8d4g`
- Pipeline minutes exhausted: `evt-dbidqa1443pc739otl20`
- Deploy ended failed: `evt-dbidqa8s3ums73ea7d4g`

The free workspace rejected the deploy before build. No manual retry was issued because the resource path had not changed. This is deployment observation, not live acceptance.

## Acceptance state

All 24 live acceptance areas remain open. The completion checklist continues to list remaining attributable live evidence for every area, and code/CI evidence does not replace live database, account, marketplace, finance, capacity, recovery, end-to-end, or controlled-launch acceptance. Publication remains held for explicit owner approval.
