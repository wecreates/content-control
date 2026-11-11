# POD polling timer bound — November 10, 2026

The current worker accepted integer polling delays above Node's signed 32-bit
timer range. Node clamps those delays to 1 ms rather than waiting the requested
interval. A local fixture reproduced repeated recovery cycles within 30 ms.
Two admission regressions failed before the fix.

Reject delays above 2,147,483,647 ms as WORKER_CONFIG_INVALID before callbacks
or database work. Preserve the existing 1,000 ms minimum and 15,000 ms default.
Tests cover overflow, unsafe integers, fractional/non-numeric/non-finite values,
and native cancellation at the minimum, default and maximum supported delay.
Hosted gate results and exact deployment evidence are recorded on the PR;
Money Factory pins the passing merge and runs these regressions explicitly.

No service, production, outbox or publication flag is enabled. All 24 live
acceptance areas remain open. Fixtures are not measured production capacity,
live database acceptance, authority configuration or marketplace verification.
No database-administration retry, credential access or network change was used.
This scheduled run uses available tools, not a continuously running worker.
