# Free-project audiovisual API diagnostics

This adapter provides **sampled audiovisual diagnostics**, not release approval.
`scripts/gemini_free_av_review.py` uploads exact MP4 bytes to the Gemini Files API,
waits for that specific file to become ACTIVE, verifies its server-side SHA-256
and byte length, and makes one standard-tier `gemini-3.8-flash` interaction.
Video processing is explicitly static at 1 FPS. Audio is supplied with the video.

Every receipt keeps `publication_enabled`, `production_approved`, `ready`,
`full_video_review`, and `full_audio_review` false. `reviewed_intervals` and
`comparisons` remain empty. A successful request is `DIAGNOSTIC_ONLY`; an
inaccessible, refused, incomplete, malformed or failed request is `BLOCKED`.
Model-observed timestamps and access claims are untrusted evidence. Metadata,
server processing and model self-report do not establish continuous perception.
The existing exact-review and creative-handoff gates remain unchanged.

## Activation prerequisite

An AI Studio Free-tier project screenshot cannot prove that the repository's
`GEMINI_API_KEY` belongs to that project. The adapter fails before any network call
if either runtime credential is missing, and before upload unless all checks pass:

1. The existing secret is resolved by `keys.lookupKey`, including a live key resource.
2. Resource Manager binds its numeric parent to `gen-lang-client-0010384080` and
   confirms that project is ACTIVE.
3. `projects.getBillingInfo` explicitly returns `billingEnabled: false`, the same
   project, and no linked billing account. A closed-but-linked account is rejected.
4. The repository's reviewed model/pricing policy is current. Official Standard
   input/output pricing was checked on 2026-10-17; this verification expires on
   2026-10-24 and must be reviewed again, not extended automatically.
5. `models.get` confirms the exact model is available using the existing key.

The project checks run again immediately before upload, before inference, and
after inference. These are point-in-time checks; this client cannot lock out an
independent administrator changing billing concurrently. It never sets up billing,
links accounts, buys credits, chooses another model, or falls back to a paid route.
Quota failures stop the run. There is no automatic inference retry after uncertain
transport errors.

### Secure identity, not a manually expiring token secret

The adapter accepts `GEMINI_PROJECT_READ_TOKEN` only as an injected runtime access
token from an **already approved** identity. The identity needs these permissions
on this project only:

- `apikeys.keys.lookup`
- `resourcemanager.projects.get`

Its OAuth scopes must cover both
`https://www.googleapis.com/auth/cloud-platform.read-only` and
`https://www.googleapis.com/auth/cloud-billing.readonly`. A missing scope/API or
permission returns BLOCKED. The script cannot create credentials or grant roles.

For maintainable GitHub Actions operation, configure approved Workload Identity
Federation and a dedicated read-only service account. Restrict the provider to
the immutable repository and owner IDs, `refs/heads/main`, and this exact manual
workflow. Grant `roles/iam.workloadIdentityUser` only on that service account.
Use a project custom role containing only the two permissions above; do not grant
Project Viewer, API Keys Admin, billing mutation, key-string retrieval, or broad
project roles. Mint a short-lived scoped access token per run via
`google-github-actions/auth`, and pass its access-token output directly into the
diagnostic step. Avoid a service-account key JSON, a saved OAuth access token, or
exported credentials files. A manually supplied access token is only a bounded
one-time execution input and is not an ongoing operational setup.

**WIF hosting is not provisioned or verified here.** Google's deployment-pipeline
setup guide lists billing enabled on the pool's host project as a prerequisite.
That conflicts with using the required unbilled Gemini project as that host. Do
not enable billing to activate this adapter. A separate, already available and
authorized host project would need its prerequisites and costs verified first;
none is established by this change. The prepared WIF job is a disabled integration
point, not a claim that free-only identity provisioning is complete. If no suitable
existing identity/host is available, keep API diagnostics blocked until a verified
no-new-cost supported identity route is established.

If an authorized host is subsequently verified, the proposed resource names are
pool `content-control-av`, provider `github-exact-av`, and service account
`content-control-av-reader@gen-lang-client-0010384080.iam.gserviceaccount.com`.
These names are a plan, not existing resources. GitHub's API verified repository
ID `1380894143` and owner ID `147456350` on 2026-10-17. Map all referenced claims
and require this provider attribute condition (and use the actual verified host
project number in the provider resource and principal binding):

```text
assertion.repository_id == '1380894143' &&
assertion.repository_owner_id == '147456350' &&
assertion.ref == 'refs/heads/main' &&
assertion.event_name == 'workflow_dispatch' &&
assertion.workflow_ref == 'wecreates/content-control/.github/workflows/exact-av-review.yml@refs/heads/main'
```

