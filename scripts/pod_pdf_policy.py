"""Reject unsupported document behavior in the generated static print subset.

This is a print contract check, not a general-purpose PDF malware scanner.
It inspects parsed dictionaries; literal text containing PDF names is harmless.
"""


def inspect_static_document(document, prefix):
    if (not document.is_pdf or document.needs_pass or
            document.xref_get_key(-1, 'Encrypt')[0] != 'null'):
        raise ValueError(prefix + '_INVALID')
    catalog = document.pdf_catalog()
    # Our generators emit none of these. Reject the entire structure rather
    # than trying to execute, sanitize or partially interpret actions/name trees.
    unsupported = ('OpenAction', 'AA', 'AcroForm', 'Names', 'Outlines',
                   'OCProperties', 'Collection', 'AF')
    if (document.embfile_count() or any(
            document.xref_get_key(catalog, key)[0] != 'null'
            for key in unsupported)):
        raise ValueError(prefix + '_CONTENT_UNSUPPORTED')


def inspect_static_page(document, page, prefix):
    # Checking the dictionary also rejects annotation subtypes that high-level
    # annots()/widgets()/get_links() iterators do not expose.
    if any(document.xref_get_key(page.xref, key)[0] != 'null'
           for key in ('AA', 'Annots', 'AF', 'PresSteps')):
        raise ValueError(prefix + '_CONTENT_UNSUPPORTED')
