# Bind QA to captured package bytes

Technical QA now copies the hash-verified package inputs and reference into a
private temporary workspace before OCR, raster, PDF or optional model inspection.
The manifest is already captured by the bounded JSON reader. Each artifact hash
is computed from the same bytes written to the workspace; reference hashing and
optional similarity inspection use the same captured reference. Replacing or
deleting an original path afterward cannot change what QA inspects.

Packages contain 1–32 flat generated filenames, at most 16 MiB per artifact and
64 MiB total. The reference has a separate 16 MiB limit. Reads use a regular-file
descriptor with no final-symlink following and a bounded read even if a file grows
after its size check. Invalid identities, escaped paths, oversized data and hash
mismatches fail closed before inspection. Temporary copies are removed on success
or failure. Nested filenames are unsupported by this generated-package contract.

JSON package members, currently the KDP interior technical receipt, are decoded
as strict UTF-8 before persistence. A leading BOM, duplicate decoded key at any
depth, nonfinite number or integer outside JavaScript's exact range fails as an
invalid artifact even when the supplied content hash matches. The KDP manifest
reader applies the same rules before comparing the stored receipt with its
authenticated embedded receipt. This prevents a custom caller from persisting an
ambiguous receipt by invoking the artifact reader without first reading a manifest.

This adds bounded temporary disk usage; it does not provide durable storage or
replace independent review. Current signed package rights, competitive review,
KDP editorial evidence and expiry checks still apply. No approval is manufactured,
publication remains disabled, and tests with synthetic signatures do not prove
live independent QA, print acceptance or measured production capacity.

Failed Python stages may expose only a fixed remediation reason from their
already bounded stdout. That diagnostic object now uses the same strict JSON
parser as authenticated envelopes, so duplicate decoded keys—including escaped
spellings—fail to the generic `PRODUCTION_BLOCKED` route instead of selecting a
different repair path. Stderr and arbitrary child text remain redacted. This is
deterministic failure routing, not evidence that remediation succeeded.

When the QA process exits nonzero, the worker also reads its signed payload with
that strict parser before accepting a `FAIL` diagnostic. Ambiguous inner verdict
keys are treated as `QA_PROCESS_RESULT_CONFLICT` and never reach the completion
transaction, even if an ordinary parser would select the later `FAIL` value.
The database still independently authenticates every unambiguous envelope.

## Review export response deadlines

The default HTTPS transport in `scripts/pod_review_export.py` enforces a
20-second wall-clock budget per response, in addition to the existing socket
timeout and byte ceilings. The timer surrounds opening the response, reading
headers/body and closing it; slow-drip bytes cannot renew the budget. Elapsed
monotonic time is checked before returning bytes, so a late completion cannot
be accepted merely because an alarm callback was delayed.

The bounded package-record body is decoded as strict UTF-8 and rejects duplicate
decoded object keys at every nesting level before a manifest or output directory
is accepted. Escaped spellings cannot override the requested job identity.

This synchronous CLI requires a POSIX main thread with an unused real-time
interval timer. Unsupported contexts fail before opening the network connection;
an existing alarm is never replaced. The previous signal handler is restored
and the temporary timer cleared after success/failure. Signal delivery depends
on the Python runtime and is not a process-isolation guarantee for arbitrary
uninterruptible native code. This is a per-request bound, not a whole-export
capacity measurement. A custom injected transport remains the caller's bounded
transport responsibility.

An artifact timeout removes the partial output directory through the existing
cleanup path. The CLI retains its redacted `REVIEW_EXPORT_FAILED` receipt, and
hash checks, HTTPS-only endpoints, redirect rejection, output overwrite protection
and publication restrictions remain unchanged. Local HTTP fixtures exercise
slow headers, slow-drip manifests/artifacts and a valid restore; they establish
neither live recovery nor independent approval.

The exporter also validates each downloaded member independently of the server:
PNG roles require the bounded signature/IHDR/IEND envelope, PDF roles require a
supported header and terminal EOF marker, and the KDP receipt must be a strict
UTF-8 JSON object within the shared depth/node and exact-integer bounds. A stale
or misconfigured server therefore cannot populate the review directory with
hash-correct malformed bytes. Failure removes the whole partial directory. These
checks are not full decoding or substantive independent product review.