The two project-read permissions expose key resource/project identity and ordinary
project metadata/billing status; they do not retrieve key strings, read media,
change billing, or modify project resources. Service-account impersonation is
limited to this dedicated identity and inherits only those project permissions.

Creating this identity/trust, granting permissions, enabling any missing APIs, or
expanding repository OIDC permissions requires separate explicit authorization.
No such Google setup is performed by this change. Disabled WIF wiring is included
in a separate manual-only job, with OIDC permission scoped to that job and the
Google auth action pinned to a verified v3 commit. After approval and verification,
configure repository variables `GEMINI_AV_WIF_PROVIDER`,
`GEMINI_AV_READ_SERVICE_ACCOUNT`, and finally `GEMINI_AV_IDENTITY_ENABLED=true`.
These configuration variables select the approved identity, not evidence of free
entitlement; all live project checks remain mandatory. Keep them unset until the
identity is approved and verified. PR jobs have neither Gemini secrets nor OIDC.
The manual workflow input defaults false; selecting it before secure identity
wiring is complete emits BLOCKED without starting the OIDC job.
The existing Gemini secret is referenced only at runtime, never extracted or logged.

Free-tier Google processing may use submitted content to improve Google products.
`store:false` disables interaction storage for subsequent API retrieval; it does
not override Google's free-tier data-use terms. Confirm the media is appropriate
for that processing before opting in. Uploaded files are deleted after a known
file identifier exists, including on failures; a deletion failure is reported.
An interrupted upload with no returned identifier cannot be cleaned up by this
client and remains subject to provider retention.

## Run and validate

After approved runtime identity setup, use the existing `Exact AV Reviewer`
manual workflow with its trusted production/retained-repair source selection and
`run_free_api_diagnostic: true`. The media hash comes from its fresh local
preparation receipt. Existing safeguards for retained repaired media still apply.
This produces `receipts/gemini-av-diagnostic.json` in the separate
`gemini-av-diagnostic-FORMAT` artifact. When identity is not configured, its blocker
receipt is instead included in the existing `exact-av-review-FORMAT` artifact.
It never substitutes an original Short's diagnostic for repaired media.

Direct CLI use requires an explicit independently obtained expected SHA-256:

```sh
python scripts/gemini_free_av_review.py \
  --video /path/to/exact.mp4 \
  --expected-sha256 "$EXPECTED_SHA256" \
  --output receipts/gemini-av-diagnostic.json
```

Limits: 200 MiB MP4 with video and audio, up to 600 seconds, 300-second file
processing window, one inference request with a 300-second HTTP timeout and 8192
maximum output tokens. The workflow also has a 20-minute job deadline. Each HTTP
request has a wall-clock deadline, including connection, response reads and JSON
parsing, so slow-drip responses cannot extend the request indefinitely. A deadline
failure is not retried; cleanup of a known uploaded file has its own 30-second
deadline. This requires POSIX interval timers and the Python main thread. An
unsupported execution context or an existing active/repeating process timer is
rejected before network access. A local timeout cannot prove that remote provider
processing stopped. Direct CLI use has these per-request bounds, not a separate
overall process deadline.
`ffprobe` is restricted to the MOV/MP4 demuxer and local file protocol, with no
runtime secrets inherited. The file is snapshotted and hashed before probing.
Output cannot alias the original media or policy file. There is no output path
that writes a production approval or replaces existing creative review evidence.

```sh
python -m unittest discover -s tests -p test_gemini_free_av_review.py
node --test tests/exact-av-review.test.mjs tests/creative-handoff.test.mjs
```

Tests mock Google responses and generate a tiny local audiovisual fixture. They
do not upload real media, consume API quota, or establish live secret entitlement.
Until secure identity binding succeeds, no retained Short has been API-reviewed.

## Official sources checked 2026-10-17

- [Video processing and sampling](https://ai.google.dev/gemini-api/docs/video-understanding)
- [Model pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.8-flash)
- [API key and project billing relationship](https://ai.google.dev/gemini-api/docs/billing)
- [Key lookup](https://docs.cloud.google.com/api-keys/docs/reference/rest/v2/keys/lookupKey)
- [Project lookup](https://docs.cloud.google.com/resource-manager/reference/rest/v1/projects/get)
- [Billing read permission and scopes](https://docs.cloud.google.com/billing/docs/reference/rest/v1/projects/getBillingInfo)
- [Billing state semantics](https://docs.cloud.google.com/billing/docs/reference/rest/v1/ProjectBillingInfo)
- [Files API hash and processing state](https://ai.google.dev/api/files)
- [Interaction status and errors](https://ai.google.dev/api/interactions-api)
- [Workload Identity Federation](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)
- [Google GitHub authentication action](https://github.com/google-github-actions/auth)
