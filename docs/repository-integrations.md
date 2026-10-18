# Money Factory repository workers

The seven upstream repositories live once in Money Factory, under `integrations/vendor`.
Content Control uses `scripts/repository_tools.py` to invoke that worker from the existing production host.
Remotion, character memory, voice routing, creative QA, and release rules remain authoritative.

Set `MONEY_FACTORY_ROOT` to the existing checkout on the private worker and install the desired isolated runtimes with Money Factory's `integrations/setup.py`.

```sh
python scripts/repository_tools.py /path/to/job.json --runtime /path/to/persistent/integration-runtime
```

See Money Factory's `integrations/README.md` for job operations and verified scope.
Do not send secrets in job JSON. The worker rejects paid generation and publication requests.
Import generated assets into the existing timeline and run existing production QA before review or release.

`GET /api/integrations/status` reports whether this host has the worker source configured.
It does not assert runtime health or production readiness. A Render web process without
`MONEY_FACTORY_ROOT` returns `WORKER_NOT_CONFIGURED`, rather than presenting local tests as a live deployment.

The low-memory web service must not install all ML runtimes during its normal build.
Full Wan inference requires a separate provisioned CUDA host and downloaded weights.
The CPU tools need their own persistent worker storage; no new paid infrastructure is authorized by this change.

## Free hosted CPU verification

Money Factory's `repository-integrations.yml` runs all eight CPU checks through this
repository's pinned bridge on standard GitHub-hosted runners. It is restricted to
the existing public repository, supplies no provider secrets, and keeps publication
disabled. Installations execute in the requested order, skipping Wan because the
standard runner has no CUDA GPU. This is reproducible hosted verification, not an
always-on production worker or persistent Toonflow/Ruflo service.

Set `REPOSITORY_WORKER_BACKEND=github-actions` on the existing Render web service to
read the public workflow state and hash-bound operation receipts. The status endpoint
checks the latest run, attempt, source revision, all eight operation receipts, source
pins, and a seven-day evidence limit. A failed latest run, missing evidence or a GitHub
outage cannot become a passing status. Results are cached for one minute. The endpoint
never dispatches jobs or exposes a public command executor.

Rerun the hosted checks using GitHub's **Run workflow** button on
https://github.com/wecreates/Money-factory/actions/workflows/repository-integrations.yml.
Access is controlled by the existing GitHub account; no new application password is
required. Source changes automatically run the relevant checks. All reported passes
remain limited to the named operations; production readiness remains false.

## Independent verification scopes and aggregate HTTP status

The hosted response's existing `status` remains the original eight-operation CPU
suite result for compatibility. It does not include `additional_tools`: REA has
five independently verified operations, VoiceStudio has one, and YouTube Agent
Skill has six. Each retains its own workflow, receipts, freshness and runtime status.
All evidence files still come from the single immutable `evidence_snapshot_revision`.

`aggregate_status` is `HOSTED_REQUIRED_OPERATIONS_VERIFIED` only when the original
suite and every required configured additional tool pass. Otherwise it is
`HOSTED_REQUIRED_OPERATIONS_NOT_VERIFIED`. Hosted HTTP responses preserve the legacy
contract: 200 for original-suite verification and 503 otherwise. Consumers requiring
all configured operation evidence must inspect `aggregate_status`, not HTTP 200.
Missing, failed, running, stale, malformed or unavailable additional evidence cannot
produce aggregate verification. Local source-configuration responses are unchanged.

`expected_operation_count` and `verified_operation_count` count the original eight
plus required configured additional operations (20 when all three tools above are
required). Additional tools default to required; an explicit registry
`required_for_production: false` excludes that tool from the aggregate and its counts,
but its independent status remains visible. `expected_operations` and
`required_for_aggregate` expose that scope per additional tool. An unknown required
tool, duplicate configured tool identity or unavailable registry leaves the expected count `null` and fails aggregate
verification closed. Only fully verified suites/tools contribute to the verified count.
Wan's CUDA/model requirement remains separate from these named hosted operations.

Neither aggregate success nor operation counts assert provider production health,
creative approval, persistent service readiness or publishing readiness.
`production_ready`, `publication_enabled` and `paid_generation_enabled` remain false.
