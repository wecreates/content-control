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
