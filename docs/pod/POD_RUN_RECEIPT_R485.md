# POD run receipt R485

Date: 2026-11-06 UTC

## Scope and starting state

This run continued the authorized Amazon KDP/POD implementation lane across
`wecreates/content-control` and `wecreates/Money-factory`. Etsy remained excluded.
The current completion checklist, implementation status, free deployment guide,
repository heads, pull requests, workflow state and the authorized Render service
`content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`) were inspected before
editing. The starting heads were Content Control
`64821b7688ded7e331c88d1e97c8f69815ca1cb6` and Money Factory
`2890d3bb22294c7ead72109d47aecc29dc7329bf`. No duplicate R485 pull request or job
existed.

All 24 live acceptance areas were OPEN at the start and remain OPEN. Code and test
evidence below is not live marketplace acceptance. `PUBLICATION_ENABLED` and
`POD_PUBLICATION_ENABLED` remained false throughout.

## Reproduced defect and repair

The shared authority/outbox HTTP boundary registered abort listeners inside a
Promise constructor. A throwing listener-registration hook therefore rejected the
abort promise but still allowed the outbound transport to start. In addition, a
throwing `removeEventListener` cleanup hook could replace a successful response or
the primary bounded-body failure.

Two focused regressions reproduced the unchanged-base behavior: the 46-test bridge
file produced 44 passes and the two new tests failed. Content Control PR #1078
establishes abort-listener control before consuming transport admission or starting
the request, and makes listener removal best effort. The remote candidate tree
`de296fdd4b4cec0b241f38039f60f7b143227b9b` exactly matched the locally tested
tree. PR #1078 merged as
`a521aac51a0e026569f2b90b8609979a8c8614e3`.

## Verification

Local Content Control verification:

- focused bridge tests: 46 passed, 0 failed;
- complete POD Node suite: 1,147 passed, 9 expected environment skips, 0 failed
  (1,156 total);
- complete POD Python suite: 385 passed, 0 failed;
- JavaScript syntax checks and `git diff --check` passed.

Hosted Content Control verification on exact PR head
`68dd9f424cb07faedbfa40165ba4f4ac5248f782`:

- integration run `42136724728`, job `127626647843`: success;
- container run `42136724554`, job `127626646768`: success, including image build,
  non-root/offline dependency checks, Python, Node/PostgreSQL, print/review and
  disabled-startup stages.

Money Factory PR #440 advanced the existing immutable Content Control checkout to
the merged repair. The candidate tree
`4160a61808de2506de27da1b0c6e3a67ccd4d054` exactly matched the locally tested
tree. Local verification against the tested Content Control tree passed 278 Node
tests with one expected PostgreSQL-only skip and all 81 Python tests. An initial
Node invocation omitted the required `CONTENT_CONTROL_ROOT` harness variable and
therefore reported three configuration failures; the corrected invocation with the
explicit tested checkout passed and is the acceptance result. Cross-repository run
`42137672721`, job `127629839324`, succeeded before PR #440 merged as
`fb0c97024c752cd0ccc04690a61c3c029b1d2fcd`.

## Deployment evidence

The authorized Render service remained an unsuspended, one-instance free Docker
web service on `main`, with commit auto-deploy enabled and `/health` as its liveness
path. Functional merge `a521aac51a0e026569f2b90b8609979a8c8614e3` built and
deployed successfully as `dep-dbmi01nb9u1s73d2gm00`; Render event
`evt-dbmi0henlp7c73bkso10` recorded the successful deploy end.
Documentation-only receipt PR #1079 merged as
`bf1dd3aeacafbb5eed0fb4ea60ce541e9d1d93c1`; Render event
`evt-dbmi40o473hc73d63rm0` recorded it as `commit_ignored`, preserving the verified
functional deployment without consuming another build.

Fresh browser probes after the deployment returned:

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
the connector, repository, test and public probe operations recorded here; it is not
a continuously running self-hosted worker.

Every row in `POD_COMPLETION_CHECKLIST.md` remains OPEN. The next run should continue
the highest-priority unblocked implementation or repair while preserving the false
publication flags. The automation must remain enabled until all 24 areas have live,
attributable completion evidence and publication is held for explicit approval.
