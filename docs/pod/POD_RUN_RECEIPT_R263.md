# POD run receipt r263 — artifact export publication interlock

Date: 2026-10-25

## Reconstructed state and scope

Content Control started from current main
`ee284e7e25f72f2a6c1b258ca258e0bb39efd248`; Money Factory started from
`5685e4bfabd0ee8bc32b5681826dbc10455581d1`. The current completion,
implementation and free-deployment records, repository heads, relevant open pull
requests, workflow results and the authorized Render service were inspected. The
only open pull request matching POD text was unrelated Content Control draft PR
378, whose scope explicitly excludes POD changes; no open Money Factory pull
request matched this lane. The failed database-administration route had no
credible changed access path and was not retried. No resource, credential,
account, network rule or marketplace state changed.

## Repair and regression evidence

The artifact archive CLI checked both publication kill switches before invoking
export, but the exported `exportArtifactLibrary` API ignored its environment and
did not recheck either switch during a long database and filesystem operation.
A direct caller, or a flag change after CLI admission, could therefore receive an
`EXPORTED` receipt while publication was enabled. Nine new regressions reproduced
those missing admission and completion checks on the previous implementation.

Content Control PR 636 requires exact disabled values for
`PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` before creating the archive
directory or acquiring a database connection. It rechecks both values around
cursor reads, before and after commit, after the encrypted catalog write, after
the archive and parent directory flush, and after final byte re-authentication.
Flag changes reject the operation with the existing exact
`ARCHIVE_PUBLICATION_MUST_BE_DISABLED` condition and never authorize an
`EXPORTED` receipt. The export remains recovery-capable inside the configured
storage retention window and does not bypass or modify publication controls.

The exact tested Content Control tree was
`604ab0306a11c68cde5deb9b931fcd42803ec955`. Focused artifact archive checks
passed 48/48. The full local POD Node suite passed 817 tests with 9 intentional
environment-gated skips and zero failures. Local Python discovery executed 266
tests but had two collection errors because this executor lacked `cv2`; that is
not recorded as a pass. Exact-head hosted integration run 40227661291, job
121272381522, and production-container run 40227661201, job 121272381015, both
passed with the pinned Python/OpenCV runtime, full Node/PostgreSQL checks,
durable review E2E and disabled-startup probe. Syntax and whitespace checks also
passed.

PR 636 merged as `e1bcb2f10c7930c1115653eb6361b82730fe8000` with the
same exact tested tree. Money Factory PR 219 advanced only the immutable
cross-repository pin to that merge. Local Money Factory verification passed 116
Node tests with one explicit PostgreSQL-environment skip and 81 Python tests.
Cross-repository run 40228234428, job 121274185046, passed. PR 219 merged as
`0722f1f52eb495cb9341587ffc77f30334f1917e` with exact tree
`c8198c3aed50b2e8ecdd99a32a7e864ca6d12c45`; both publication flags remained
false.

## Deployment and acceptance state

Render automatically attempted exact Content Control merge
`e1bcb2f10c7930c1115653eb6361b82730fe8000` as deploy
`dep-dbf5s9ss728c73d6vns0`. Deploy-start event
`evt-dbf5s9segpmc73c0lat0`, `pipeline_minutes_exhausted` event
`evt-dbf5s9r8vfls7392fkl0` and failed deploy event
`evt-dbf5s9ta647c73eojel0` show that the application build did not run. Hosted
behavior remains unverified. No manual retry, purchase, plan/cache change,
replacement service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN**. This repair closes one artifact
recovery publication-interlock boundary; code and hosted CI are not live storage,
database, marketplace, reconciliation or deployment acceptance. Restricted
production database/schema/migrations, retained recovery, deployed hybrid
dependencies, mounted Money Factory authority and current grants/revocation,
real accounts/sources/rights/templates/reviewers, authorized
KDP/Redbubble/TeePublic/Zazzle/Spreadshirt adapters, actual economics and
provider reconciliation, owner-phone acceptance, monitoring/recovery drills,
measured capacity and authorized end-to-end launch evidence remain unverified.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; Etsy remains excluded. No approval, clearance, revenue, publication
or continuously running self-hosted worker is claimed.
