# Exact KDP cover preflight

The supported generator embeds the RGB print raster losslessly into one PDF page. QA now renders that delivered page at the declared print DPI and requires equality for every RGB pixel. A global mean-error threshold is not sufficient: a missing detail or a single altered pixel can have mean error below one on a large cover.

Before rendering, preflight checks the page count, password protection, unrotated MediaBox/CropBox/page dimensions, supported DPI and 100-million-pixel bound. It rejects interactive annotations, links, widgets and embedded attachments. Raster dimensions must also match. These checks prevent unsupported page transformations from being accepted just because an image looks approximately similar.

The page-box tolerance is 0.01 point for PDF coordinate serialization only; it does not permit any pixel difference. Other PDF producers or lossy encodings may fail this strict contract and require a separately validated pipeline. There is no automatic relaxation, QA approval or conversion on failure. Existing independent rights, comparative and editorial review remain required.

Tests use real ReportLab PDFs and PyMuPDF rendering at 300, 600 and 1,200 DPI, including fractional point sizes, one-channel pixel changes, missing details, one-pixel displacement, cropping, rotation, oversized pages and interactive content. A package-level test rebinds the altered PDF and manifest hashes with synthetic evidence and still requires a binary QA failure. These fixtures do not establish KDP preview acceptance or live print quality.


## Outer-edge safety in production and QA

KDP's submission specifications, checked October20, 2026, require content that
must survive trimming to stay at least0.25 inch from the outside cover edge:
https://kdp.amazon.com/en_US/help/topic/G201857950

The signed KDP safe_box_px must stay inside that inset before production starts.
The Node gate uses ceil(0.25*dpi) for left/top and floor((size_inches-0.25)*dpi)
for exclusive right/bottom bounds. Declared physical size controls the limit;
the raster's ceil-rounded extra fraction of a pixel cannot enlarge the safe area.
A violation returns TEMPLATE_SAFE_ZONE_INVALID. Corrected inputs need a new
immutable task and fresh authority for its hash; no layout is silently moved.

Python QA independently enforces the same declared inset, then checks every
text-mask pixel and every critical-art-mask pixel inside the safe box. Explicit boolean-false
noncritical background art may bleed; text remains constrained. Malformed critical-art
flags fail KDP admission/geometry instead of being coerced. Existing mask
hashes, exact cover raster/PDF comparison, rights and independent review still
apply. A signed template or rebound package hash cannot extend the safe area into that inset.
The renderer does not infer which source art is critical or classify marks.

These are necessary outer-edge checks, not complete official-template geometry.
On their own they do not establish spine text clearance, barcode reservation, print-mark
absence, regional availability, genuine template provenance, editorial approval
or KDP preview/print acceptance. Existing low-level review rendering remains
separate. Both publication flags remain false.


## Spine text and fold clearance

Independent package QA checks the captured text mask after cover/interior pairing.
KDP permits spine text only above 79 pages; this even-page pipeline therefore
requires at least 80 pages. Spine text must stay at least 0.0625 inch inside each
spine edge. The pipeline also reserves 0.0625 inch on the front/back side of
each fold for KDP's stated binding variance. Below 80 pages, the whole spine
and both fold-clearance strips must contain no text-mask pixels.

Fold coordinates come from the paired bleed, back-cover width and spine width.
Allowed intervals round inward: floor for back/spine right boundaries and ceil
for spine/front left boundaries. The fractional pixel padding in the raster
cannot grant clearance. Any nonzero text-mask pixel in a forbidden strip fails
COVER_SPINE_TEXT_INVALID; malformed geometry/masks fail COVER_SPINE_SPEC_INVALID.
Blank strips and exact inward boundaries remain valid. A too-narrow spine has
no allowed text interval. Existing outer-edge, mask/hash, OCR, PDF equality and
independent review requirements still apply.

Source: [KDP spine text and fold variance](https://kdp.amazon.com/en_US/help/topic/G201857950),
checked October 20, 2026. This is a technical check of declared mask pixels;
it does not discover unlabelled text in art, rotate/resize typography, import an
official calculator template, approve barcode placement or establish actual
print registration. The full-cover raster remains lossless. Corrected immutable
inputs require fresh authority. Publication remains disabled.


## Amazon-placed barcode reservation

The supported LTR paperback path now requires signed cover.kdp.barcode_mode to
be exactly amazon_placed. Missing/other modes fail KDP_BARCODE_MODE_UNSUPPORTED
before guide inspection or generation. Existing tasks need a newly reviewed
immutable descriptor and fresh authority; no barcode choice is inferred or
approval rewritten. The pipeline creates no barcode or ISBN and never submits
a cover automatically. User-supplied barcodes need a separate validated path;
KDP's own-barcode rules require a distinct barcode object, which this single
raster-cover pipeline does not provide.

The retained official 6x9/24-page guide marks a yellow 2 by 1.2 inch rectangle
0.25 inch from the back-cover spine fold and bottom trim, beyond the 0.125 inch
bleed. Its observed PDF box is [279,552.5999755859375,423,639] points and physical
box is [3.875,7.675,5.875,8.875] inches. The offline inspector now requires one
opaque yellow rectangle at the profile-derived coordinates, checks its labels
and records these observed regions. Missing, shifted or duplicate regions fail
KDP_TEMPLATE_GUIDE_INVALID even when a caller recomputes the archive hash.
The original archive/member hashes and acquisition record are unchanged; the
inspection report is refreshed with these additional technical observations.

Independent QA derives this supported region from the paired physical geometry.
It expands forbidden bounds outward with floor(left/top) and ceil(right/bottom),
using exclusive right/bottom pixels. Every nonzero text-mask pixel and every
critical-art-mask pixel inside fails COVER_BARCODE_CONTENT_INVALID. Explicit
boolean-false background art may occupy the region, as the retained guide
instructs; text is always prohibited. Invalid geometry, direction, mask shape
or critical-art flags fail COVER_BARCODE_SPEC_INVALID. Existing hash binding,
whole-art OCR, exact raster/PDF equivalence and independent reviews still apply.

References checked October 20, 2026:
https://kdp.amazon.com/en_US/help/topic/G5HDYGP4BXLX4RUW
and integrations/pod/templates/kdp/2026-10-20/readme.txt inside the original ZIP.
This is a necessary check of declared masks and one supported guide layout. It
does not identify unlabelled important content or barcode pixels in background
art, scan/validate an ISBN, prove provider placement, handle RTL/custom barcode
layouts, establish CMYK/press quality or constitute preview/print acceptance.
The signer/independent reviewer still owns content classification and current
source approval. Publication remains disabled and live acceptance remains open.
