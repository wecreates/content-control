# POD run receipt r267 — artifact-write retention checkpoints

Date: 2026-10-25

## Reconstructed state and scope

Content Control started from current main
`da519e831d8159547741ac4e03104a61626ce294`; Money Factory started from
`845cf73d9adf0adac92d8bc1c0cf14d294cdb7cc`. The current completion,
implementation and free-deployment records, relevant open pull requests,
workflow results and the authorized Render service were inspected. No open
pull request duplicated this repair. The failed database-administration route
had no credible changed access path and was not retried. No resource,
credential, account, network rule or marketplace state changed.

## Repair and regression evidence

`ArtifactStore.putMany()` checked the configured storage-retention cutoff at
transaction admission and before commit, but not after its asynchronous write
lock, immutable-row lookup, occupied-byte query or each insert. If storage
expired during the immutable-row lookup, the prior implementation still ran
the budget query and inserts. If it expired during the first insert, the prior
implementation still attempted the later inserts before the transaction's
final rejection rolled everything back.

Two new regressions reproduced both gaps on current main: 31 of 33 focused
artifact tests passed and the new assertions failed. Content Control PR 648
adds a cutoff checkpoint after the lock, immutable-row lookup, occupied-byte
query and every insert. Expiry during lookup now stops before the budget query
or an insert. Expiry during the first insert stops before the second insert and
the transaction rolls back. The existing final pre-commit check remains.

The focused suite passed 33/33 after the repair. The full local POD Node suite
passed 830 tests with nine intentional environment-gated skips and zero
failures (839 total); the directly affected combined suite passed 123/123. The
embedded worker fixture passed both its allowed 24-page and blocked 26-page
paths. Syntax and whitespace checks passed.

Hosted verification found and corrected two test-double omissions rather than
weakening the production checkpoint. Initial integration run 40247077569, job
121330801759, exposed missing `active()` forwarding in two real-PostgreSQL
fault wrappers; those wrappers were corrected. Integration run 40247216299,
job 121331227338, then passed the 839 Node/PostgreSQL tests and exposed the same
missing method in one embedded Python/Node worker fixture; that fixture was
corrected. A subsequent large-file connector upload was truncated and produced
null bytes, so runs 40247871122 (job 121333189918) and 40247871145 (job
121333190317) were invalid transport failures. The fixture was re-uploaded and
verified byte-for-byte by Git object hash
`2a47ce29fee19279dfe31460cb3a50b13da86307`.

The final exact head `42f8629ead149d6c3164b0f55444770665580307`
passed integration run 40248454154, job 121334932812, and production-container
run 40248454234, job 121334933001. Those runs covered the pinned Python/OpenCV
runtime, Node/PostgreSQL contracts, Python rendering and QA, real print-package
generation, durable review flow and publication-disabled startup. PR 648 was
confirmed ahead of unchanged main with a clean merge and was squash-merged as
`fb8999eea17ad092b62042731b8b9435e85f3299`.

Money Factory PR 223 changed only its immutable Content Control checkout to
that merge. Local dependent verification passed 116 Node tests with one
intentional PostgreSQL-environment skip and 81 Python tests. The tested and
remote tree was `acb446d3ad3ba0ec915645d1f4c41b2ea631e630`.
Exact-head cross-repository run 40249251626, job 121337315552, passed every
step. After an unchanged-base and clean-mergeability check, head
`b65a4b7cf8abf4b3c459df00b9a18ab236985f63` was squash-merged as
`1f169d5acb17de472e98b33f2ac6a924fc488e85`. Publication remained disabled.

## Deployment and acceptance state

Render automatically attempted exact Content Control merge
`fb8999eea17ad092b62042731b8b9435e85f3299` as deploy
`dep-dbf9qdp5efls73bpc2ug`. Deploy-start event
`evt-dbf9qdrphbkc73aa945g`, `pipeline_minutes_exhausted` event
`evt-dbf9qdugej5s73aconeg` and failed deploy event
`evt-dbf9qe3phbkc73aa947g` show that the application build did not run. Hosted
behavior remains unverified. No manual retry, purchase, plan/cache change,
replacement service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN**. This repair closes one artifact
write interruption boundary; code and hosted CI are not live storage,
database, marketplace, reconciliation or deployment acceptance. Restricted
production database/schema/migrations, retained off-host recovery, deployed
hybrid dependencies, mounted Money Factory authority and current grants/
revocation, real accounts/sources/rights/templates/reviewers, authorized
KDP/Redbubble/TeePublic/Zazzle/Spreadshirt adapters, actual economics and
provider reconciliation, owner-phone acceptance, monitoring/recovery drills,
measured capacity and authorized end-to-end launch evidence remain unverified.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; Etsy remains excluded. No approval, clearance, revenue, publication
or continuously running self-hosted worker is claimed.
