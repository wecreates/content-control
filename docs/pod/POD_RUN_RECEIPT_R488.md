# POD run receipt R488

Date: 2026-11-06 UTC

## Scope and starting state

This run continued the authorized Amazon KDP/POD implementation lane across
`wecreates/content-control` and `wecreates/Money-factory`. Etsy remained excluded.
The current completion checklist, implementation status, free deployment guide,
repository heads, open pull requests, workflow state and the authorized Render
service `content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`) were inspected
before editing. The starting heads were Content Control
`9840d6dca0c78e7256953cc807fa15cb541e5553` and Money Factory
`b6575ff08f5d64c7c8221284055f7a8b7530b145`. No duplicate R488 pull request or job
existed.

All 24 live acceptance areas were OPEN at the start and remain OPEN. Code and test
evidence below is not live marketplace acceptance. `PUBLICATION_ENABLED` and
`POD_PUBLICATION_ENABLED` remained false throughout.

## Reproduced defect and repair

The shared response bridge registered a custom cancellation listener inside the
abort promise executor. If `addEventListener` threw before registering the listener,
the promise rejected but the bridge still started the first `reader.read()` before
that rejected promise won the race. A focused regression reproduced the failure on
the unchanged starting head: the forbidden response-body read started once instead
of zero times.

Content Control PR #1087 creates the abort promise first, performs listener
registration before starting response-body I/O, rethrows a registration failure when
no abort was observed, and preserves synchronous-abort precedence when registration
itself invokes the listener. Existing best-effort reader cleanup remains intact. The
candidate source and test blobs exactly matched the locally tested blobs. PR #1087
merged as `01c3633d933637737df501fe49a27483972a7e79`.

## Verification

Local Content Control verification:

- focused listener-registration and synchronous-abort regressions: 3 passed,
  0 failed;
- complete shared bridge suite: 51 passed, 0 failed;
- complete POD Node suite: 1,152 passed, 9 expected environment/PostgreSQL skips,
  0 failed (1,161 total);
- complete POD Python suite: 385 passed, 0 failed;
- `git diff --check` passed.

The complete Node invocation used the lockfile-defined dependencies installed with
`npm ci --ignore-scripts` in the fresh worktree. The first local Python invocation
identified that this executor lacked the repository-declared `opencv-python-headless`
runtime dependency; installing the exact pinned `requirements-pod-runtime.txt` and
rerunning the complete suite produced the recorded 385-pass result. The dependency
setup failure is not represented as a product test pass.

Hosted Content Control verification on exact PR head
`b8bea8f8ae8d04509ddf1bd3e4647fc47ace67b2`:

- container run `42150996271`, job `127673935485`: success;
- integration run `42150996272`, job `127673935571`: success.

Money Factory PR #443 advanced the existing immutable Content Control checkout to
the merged repair. Local verification against the exact tested Content Control tree
passed 278 Node tests with one expected PostgreSQL-only skip and all 81 Python tests;
`git diff --check` also passed. Money Factory contains no npm lockfile and these
integration tests are dependency-free, so the unsuccessful `npm ci` preflight was
not counted as product verification. Cross-repository run `42151826766`, job
`127676620690`, succeeded before PR #443 merged as
`a73b3b3de93bd5009e8746e8950b3738bd9f50eb`.

## Deployment evidence

The authorized Render service remained an unsuspended, one-instance free Docker web
service on `main`, with commit auto-deploy enabled and `/health` as its health path.
Functional merge `01c3633d933637737df501fe49a27483972a7e79` built and deployed
successfully as `dep-dbmjrl5ckfvc738mnqu0`; Render build event
`evt-dbmjrsvbf4ts7383kkbg` and deploy-end event `evt-dbmjs4vrkulc73eh8kp0`
recorded success.

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
