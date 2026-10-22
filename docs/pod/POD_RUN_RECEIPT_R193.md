# POD run receipt r193 — private offline review exports

Date: 2026-10-22 UTC

## Reconstructed starting state

- Content Control: `2312728fcce1e9baf219f83d38233f28ab41391a`
- Money Factory: `673bf09d6c154e37c7e5727ce8d1ef005308f3f9`
- No open pull request overlapped this POD work. Content Control PR 378 remains
  an unrelated disabled OpenFilm candidate and explicitly contains no POD work.
- The previously failed database-administration path had no credible access
  change and was not retried.

## Implemented and verified

[Content Control PR 478](https://github.com/wecreates/content-control/pull/478)
merged exact tested head `5e81d92cd476f1547fe4ce1e1b50fdb6505c23bf`
as `32ee50f25fe2ad72405eb3f7caff9a338bf2bdbf`. Before repair, a
regression ran the offline review exporter with process umask `000` and proved
that all three recovered artifacts plus `manifest.json` were created as `0666`.
Those files can contain proprietary artwork, manuscripts and evidence receipts.

The exporter now creates each artifact and manifest through exclusive file
creation with a maximum mode of `0600`, and refuses a final symlink when the
host provides `O_NOFOLLOW`. Its new output directory remains `0700`. The
existing no-overwrite, media-envelope, byte/hash and partial-cleanup controls
remain in force. This is a local discretionary-access boundary, not encryption
or protection from the same account/root.

Verification after repair:

- focused review-export suite: 21/21 passed;
- full local POD Node suite: 688 tests, 679 passed, nine expected
  environment-gated skips, zero failures;
- Python syntax and whitespace checks: passed;
- [integration run 39873014736](https://github.com/wecreates/content-control/actions/runs/39873014736),
  job `120151760516`: passed on the exact PR head, including the new permission
  regression and the complete pinned Python matrix;
- [production-container run 39873014889](https://github.com/wecreates/content-control/actions/runs/39873014889),
  job `120151761082`: passed on the exact PR head, including image build,
  non-root dependencies, Python/Node/PostgreSQL, real print/durable-review and
  publication-disabled startup stages.

[Money Factory PR 147](https://github.com/wecreates/Money-factory/pull/147)
pinned its cross-repository gate to Content Control
`32ee50f25fe2ad72405eb3f7caff9a338bf2bdbf` while retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Exact head
`95b5fd85f4c3e2c60caf94572b1a1b10efe8dac6` passed
[cross-repository run 39873651496](https://github.com/wecreates/Money-factory/actions/runs/39873651496),
job `120153851691`, including pinned review/export, recovery, binary-output,
rights, KDP, Money Factory Node and final Python integration stages. It merged
as `c08b56be704fd07d8ab4b4d96c3f15b3270c38a3`.

## Authorized Render observation

The existing free `content-control-render-worker` remains on `main`, automatic
commit deployment, Docker runtime and no persistent disk. Render automatically
attempted exact Content Control merge
`32ee50f25fe2ad72405eb3f7caff9a338bf2bdbf` as deployment
`dep-dbd9usk9v7es73do62ug`. Deploy-start event
`evt-dbd9usifocic73a73hmg` bound the exact merge at
`2026-10-22T23:42:42.555870Z`; event `evt-dbd9usifocic73a73hm0`
recorded `pipeline_minutes_exhausted` at `2026-10-22T23:42:42.542877Z`;
and deploy-end event `evt-dbd9usla7kgc73dib2fg` recorded failure at
`2026-10-22T23:42:42.798319Z`. No application build ran, so this change is not
verified in the hosted runtime. No manual retry, paid workaround, replacement
service, credential access or network widening occurred.

## Acceptance truth

All 24 live acceptance areas remain OPEN. This closes one local offline-review
confidentiality boundary only; merged code and hosted CI are not live acceptance.
Production restricted database/schema/migrations, retained recovery evidence,
deployed hybrid dependencies, mounted Money Factory authority/current grants and
revocation, real accounts/sources/rights/templates/reviewers, authorized
five-platform adapters, actual economics/reconciliation, owner-phone acceptance,
monitoring/recovery drills, measured capacity and a real authorized end-to-end
launch remain unverified.

Both publication flags remain false; Etsy remains excluded. No approval,
clearance, revenue, publication or continuously running self-hosted worker is
claimed. This report-only receipt uses `[skip render]`; the implementation
change itself did not skip CI or deployment.