The exporter creates the new review directory with mode `0700` and creates every
artifact plus `manifest.json` exclusively with mode `0600`. File creation also
refuses a final symlink where the host exposes that flag. A permissive reviewer
process umask therefore cannot make recovered proprietary artwork, manuscripts or
receipts readable by group/other users. This is local discretionary-access
hardening, not encryption, a defense against the same account/root, durable
backup evidence or proof of independent approval. A regression runs the exporter
under umask `000` and verifies the exact directory/file permission boundary.

Once the new review directory is opened, export failure cleanup compares its
held device/inode with the current output path before recursive removal. A moved
attempt can remain for manual recovery, while a concurrent replacement directory
or symlink is preserved. Cleanup denial keeps the original export failure and
adds `REVIEW_EXPORT_OUTPUT_CLEANUP_FAILED` instead of replacing the diagnostic.
Regressions exercise replacement and denied-cleanup behavior. This still is not
a same-user adversarial filesystem sandbox and cannot guarantee cleanup after a
process crash, `SIGKILL`, default `SIGTERM` or filesystem failure.


## Review generation failure recovery

The local review-package producer removes its newly created attempt directory
when a Python stage raises, including an interrupt delivered as an exception.
A corrected brief can retry the same destination without manually deleting a
partial source, cover, interior, manifest or result. Existing output paths still
fail before generation. Successful packages and REVIEW_REQUIRED receipts remain
in place; neither production nor publication is enabled.

New review attempts and their nested asset-package directories use mode `0700`.
Every generated PNG/PDF/JSON artifact is retained with mode `0600`, including
atomic JSON replacements, independent of a permissive process umask. The private
directories prevent group/other traversal while third-party encoders are writing;
their completed outputs are then restricted explicitly. This is discretionary-
access hardening, not encryption or protection from the same account/root.

Cleanup checks the opened attempt directory's device/inode against the current
path before removal. Holding the directory descriptor prevents inode reuse during
the attempt. A detected replacement directory or symlink is preserved; a moved
attempt may remain for manual investigation. Cleanup permission failures retain
the original stage error and add REVIEW_OUTPUT_CLEANUP_FAILED. This does not
provide atomic publication, a same-user adversarial filesystem sandbox, or cleanup
after process crashes, SIGKILL or default SIGTERM termination. Parent directories
created for the output path are not removed.

Eight regression tests cover the exact private tree under umask `000`, five late
stage failures followed by genuine reproducible rendering, corrected worker-font
input, KeyboardInterrupt, existing output/symlink protection, concurrent
replacements and denied cleanup. Fixtures are synthetic and supply no official-
template, rights, editorial or live evidence.


## Review CLI cancellation

The local Node review CLI uses the production worker's existing Python-stage
supervisor. SIGTERM and SIGINT abort generation, terminate the child's POSIX
process group, escalate to SIGKILL after five seconds and wait for settlement
before returning failure. A cooperative child exiting zero after cancellation
does not turn cancellation into success. A normally exiting parent that leaves
process-group descendants also fails after cleanup.

The four-minute stage deadline and forced false publication flags remain in
place. Combined stdout/stderr is bounded to 1 MiB; stdout is emitted only after
successful settlement, and failure prints REVIEW_GENERATION_FAILED without
forwarding child diagnostics. Input, font and destination paths are resolved
against the caller's working directory before the supervisor switches to the
repository root. Successful JSON output is preserved.

Seven real subprocess fixtures cover both cancellation signals, resistant
children/descendants, leftover descendants after zero exit, relative paths,
publication flags and diagnostic redaction. The shared supervisor retains its
own deadline and output-budget tests. These checks establish process lifecycle
behavior on POSIX, not live recovery, capacity or independent review. Abrupt
Node SIGKILL, descendants that escape the process group and adversarial processes
are outside this guarantee; default Python SIGTERM can still leave partial output
for manual recovery. No publication or marketplace readiness is granted.


## Original template evidence in independent KDP QA

KDP QA requires the original signed cover and interior template envelopes and the retained cover guide bytes. The worker passes these input paths with the authenticated product and country; a standalone invocation must supply `--product`, `--country`, `--cover-template`, `--interior-template` and `--template-source`. Package declarations or an earlier inspection report cannot replace these inputs. Other platform contracts are unchanged.

QA opens bounded regular files without following final symlinks, rejects malformed UTF-8, duplicate JSON keys and nonfinite numbers in both envelopes and authenticated payloads, and verifies the existing template key, audience, scope, current time and provenance assertions. It compares each signed template exactly with the package template, then independently hashes and inspects the actual retained guide against the signed paired paperback profile. No source URL is fetched. The captured original envelopes are verified again after comparative/editorial work, and a passing QA receipt cannot outlive either template approval.

