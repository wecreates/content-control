# POD run receipt r219 — published listing identity

Date: 2026-10-23

## Reconstructed state and scope

Content Control started from main
`97baf4f4cc773d9bdbf49a1c3806058a7681450f`; Money Factory started from
`2a87ec5e03d2c8044dd55ef80ca5007629b7aeed`. The current completion,
implementation-status and free-deployment documents, open pull requests,
workflow results and the authorized existing Render service were inspected.
No open pull request overlapped this POD reconciliation repair. The previously
failed database-administration path had no credible access change and was not
retried. No resource, credential, account, network rule or marketplace state was
created or changed.

## Repair and regression evidence

Signed listing readback previously allowed a queue row already marked
`published` but missing its durable provider listing identity to retain a new
provider inbox observation. The regression reproduced this boundary failure:
the focused suite passed nine of ten assertions and the new assertion failed
because no rejection occurred.

[Content Control PR 537](https://github.com/wecreates/content-control/pull/537)
requires an already-published row to retain the exact provider ID named by the
new observation. Missing or different durable identity now returns
`LISTING_SCOPE_INVALID` before stored-proof lookup or any inbox, queue or event
write. Authenticated readback may still resolve missing identity for submitted
or ambiguous work; a valid published row may still retain later exact evidence.
Unit and disposable-PostgreSQL regressions cover the no-write boundary.

The exact remote head
`15f6ee883120b2d73a16aa4a33fd1b3b5ca1165d` used these blobs:

- `integrations/pod/reconcile.mjs`:
  `a7fe611e0eaed297765af4380ca137fdb9d7b1c9`
- `integrations/pod/LISTING_EVIDENCE.md`:
  `34d0e762427183d6b53ac96d028d5affb35ab2dd`
- `tests/pod-reconcile.test.mjs`:
  `8253e09e8a2f3a33cfa8f1af483ef54595dd1076`
- `tests/pod-postgres.test.mjs`:
  `dbfe5bcc78b9143362aabe540f01256a79de6d9b`

Focused reconciliation/release checks passed 48/48. The final full local Node
POD suite passed 700 tests with nine expected environment-gated skips and zero
failures. One unrelated process-cleanup timing assertion failed once in an
earlier full run, then passed three focused reruns and the final complete rerun;
it was not waived. Syntax and whitespace checks passed.

[Integration run 40040332230](https://github.com/wecreates/content-control/actions/runs/40040332230),
job 120709652639, and
[production-container run 40040332229](https://github.com/wecreates/content-control/actions/runs/40040332229),
job 120709652491, both passed on that exact PR head. PR 537 merged as
`08469319dab2e543dc777554de994220f028e186` after the remote main base remained
unchanged.

## Dependent Money Factory verification

[Money Factory PR 174](https://github.com/wecreates/Money-factory/pull/174)
pinned the existing cross-repository workflow to Content Control merge
`08469319dab2e543dc777554de994220f028e186` while retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Exact head
`d142cbf7bfac77fd82eb28318cba43669d322202` passed
[run 40041022806](https://github.com/wecreates/Money-factory/actions/runs/40041022806),
job 120711869443, and merged as
`b048dd8ace576d98dc707cf04e2961d62d303e98` after the remote base remained
unchanged.

## Render and acceptance state

Render automatically attempted Content Control merge
`08469319dab2e543dc777554de994220f028e186` as deploy
`dep-dbdv0mm1egvs73fb4b80`. Event `evt-dbdv0mq8sjds73faig80` recorded deploy
start at 2026-10-23T23:40:11.370978Z. Event
`evt-dbdv0mose3cs73f66d0g` reported `pipeline_minutes_exhausted` at
23:40:11.448597Z, and event `evt-dbdv0mu4uq4c739jvrc0` recorded the failed
deploy at 23:40:11.949287Z. No application build ran. No retry, purchase,
replacement service, credential access or network widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one provider-readback
state-integrity boundary only; merged code and hosted CI are not live acceptance.
Production restricted database/schema/migrations, retained recovery evidence,
deployed hybrid dependencies, mounted Money Factory authority/current grants
and revocation, real accounts/sources/rights/templates/reviewers, authorized
five-platform adapters, actual economics/reconciliation, owner-phone acceptance,
monitoring/recovery drills, measured capacity and a real authorized end-to-end
launch remain unverified. Both publication flags remain false; Etsy remains
excluded. No approval, clearance, revenue, publication or continuously running
self-hosted worker is claimed.
