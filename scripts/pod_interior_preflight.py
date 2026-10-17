"""Independent geometry inspection for the supported text-only, no-bleed interior.

This reads the delivered PDF; a renderer receipt is not evidence of these checks.
It does not assess editorial quality, licensing or official platform acceptance.
"""
import math
import fitz
from pod_pdf_policy import inspect_static_document, inspect_static_page


def inspect_pairing(spec, cover):
    """Check physical cover/interior agreement without trusting assembly receipts."""
    def positive(value, zero=False):
        return (type(value) in (int,float) and math.isfinite(value) and
                (value >= 0 if zero else value > 0))

    try:
        kdp=cover['kdp']
        trim=spec['trim_inches'];size=cover['size_inches']
        if (spec['platform']!='kdp' or cover['platform']!='kdp' or
                type(spec['page_count']) is not int or type(kdp['page_count']) is not int or
                not 1<=spec['page_count']<=1000 or spec['page_count']!=kdp['page_count'] or
                len(trim)!=2 or len(size)!=2 or any(not positive(v) for v in (*trim,*size)) or
                not positive(kdp['trim_width_inches']) or
                not positive(kdp['spine_width_inches'],zero=True) or
                not positive(kdp['bleed_inches'],zero=True)):
            raise ValueError('COVER_INTERIOR_MISMATCH')
        expected_width=2*trim[0]+kdp['spine_width_inches']+2*kdp['bleed_inches']
        expected_height=trim[1]+2*kdp['bleed_inches']
        if (abs(trim[0]-kdp['trim_width_inches'])>1e-6 or
                abs(size[0]-expected_width)>1e-6 or abs(size[1]-expected_height)>1e-6):
            raise ValueError('COVER_INTERIOR_MISMATCH')
    except (KeyError,TypeError,OverflowError):
        raise ValueError('COVER_INTERIOR_MISMATCH') from None
    return True


def inspect_interior(path, spec):
    def number(value):
        return type(value) in (int, float) and math.isfinite(value)

    if spec.get('platform') != 'kdp' or spec.get('interior_type') != 'text_no_bleed':
        raise ValueError('INTERIOR_TEMPLATE_UNSUPPORTED')
    count = spec.get('page_count')
    trim = spec.get('trim_inches')
    if (type(count) is not int or not 1 <= count <= 1000 or
            not isinstance(trim, list) or len(trim) != 2 or
            any(not number(v) or not 1 <= v <= 20 for v in trim)):
        raise ValueError('INTERIOR_SPEC_INVALID')
    margins = spec.get('margins_inches', {})
    values = [margins.get(k) for k in ('inside', 'outside', 'top', 'bottom')]
    if any(not number(v) or v <= 0 for v in values):
        raise ValueError('INTERIOR_SPEC_INVALID')
    width, height = [v * 72 for v in trim]
    inside, outside, top, bottom = [v * 72 for v in values]
    if inside + outside >= width or top + bottom >= height:
        raise ValueError('INTERIOR_SPEC_INVALID')

    with fitz.open(path) as book:
        inspect_static_document(book, 'INTERIOR')
        if book.needs_pass or len(book) != count:
            raise ValueError('INTERIOR_INVALID')
        for index, page in enumerate(book):
            inspect_static_page(book, page, 'INTERIOR')
            expected = (0, 0, width, height)
            # This no-bleed subset has one full-page region. Text extraction
            # alone does not expose conflicting trim, bleed or art rectangles.
            if (page.rotation != 0 or any(
                    not math.isfinite(actual) or abs(actual - desired) > .01
                    for box in (page.mediabox, page.cropbox, page.rect,
                                page.trimbox, page.bleedbox, page.artbox)
                    for actual, desired in zip(box, expected))):
                raise ValueError('INTERIOR_PAGE_BOX_INVALID')
            left, right = (inside, outside) if index % 2 == 0 else (outside, inside)

            def within(box):
                x0, y0, x1, y1 = box
                return (all(number(v) for v in box) and x0 <= x1 and y0 <= y1 and
                        x0 >= left - .01 and x1 <= width - right + .01 and
                        y0 >= top - .01 and y1 <= height - bottom + .01)

            # Extraction alone can omit text outside the page. The display-list
            # trace also exposes those text operations and invisible text modes.
            traces = page.get_texttrace()
            if not traces or not page.get_text().strip():
                raise ValueError('INTERIOR_TEXT_REQUIRED')
            for trace in traces:
                if trace['type'] != 0 or trace['opacity'] != 1:
                    raise ValueError('INTERIOR_TEXT_NOT_VISIBLE')
                # The supported renderer emits black text on unpainted white
                # pages. Extraction succeeds even for invisible white text.
                # Color interiors require a separate validated contract.
                if (trace.get('colorspace') not in (1, 3) or
                        len(trace.get('color', ())) != trace['colorspace'] or
                        any(not number(v) or v != 0 for v in trace['color'])):
                    raise ValueError('INTERIOR_TEXT_COLOR_UNSUPPORTED')
                if not within(trace['bbox']):
                    raise ValueError('INTERIOR_TEXT_BOUNDS_FAILED')
            for block in page.get_text('dict')['blocks']:
                if block['type'] != 0:
                    raise ValueError('INTERIOR_CONTENT_UNSUPPORTED')
                for line in block.get('lines', []):
                    for span in line['spans']:
                        if not within(span['bbox']):
                            raise ValueError('INTERIOR_TEXT_BOUNDS_FAILED')
            # The current contract is text-only. Images, drawings, forms and
            # annotations require a separate supported contract and validation.
            if (page.get_images() or page.get_drawings() or
                    next(page.annots(), None) is not None or next(page.widgets(), None) is not None):
                raise ValueError('INTERIOR_CONTENT_UNSUPPORTED')
    return True