The retained guide inspector still reports `source_authority_verified=false` and `production_template_approved=false`: technical inspection does not establish download origin or mint approval. Source provenance is asserted by the configured trusted signer. This path authenticates the original interior specification but does not inspect a separately retained official interior source artifact. Synthetic signing keys, product scope, source assertions and reviewers in tests are fixtures only. Actual official-template approval, regional rights, editorial/independent calibration, live acceptance and launch readiness remain open. Both publication flags remain false.

## Original artwork and independently derived layout

QA for all five POD platforms now requires `--source` and `--asset-rights` from
the original authorized task. The producer records the SHA-256 of its captured
source in the package. Independent QA captures at most 16 MiB of regular source
bytes without following a final symlink, authenticates the original asset-rights
envelope, and requires its source identity and the package identity to match.
Header validation and decoding use those same captured bytes. Ambiguous signed
JSON, nonfinite values, invalid UTF-8 and expired original rights fail closed.

QA derives native dimensions, fit, centering, placement and PPI from the actual
source and declared template. It reconstructs the supported LANCZOS/RGBA layout
independently in 128-row strips, checks the complete art alpha mask, and compares
all nontext output pixels with the expected source/background composition.
Text-mask pixels cannot hide original artwork. Existing OCR, geometry, font/PDF,
current package rights and independent comparative/editorial reviews remain
mandatory. Original asset rights are reverified after review work and cap the
passing receipt's lifetime. Missing original inputs or older packages without
source identity require fresh generation and QA; no old receipt is upgraded.

This verifies the existing deterministic renderer contract, not artistic merit,
source ownership or real-world license authority. Text pixels still require the
separate text/font and review checks; this does not independently render fonts.
Upscaling or manipulation before the signed source was captured is not detected
merely by its dimensions. Strip comparison avoids an extra full-size output
canvas, but the source and resized art still decode under existing pixel bounds;
this is not measured memory/capacity or free-tier throughput acceptance. Synthetic
rights in tests are fixtures only. Publication remains disabled and live approval,
rights, independent calibration, print acceptance and all 24 live areas stay open.


The backend's shared QA gate also requires `original_source=true` for every
platform and `template_provenance=true` alongside editorial approval for KDP.
Signed PASS receipts that omit or weaken those booleans fail at production
completion and the existing release boundary, even while their signatures and
expiry remain valid. Positive unit/database fixtures explicitly attest the new
checks; they remain synthetic and do not provide a live approval.

## Original text layers and font pixels

QA also requires the original `--text-layers` path and the task's `--asset-root`
when relative font paths use that root. It strictly captures the layers and
matches their canonical SHA-256 to the original signed asset-rights record before
reading fonts. Each font is a bounded regular-file capture whose actual hash
must match the original layer; decoding uses that same capture. A configured
asset root confines resolved font parents, with no final-symlink following.
This is a private-task workspace check, not an adversarial filesystem sandbox.

Independent QA derives expected text strings, font identities and bounding boxes
from those originals, reconstructs text masks and colored glyph pixels in the
existing strips, and compares all output pixels without text-mask exemptions.
Forged mask pixels cannot hide changed background or glyph colors. Existing OCR,
geometry, source/rights, template, PDF, comparative and editorial checks remain
mandatory. The shared backend requires explicit `text_provenance=true` for every
platform at production, review acceptance and release validation. Older QA
receipts do not satisfy this expanded contract.

The supported bound is 32 layers, 4,096 characters per layer and 16,384 total,
font sizes 1–4,096 pixels, 16 MiB per font and 32 MiB aggregate captured font
bytes. Unique decoded font/size inputs also share a 32 MiB budget; repeated
identical font/size instances reuse the capture and decoder. Layer JSON retains
the existing 4 MiB ceiling and strict duplicate/nonfinite/UTF-8 checks. These are
safety limits, not measured throughput or a license grant. Current original
asset rights still cap the passing receipt and are rechecked after review.

Tests use synthetic signed rights and installed fixture fonts. Matching pixels
does not establish legal font/asset authority, editorial quality, calibrated
independent review, CMYK/preview/print acceptance or capacity. Publication flags
remain false and all 24 live acceptance areas remain open.


## Shared Python evidence JSON boundary

All file inputs using pod_common.read_json and all authenticated payloads using
pod_common.verified reject duplicate decoded object keys at every depth, including
escaped spellings of the same key. NaN, Infinity and numeric overflow cannot be
accepted as evidence facts. This parser is also shared by the original-template,
source and text preflights; their specialized failure reasons remain unchanged.

