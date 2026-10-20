# KDP editorial approval contract

## Paperback baselines before durable production

The stored-production coordinator validates the signed interior template before
starting cover generation. The supported binding must now be explicitly
`binding: "paperback"`, with `interior_type: "text_no_bleed"`. Missing binding,
hardcover and bleed interiors fail as KDP_PAPERBACK_SPEC_INVALID. Templates
requiring correction need a new immutable descriptor and fresh authority for its hash;
do not edit stored artifacts or infer approval for the changed inputs.

Necessary physical baselines, checked against KDP on October 20, 2026:

| Field | Required baseline |
| --- | --- |
| page_count | Integer 24–828 |
| trim_inches | Numeric width 4–8.5 and height 6–11.69 |
| font_size_pt | Numeric 7–72; 72 is this renderer's existing upper bound |
| outside/top/bottom margins | Each at least 0.25 inch |
| inside margin, pages 24–150 / 151–300 / 301–500 / 501–700 / 701–828 | At least 0.375 / 0.5 / 0.625 / 0.75 / 0.875 inch |

Values must be finite numbers; margins must leave usable page area. These are
necessary baselines, not the complete requirements for a selected print option.
Specific ink/paper/trim/marketplace combinations can have stricter page limits
or unavailable sizes. Obtain and retain the actual matching official calculator
template and verify those options separately. No such template or print proof
is imported or approved by these checks. Hardcover needs a separate contract.

Sources: [KDP print options](https://kdp.amazon.com/en_US/help/topic/G201834180),
[paperback margin chart](https://kdp.amazon.com/en_US/help/topic/G202145400),
[submission specifications](https://kdp.amazon.com/en_US/help/topic/G201857950).

The low-level Python renderer and QA geometry helpers still support small
technical fixtures. Their success does not satisfy this durable-production gate
or grant print acceptance. Actual PDF inspection, embedded fonts, exact
cover/interior pairing and separate editorial/comparative approval remain
required. Non-KDP products are unaffected. Both publication flags remain false.

## Separate editorial authority

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


## Delivered interior glyphs

The independent text-only interior preflight rejects glyph ID zero in the actual
PDF display-list trace as `INTERIOR_GLYPH_MISSING`. A PDF's ToUnicode mapping can
return the expected manuscript character while the font draws its missing-glyph
box; successful extraction is insufficient. This check runs inside existing KDP
visual QA, alongside geometry, visibility, color and static-document checks.
A genuine supported replacement character (U+FFFD) and ligature continuations
remain valid; this gate inspects glyph IDs rather than banning Unicode values.

This does not establish correct spelling, font licensing, complex-script shaping,
visual quality or editorial approval. A nonzero glyph is not proof that it is the
right glyph. Existing independent review and exact-package approval still apply.
Regression fixtures cover missing glyphs on first/later pages, a misleading but
textually correct ToUnicode map, and supported accented/Greek/Cyrillic text.
PyMuPDF documents the trace's separate Unicode and glyph fields at
https://pymupdf.readthedocs.io/en/latest/functions.html#Page.get_texttrace

The same text-only preflight rejects clipping paths as
`INTERIOR_CONTENT_UNSUPPORTED`. Ordinary drawing extraction omits these paths;
the extended display-list inspection exposes them. A clip can cut off a word or
hide a whole line while another line remains visible, without changing reported
text color, opacity or glyph bounds. Even a clip whose bounding rectangle covers
the full page may contain an even-odd hole, so bounds alone cannot authorize it.
Clipping is outside the current renderer contract, including otherwise harmless
clips. Ordinary graphics-state save/restore without clipping remains supported.
Fixtures verify actual pixel loss, partially extractable text, hidden text beside
visible text and a full-page clip with a hole. This is a technical content check;
editorial and independent visual approval remain separate requirements.
The parser's extended clipping output is documented at
https://pymupdf.readthedocs.io/en/latest/page.html#Page.get_drawings
