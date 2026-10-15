# Exact KDP cover preflight

The supported generator embeds the RGB print raster losslessly into one PDF page. QA now renders that delivered page at the declared print DPI and requires equality for every RGB pixel. A global mean-error threshold is not sufficient: a missing detail or a single altered pixel can have mean error below one on a large cover.

Before rendering, preflight checks the page count, password protection, unrotated MediaBox/CropBox/page dimensions, supported DPI and 100-million-pixel bound. It rejects interactive annotations, links, widgets and embedded attachments. Raster dimensions must also match. These checks prevent unsupported page transformations from being accepted just because an image looks approximately similar.

The page-box tolerance is 0.01 point for PDF coordinate serialization only; it does not permit any pixel difference. Other PDF producers or lossy encodings may fail this strict contract and require a separately validated pipeline. There is no automatic relaxation, QA approval or conversion on failure. Existing independent rights, comparative and editorial review remain required.

Tests use real ReportLab PDFs and PyMuPDF rendering at 300, 600 and 1,200 DPI, including fractional point sizes, one-channel pixel changes, missing details, one-pixel displacement, cropping, rotation, oversized pages and interactive content. A package-level test rebinds the altered PDF and manifest hashes with synthetic evidence and still requires a binary QA failure. These fixtures do not establish KDP preview acceptance or live print quality.