The signed payload retains the existing 4 MiB bound, now measured as UTF-8 bytes
rather than characters. Envelope and signature types are checked explicitly; the
signature must be exactly 64 lowercase hexadecimal characters. HMAC verification
uses the original payload bytes before semantic parsing, without canonicalizing
or repairing them. Existing audience, schema, time, rights and review checks
remain mandatory. Unambiguous Unicode, arrays, finite numbers and valid existing
receipts preserve their semantics. Ambiguous inputs require corrected evidence
from the actual authority; no approval is rewritten or fabricated.

These parser tests use synthetic signatures only. They do not establish live
source/reviewer authority, rights, production acceptance or deployment. Both
publication flags remain false and all 24 live acceptance areas remain open.


## KDP interior output installation

The interior renderer encodes into a private 0600 temporary file in the output
parent, flushes and syncs it, and captures at most the existing 16 MiB object
ceiling plus one byte. Hashing and PDF text/page/geometry verification use that
same bounded byte capture before the requested output path becomes visible.
The complete PDF is installed by an atomic no-replace hard link, then its parent
directory is synced. A concurrent output or dangling final symlink fails with
OUTPUT_EXISTS instead of being followed or overwritten.

Encoding, file-sync, size and PDF-inspection failures remove the new temporary
file and leave no requested output. A failed directory sync after installation
retains the complete PDF without returning a successful receipt; it is not
removed because another process may already be using it. Temporary-file cleanup
is attempted on Python exceptions, not guaranteed after SIGKILL/process crashes
or filesystem failure. Parent directories created for output are retained. The
supported runtime needs same-filesystem hard links; unsupported filesystems fail
closed with no replacing-write fallback. This is not a same-user adversarial
filesystem sandbox or a durable backup/restore guarantee.

Deterministic PDF content, font snapshot verification, existing layout/text
checks and UNASSESSED editorial/false production/publication receipts remain.
Tests use fixture manuscripts/fonts only; they establish neither substantive
editorial quality, rights, independent calibration, live KDP print acceptance nor
measured capacity. Both publication flags remain false and all 24 live acceptance
areas remain open.


## Direct asset generation failure recovery

The asset generator now uses the same ownership-checked output-attempt guard as
the review-package producer. A failed font, PNG/mask/cover-PDF encoding, digest,
manifest write or Python interrupt removes only that newly created attempt, so a
corrected request can retry the same destination. Successful output and manifest
hashes remain in place and are not regenerated or approved automatically.

The shared guard holds the new directory descriptor and compares device/inode
identity before cleanup. Existing directories and symlinks fail before generation;
concurrent replacement directories/symlinks are preserved. A moved attempt can
remain for manual recovery. Cleanup denial preserves the original stage exception
and adds ASSET_OUTPUT_CLEANUP_FAILED for direct generation, or the existing
REVIEW_OUTPUT_CLEANUP_FAILED for review generation. No recursive cleanup targets
an unowned pre-existing output. This does not guarantee cleanup after SIGKILL,
process crashes, default SIGTERM or filesystem failure, does not remove newly
created parent directories, and is not an adversarial same-user filesystem sandbox
or atomic package installation/durable backup guarantee.

Tests exercise real PNG/PDF generation, all five platform font corrections,
late partial-output failures followed by exact hash-bound retries, interrupts,
existing outputs, concurrent replacements and denied cleanup. Their templates,
content and rights remain fixtures; this is not actual official-template,
editorial/independent-review, marketplace or print acceptance. Both publication
flags remain false and all 24 live acceptance areas remain open.


## Original manuscript identity during independent QA

KDP QA requires --manuscript with the original pages JSON from the authorized
immutable task, not text reconstructed from the produced PDF or its receipt.
It captures one regular non-symlink input under the existing 4 MiB strict UTF-8
JSON limit. Duplicate keys, nonfinite numbers, malformed pages/lines and a page
count different from the signed interior specification fail closed. Every
actual delivered PDF page must extract to exactly the original line sequence;
substituted, reordered, added or missing text fails MANUSCRIPT_TEXT_MISMATCH.
The existing static PDF, visibility, clipping, font and geometry gates remain.

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
print acceptance. An embedded font subset is not proven to be the licensed source
font by this check. Synthetic tests cannot approve a manuscript. Both publication
flags remain false and all 24 live acceptance areas remain open.


