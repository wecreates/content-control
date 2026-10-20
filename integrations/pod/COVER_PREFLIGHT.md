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
They do not establish spine text clearance, barcode reservation, print-mark
absence, regional availability, genuine template provenance, editorial approval
or KDP preview/print acceptance. Existing low-level review rendering remains
separate. Both publication flags remain false.
