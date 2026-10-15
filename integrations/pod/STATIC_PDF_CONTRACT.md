# Static generated PDF contract

The supported KDP lane emits a lossless raster cover and black-text, no-bleed
interior. Independent preflight inspects delivered PDF dictionaries before page
extraction/rasterization. Both formats reject encryption (including an empty user
password), document open/additional actions, name trees, forms, outlines, optional
content, portfolio collections, associated files and page actions/annotations.
Rejecting the complete unsupported structure includes indirect and escaped PDF
names; this is not a substring scan of manuscript text or metadata. Links,
attachments and unrecognized annotation types cannot evade high-level iterators.

Interior traces must use opaque filled black gray/RGB text. White-on-white text
can still extract perfectly, so successful extraction alone is insufficient.
Colored/gray interiors require a separately implemented and tested contract;
they are not silently accepted by this renderer. Existing bounds, actual text,
page pairing, exact cover pixels and independent signed editorial/comparative
review checks remain required.

This bounded print-subset policy is not a general PDF malware scanner, proof of
perfect rendering, legal clearance or marketplace approval. It does not remove or
rewrite unsupported content. A rejected package stays failed and must be rebuilt
and independently reviewed; publication remains disabled.

Validation uses actual ReportLab/PyMuPDF PDF files, including embedded files,
links, catalog/page JavaScript actions, owner-only encryption, indirect escaped
keys and unknown annotation types. Full QA tests rebind package/receipt hashes and
synthetic approvals to defective interiors to verify independent rejection.
No fixture approval constitutes production evidence.

Parser API references, checked 2026-10-15:
- https://pymupdf.readthedocs.io/en/latest/document.html#Document.xref_get_key
- https://pymupdf.readthedocs.io/en/latest/functions.html#Page.get_texttrace
