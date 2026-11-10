# November 9, 2026 — bind grants to the scope captured before dispatch

Started from Content Control `a5c20348bc907503ad1fa33053af8a3855b72f97`
and Money Factory `331800b5bb3c838c63a9fcdb09e264cb5fa2ea4a`. Their
existing POD checks passed. The free Render worker was live on the starting
Content Control revision, with the explicit publication hold previously
verified. No overlapping POD PR was open.

The grant resolver sent the original job ID but re-read the caller's brief
after HTTP I/O. A changed brief could make a signed response for a different
scope pass, or invoke a late accessor. The resolver now copies only its inert
identity, destination, mode and hash fields before dispatch, rejects executable
or inherited scope, and verifies the signed response against that same copy.
The transport request still contains only the job ID; existing signed lifetime,
task digest and release safeguards are unchanged.

Three targeted regressions failed on the prior resolver. All 69 grant-client,
transport and stored-authority tests passed locally after the fix. Hosted,
rollout and downstream evidence are recorded on the PR. No live database path
changed, so database administration was not retried. This is not live grant
authority, owner-phone, marketplace, continuous-worker or launch evidence;
all 24 acceptance areas remain open.
