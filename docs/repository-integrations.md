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

## Optional ZeroGPU Wan assets

The same private bridge supports Money Factory’s `wan21/generate-free` operation; see [free-wan-integration.md](free-wan-integration.md). It requires per-job approval for external image/prompt processing. The live anonymous provider test failed, so this is not a verified production path. Existing Remotion and QA gates remain authoritative.
