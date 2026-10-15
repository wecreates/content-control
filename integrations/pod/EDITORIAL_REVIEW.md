# KDP editorial approval contract

Technical PDF checks and cover comparisons do not approve a manuscript. KDP QA
requires a separate current editorial envelope for the exact completed package.
The renderer's `editorial_review: UNASSESSED` receipt remains a technical receipt;
never rewrite it to manufacture approval.

The trusted editorial authority signs the existing HMAC envelope format using a
separately managed `POD_EDITORIAL_KEY` (at least 32 bytes). Payload requirements:

| Field | Required value |
| --- | --- |
| schema_version | Integer 1 |
| audience | `pod:editorial-review` |
| issued_at_ms, expires_at_ms | Current integer millisecond window, at most 15 minutes |
| package_sha256 | Exact completed package manifest hash |
| interior_sha256 | Exact hash of the package's `interior.pdf` |
| evaluator_id | An explicitly authorized editorial evaluator |
| verdict | `PASS` only after independent review |
| checks | Each of the five checks below must be boolean true |

Required checks are `editorial`, `originality`, `content_completeness`,
`cover_interior_consistency`, and `ai_disclosure`. The authority must actually
review the manuscript, cover pairing and applicable disclosure requirements.
These checks do not replace regional rights evidence, official templates,
platform preview acceptance or the independent comparative review. A signature
authenticates the authority's statement; it does not establish that statement's
accuracy. Calibrate and authorize the reviewer before using it for real products.

`pod_vision_qa.py` accepts `--editorial-review PATH` and repeatable
`--approved-editorial-evaluator ID`. Missing evidence/key, unknown evaluator,
wrong package/interior, failed/incomplete checks or expired evidence blocks KDP.
Its PASS receipt cannot outlive the earliest rights, comparative or editorial
approval. The CLI never creates an editorial approval.

For an authorized in-process review integration, `reviewPackage(manifest)` may
return an `editorial` file path in addition to `rights` and `competitive`.
The worker passes the host-owned `approvedEditorialEvaluators` allowlist to QA.
`createStoredTaskResolvers` accepts that allowlist as a trusted option; task
descriptor contents cannot authorize evaluators. Stored tasks still stop at a
review hold by default and do not preapprove future output bytes.

Database completion/review acceptance and the publication executor require
`checks.editorial === true` in authenticated KDP QA. Legacy technical-only KDP
receipts must be reevaluated; do not backfill that bit. Non-book POD products
retain their existing QA requirements. No migration or publication enablement
is included. Keep PUBLICATION_ENABLED and POD_PUBLICATION_ENABLED false.
