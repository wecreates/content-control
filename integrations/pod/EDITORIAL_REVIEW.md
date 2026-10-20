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
The option gate below applies the reviewed paper/trim limits. Obtain and retain
the actual matching official calculator template and verify the selected options
separately. No such template or print proof is imported or approved by these
checks. Hardcover needs a separate contract.

Sources: [KDP print options](https://kdp.amazon.com/en_US/help/topic/G201834180),
[paperback margin chart](https://kdp.amazon.com/en_US/help/topic/G202145400),
[submission specifications](https://kdp.amazon.com/en_US/help/topic/G201857950).

The low-level Python renderer and QA geometry helpers still support small
technical fixtures. Their success does not satisfy this durable-production gate
or grant print acceptance. Actual PDF inspection, embedded fonts, exact
cover/interior pairing and separate editorial/comparative approval remain
required. Non-KDP products are unaffected. Both publication flags remain false.

## Explicit print options and paper-specific limits

The signed interior now also requires `ink_type: "black"` and a primitive
`paper_type` string: `white`, `cream` or `groundwood`. The text-only renderer
does not support color interiors. The signed target country selects the reviewed
US or JP table from KDP's submission specifications, rechecked October20, 2026.
Only the exact listed trims in that table are supported. Other countries,
custom sizes, missing options and color profiles return
KDP_PRINT_OPTIONS_UNSUPPORTED; there is no inferred paper or regional fallback.

`kdp-paperback-options.mjs` records the table version and source. Page ceilings
vary with paper and trim; overflow returns KDP_PRINT_PAGE_LIMIT. For example,
a US 6×9 cream book is capped at776 pages, while a US 8.5×11 cream book is
capped at550. The general828-page ceiling cannot authorize either overflow.
No clipping, substitution or automatic manuscript edits are applied.

This validates declared options, not actual provider configuration, worldwide
availability, regional rights, cover spine measurements, print proof or platform
acceptance. Bind the actual matching calculator template and independently
verify cover/interior pairing and selected submission options. Unsupported
profiles require a separately verified contract before admission. Correcting
template fields requires a new immutable task and fresh authority for its hash.
Low-level technical/review helpers remain separate, and publication stays false.

## Matching cover and even manuscript before rendering

The durable production coordinator also requires the independently authenticated
cover and interior to agree before launching child stages. Cover `kdp` fields
must declare matching `binding`, `ink_type`, `paper_type` and `page_count`, plus
`trim_width_inches`, `spine_width_inches` and `bleed_inches`. For supported black
ink, spine factors in inches per page are white 0.002252, cream 0.0025 and
groundwood 0.00235. Bleed must be exactly 0.125 inch. Full cover dimensions
must equal twice trim width plus spine plus 0.25 inch, and trim height plus
0.25 inch. Derived measurements use a 0.000001-inch comparison tolerance;
primitive finite numbers are required. Mismatches fail COVER_INTERIOR_MISMATCH.

KDP rounds manuscript count up to an even number. This renderer does not insert
that extra page, so odd counts fail KDP_PAGE_COUNT_REQUIRES_REVIEW before cover
generation. Supply an explicitly reviewed even-page manuscript, new immutable
task and fresh authority for its hash. Neither stored inputs nor approval bytes
are padded, rewritten or re-signed by this gate. Source: KDP's submission
specifications above, checked October20, 2026.

These checks compare declared signed specifications. They do not import or
approve a genuine calculator file, establish paper availability, inspect its
print marks or authorize spine text. Actual PDF/raster inspection, matching
official template retention, independent editorial/visual review and observed
KDP preview/print acceptance remain required. Low-level Python technical fixture
helpers are unchanged. Both publication flags remain false.

## Independent paperback pairing during QA

The Python QA path independently checks the declared paperback binding, black
ink and matching white/cream/groundwood paper, even count in 24–828, basic trim
bounds, exact 0.125-inch bleed, spine factor and full cover dimensions. It reads
the package specifications and actual PDF bytes, rather than trusting a passing
assembly receipt or the earlier Node coordinator. Missing or inconsistent
profiles return COVER_INTERIOR_MISMATCH even when receipt/artifact hashes and
synthetic approvals have been rebound. Paper factors and tolerance match the
coordinator's source above, rechecked October20, 2026.

This pair check is a necessary cross-check, not the region-specific trim/page
ceiling admission table or actual provider configuration. The existing Node
admission gate still supplies those declared-option limits. Authentic official
templates, regional availability, safe zones/print marks, calibrated independent
review and actual preview/print acceptance remain separate requirements.
Low-level renderer/assembly helpers still permit small technical review fixtures;
such fixtures now fail independent KDP QA pairing. No manuscript padding,
approval fabrication, publication enablement or template import is added.

## Delivered interior font size

Independent PDF QA requires each display-list text run and extracted span to
meet KDP's seven-point minimum. A declared template font or passing renderer
receipt cannot stand in for the delivered PDF. Smaller text on later pages or
beside readable text fails INTERIOR_FONT_SIZE_INVALID. Uniform scaling is
measured after transformation; normal and transformed seven-point text pass.

For the renderer's horizontal native-text subset, extracted span height divided
by its relative ascender-minus-descender also checks vertical em scale. This
catches vertical compression that leaves the trace's font-size field unchanged.
The reconstructed vertical metric allows 0.0001 point for floating-point error;
reported trace/span sizes still require at least seven points. This measures
font em scale, not visible glyph ink height or readability. Nonhorizontal or
vertical writing requires a separately validated contract and fails
INTERIOR_TEXT_TRANSFORM_UNSUPPORTED. No text is resized or reapproved here.

Sources, checked October20, 2026: KDP submission specifications above, and
[PyMuPDF text traces](https://pymupdf.readthedocs.io/en/latest/functions.html#Page.get_texttrace)
and [span metrics](https://pymupdf.readthedocs.io/en/latest/textpage.html#span-dictionary).
The metrics cannot prove font licensing, appropriate typography, complex-script
shaping, substantive content or editorial quality. Genuine templates, calibrated
independent review and actual KDP preview/print acceptance remain required.
Publication stays disabled.

## Delivered interior font embedding

Independent KDP QA requires every referenced interior font resource to contain
a decodable TrueType program. This intentionally includes unused references;
text display names cannot reliably identify the underlying PDF font resource.
The renderer now initializes its canvas with the verified font, avoiding
ReportLab's unused default Helvetica reference. No PDF is cleaned, rewritten or
substituted by the inspector. Existing valid text/layout errors retain precedence.

Unembedded Base-14/Type3 fallback fonts fail INTERIOR_FONT_EMBEDDING_REQUIRED.
The supported TrueType subset accepts ttf programs exposed as TrueType or Type0,
checks their signature and decoder glyph count, and rejects malformed programs
as INTERIOR_FONT_EMBEDDING_INVALID. Font objects are checked once per document,
with at most32 distinct resources,16MiB per extracted program and32MiB total.
These are admission bounds after parser/extraction, not a general PDF decompression
sandbox or measured production capacity. Other font formats need a separate
validated contract.

Source requirements and parser behavior, checked October20, 2026:
[KDP submission specifications](https://kdp.amazon.com/en_US/help/topic/G201857950)
and [PyMuPDF font extraction](https://pymupdf.readthedocs.io/en/latest/document.html#Document.extract_font).
A valid embedded subset alone does not prove its source identity, licence,
commercial-use permission, correct glyph shaping, readability or editorial
quality. The separate source-identity gate below binds its visible glyphs to the
authenticated original bytes. Keep actual source-font rights and independent
review separate. Publication remains disabled.

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
| manuscript_sha256 | SHA-256 of canonical original pages JSON independently reviewed by this evaluator |
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


## Independent no-bleed margin floors

Independent package QA now validates the declared interior margins before actual
PDF text bounds. For the supported paperback/no-bleed path, the gutter minimum
is 0.375 / 0.5 / 0.625 / 0.75 / 0.875 inch in the five page-count bands above.
Outside, top and bottom each require at least 0.25 inch. Values must be finite
primitive numbers, and each opposing pair must leave usable page area. Missing,
boolean, nonnumeric or undersized values fail INTERIOR_MARGIN_SPEC_INVALID.

The existing actual-PDF inspector then enforces the declared rectangle on every
page, including mirrored inside/outside margins. A rebound receipt, artifact hash
or synthetic approval cannot lower the minimum. No margin is automatically
increased, manuscript reflowed or new approval manufactured. Corrected inputs
require a new immutable task and current authority for its hash.

Source: [KDP submission specifications](https://kdp.amazon.com/en_US/help/topic/G201857950),
checked October 20, 2026. Low-level renderer/geometry helpers still allow small
technical fixtures; production package QA requires the full supported pair.
Regional print-option ceilings, genuine official templates, actual editorial and
rights review, print quality and observed KDP preview acceptance remain separate.
Both publication flags remain false.


## Original manuscript identity during independent QA

KDP QA requires --manuscript with the original pages JSON from the authorized
immutable task, not text reconstructed from the produced PDF or its receipt.
It captures one regular non-symlink input under the existing 4 MiB strict UTF-8
JSON limit. Duplicate keys, nonfinite numbers, malformed pages/lines and a page
count different from the signed interior specification fail closed. Every
actual delivered PDF page must extract to exactly the original line sequence;
substituted, reordered, added or missing text fails MANUSCRIPT_TEXT_MISMATCH.
The existing static PDF, visibility, clipping, font and geometry gates remain.

The host-owned reviewPackage callback receives that original path as
options.manuscript for KDP (alongside its existing cancellation signal). The
callback must actually inspect it and the completed PDF; the path is not approval.
The independent editorial authority must review those original pages and bind
manuscript_sha256 to SHA-256 of their pod_common.canonical representation, in
addition to the exact package and interior hashes. QA records that identity and
requires checks.manuscript_provenance to be boolean true. Database completion,
review acceptance and release validation require the same KDP-only bit. Existing
receipts without it must undergo fresh review; never backfill the bit or invent
a signature. The existing current evaluator, signature and final expiry checks
still cap the passing receipt. Non-KDP contracts remain unchanged.

Text equality is not original authorship, legal clearance, correct glyph shapes,
substantive editorial quality, independent reviewer calibration or KDP preview/
print acceptance. Source-font identity and licensing remain separate checks.
Synthetic tests cannot approve a manuscript. Both publication flags remain false
and all 24 live acceptance areas remain open.




## Original interior font source identity

KDP QA now requires `--font` with the original TTF from the authorized immutable
task. It reads one regular non-symlink file into a bounded 16 MiB snapshot and
requires its SHA-256 to equal `font_sha256` in the signed interior template.
Missing, changed, empty, oversized, non-TrueType or undecodable sources fail
before identity can pass.

The delivered PDF must contain exactly one referenced TrueType font resource in
this supported renderer contract. Requiring one resource prevents an unused
matching font from masking a different active resource because PyMuPDF's text
trace exposes Unicode and glyph ID but not the PDF resource name. FontTools
decomposes each actual traced glyph from both programs. Units per em, horizontal
header metrics, per-glyph advance/side bearing and the complete decomposed outline
must match the authenticated source for every distinct delivered character/glyph
pair. QA records the source SHA-256 and requires `checks.source_font` for KDP.
The production worker passes the task-owned font path; non-KDP contracts are
unchanged.

This is evidence that the delivered glyph programs and metrics came from the
specified source bytes. It does not prove a license, commercial-use permission,
correct complex-script shaping, typography, editorial quality or KDP acceptance.
Those remain separate current rights/review/platform gates. Multiple resources,
other font formats or shaping contracts require separate implementation and
validation rather than inference. Publication remains disabled.


## Current font-rights and retained-license gate

KDP QA separately requires a current `pod:font-rights` grant and the retained
license-evidence bytes that it hashes. The grant is bound to the authenticated
font SHA-256, exact task country/product, commercial use, print-on-demand use,
font embedding, revocation state, licensor and license ID. See `FONT_RIGHTS.md`
for the stored-task fields and fail-closed contract. This is attributable current
technical evidence, not a legal conclusion or live Amazon acceptance. Publication
remains disabled.
