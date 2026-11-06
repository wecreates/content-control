# POD run receipt R487

Date: 2026-11-06 UTC

## Scope and starting state

This run continued the authorized Amazon KDP/POD implementation lane across
`wecreates/content-control` and `wecreates/Money-factory`. Etsy remained excluded.
The current completion checklist, implementation status, free deployment guide,
repository heads, open pull requests, workflow state and the authorized Render
service `content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`) were inspected
before editing. The starting heads were Content Control
`41316851ba19c2fac700d0fa3fdd0d89240c63e5` and Money Factory
`6ca38b5f642a421524b24a042657b945145533b6`. No duplicate R487 pull request or job
existed.

All 24 live acceptance areas were OPEN at the start and remain OPEN. Code and test
evidence below is not live marketplace acceptance. `PUBLICATION_ENABLED` and
`POD_PUBLICATION_ENABLED` remained false throughout.

## Reproduced defect and repair

A custom cancellation signal can synchronously invoke its abort listener from
`addEventListener`. The shared response bridge recorded the rejection, but still
queued or started an uncooperative header transport or first response-body read
before that rejection won the promise race. Two focused regressions reproduced both
failures on the unchanged starting head: the forbidden header and body operations
each started once instead of zero times.

Content Control PR #1084 records a synchronous abort during listener registration
and rejects immediately after registration, before header admission or the first
body read. It preserves the original abort reason and existing best-effort cleanup.
The candidate file blobs exactly matched the locally tested blobs. PR #1084 merged
as `f95bde951279d081d729a20bcdae194b36792e8d`.

## Verification

Local Content Control verification:

- both new focused regressions: 2 passed, 0 failed;
- focused bridge suite: 50 passed, 0 failed;
- complete POD Node suite: 1,151 passed, 9 expected environment/PostgreSQL skips,
  0 failed (1,160 total);
- complete POD Python suite: 385 passed, 0 failed;
- `git diff --check` passed.

The complete Node invocation used the lockfile-defined dependencies installed with
`npm ci --ignore-scripts` in the fresh worktree.

Hosted Content Control verification on exact PR head
`485cdf4625d51c36ba8527e381ab7a614aa535de`:

- integration run `42145168059`, job `127654776728`: success;
- container run `42145168045`, job `127654776706`: success.

Money Factory PR #442 advanced the existing immutable Content Control checkout to
the merged repair. Local verification against the exact tested Content Control tree
passed 278 Node tests with one expected PostgreSQL-only skip and all 81 Python
tests. Cross-repository run `42146146802`, job `127657982822`, succeeded before PR
#442 merged as `b6575ff08f5d64c7c8221284055f7a8b7530b145`.

## Deployment evidence

The authorized Render service remained an unsuspended, one-instance free Docker
web service on `main`, with commit auto-deploy enabled and `/health` as its health
path. Functional merge `f95bde951279d081d729a20bcdae194b36792e8d` built and
deployed successfully as `dep-dbmj2e4s728c7398ivl0`; Render event
`evt-dbmj30s7j7js73bastb0` recorded the successful deploy end.

Fresh browser probes after deployment returned:

- `/health`: `alive:true`, `production_approved:false`, `publication:false`;
- `/livez`: `alive:true`, `production_approved:false`, `publication:false`;
- `/readyz`: `ok:false`, `production_approved:false`, `publication:false`,
  `qaStatus:"GREEN"`, matching expected/actual SHA-256
  `59b662688952addf932c2ced9c438aa1499e282039055e71eeb5109d8e86134e`, and
  `captionReady:false`.

The deployment is process-live and correctly fail-closed; it is not launch or
end-to-end acceptance.

## Limits and remaining work

Database administration was not retried because no credible access path changed.
This run did not use production credentials, change database networking, contact a
marketplace, create a paid resource, send messages, use social-vault data, evade bot
detection or enable publication. The scheduled execution environment performed only
the connector, repository, test and public-probe operations recorded here; it is not
a continuously running self-hosted worker.

Every row in `POD_COMPLETION_CHECKLIST.md` remains OPEN. The next run should continue
the highest-priority unblocked implementation or repair while preserving the false
publication flags. The automation must remain enabled until all 24 areas have live,
attributable completion evidence and publication is held for explicit approval.
