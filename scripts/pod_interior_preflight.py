"""Independent geometry inspection for the supported text-only, no-bleed interior.

This reads the delivered PDF; a renderer receipt is not evidence of these checks.
It does not assess editorial quality, licensing or official platform acceptance.
"""
import math
import fitz
from pod_pdf_policy import inspect_static_document, inspect_static_page


def inspect_pairing(spec, cover):
    """Check the supported paperback pair without trusting assembly receipts.

    KDP G201857950, checked 2026-10-20: paper-specific spine factors,
    0.125-inch bleed and even physical page count. This renderer does not pad
    odd manuscripts. Regional option limits and genuine template provenance
    remain separate admission requirements, not facts established by this PDF.
    """
    def positive(value, zero=False):
        return (type(value) in (int,float) and math.isfinite(value) and
                (value >= 0 if zero else value > 0))

    try:
        kdp=cover['kdp']
        trim=spec['trim_inches'];size=cover['size_inches']
        paper=spec.get('paper_type')
        factors={'white':.002252,'cream':.0025,'groundwood':.00235}
        if (spec['platform']!='kdp' or cover['platform']!='kdp' or
                spec.get('binding')!='paperback' or kdp.get('binding')!='paperback' or
                spec.get('ink_type')!='black' or kdp.get('ink_type')!='black' or
                type(paper) is not str or paper not in factors or kdp.get('paper_type')!=paper or
                type(spec['page_count']) is not int or type(kdp['page_count']) is not int or
                not 24<=spec['page_count']<=828 or spec['page_count']%2!=0 or
                spec['page_count']!=kdp['page_count'] or
                not isinstance(trim,list) or not isinstance(size,list) or
                len(trim)!=2 or len(size)!=2 or any(not positive(v) for v in (*trim,*size)) or
                not 4<=trim[0]<=8.5 or not 6<=trim[1]<=11.69 or
                not positive(kdp['trim_width_inches']) or
                not positive(kdp['spine_width_inches']) or
                not positive(kdp['bleed_inches']) or kdp['bleed_inches']!=.125):
            raise ValueError('COVER_INTERIOR_MISMATCH')
        # Independent no-bleed margin admission before inspecting actual PDF
        # text bounds. KDP G201857950, checked 2026-10-20. A passing receipt
        # or undersized declared safe rectangle cannot lower these minima.
        margins=spec.get('margins_inches')
        minimum=(.375 if spec['page_count']<=150 else .5 if spec['page_count']<=300
                 else .625 if spec['page_count']<=500 else .75 if spec['page_count']<=700 else .875)
        if (not isinstance(margins,dict) or
                any(not positive(margins.get(key)) for key in ('inside','outside','top','bottom')) or
                margins['inside']<minimum or min(margins[key] for key in ('outside','top','bottom'))<.25 or
                margins['inside']+margins['outside']>=trim[0] or
                margins['top']+margins['bottom']>=trim[1]):
            raise ValueError('INTERIOR_MARGIN_SPEC_INVALID')
        expected_width=2*trim[0]+kdp['spine_width_inches']+2*kdp['bleed_inches']
        expected_height=trim[1]+2*kdp['bleed_inches']
        if (abs(trim[0]-kdp['trim_width_inches'])>1e-6 or
                abs(kdp['spine_width_inches']-spec['page_count']*factors[paper])>1e-6 or
                abs(size[0]-expected_width)>1e-6 or abs(size[1]-expected_height)>1e-6):
            raise ValueError('COVER_INTERIOR_MISMATCH')
    except (KeyError,TypeError,OverflowError):
        raise ValueError('COVER_INTERIOR_MISMATCH') from None
    return True


def inspect_manuscript(path, manuscript, spec):
    """Compare delivered page text to one bounded original JSON capture.

    The caller must bind the returned canonical hash to a current independent
    editorial attestation. Equality is not originality or editorial approval.
    """
    from pod_common import read_json, canonical
    import hashlib
    if manuscript is None:
        raise ValueError('MANUSCRIPT_REQUIRED')
    pages=read_json(manuscript)
    if (not isinstance(pages,list) or len(pages)!=spec['page_count'] or
            not 1<=len(pages)<=1000 or any(
                not isinstance(page,dict) or not isinstance(page.get('lines'),list) or
                not page['lines'] or any(type(line) is not str or '\n' in line
                                        for line in page['lines']) for page in pages)):
        raise ValueError('MANUSCRIPT_INVALID')
    manuscript_sha256=hashlib.sha256(canonical(pages).encode()).hexdigest()
    with fitz.open(path) as book:
        if len(book)!=len(pages):
            raise ValueError('MANUSCRIPT_TEXT_MISMATCH')
        for page,original in zip(book,pages):
            if page.get_text().splitlines()!=original['lines']:
                raise ValueError('MANUSCRIPT_TEXT_MISMATCH')
    return manuscript_sha256


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
        font_pages=[]
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
                # KDP G201857950 (checked 2026-10-20) requires at least 7pt.
                # Inspect delivered text, not the template or renderer receipt.
                if not number(trace.get('size')) or trace['size'] < 7:
                    raise ValueError('INTERIOR_FONT_SIZE_INVALID')
                # A ToUnicode map can yield the expected text even when the
                # font actually draws .notdef. Inspect delivered glyph IDs,
                # not Unicode values (a real U+FFFD glyph can be intentional).
                # MuPDF's -1 ligature continuation is not a missing glyph.
                if any(char[1] == 0 for char in trace['chars']):
                    raise ValueError('INTERIOR_GLYPH_MISSING')
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
                    # The current renderer emits horizontal text. Other writing
                    # directions need a separately validated metric contract.
                    if line.get('wmode') != 0 or line.get('dir') != (1, 0):
                        raise ValueError('INTERIOR_TEXT_TRANSFORM_UNSUPPORTED')
                    for span in line['spans']:
                        if not within(span['bbox']):
                            raise ValueError('INTERIOR_TEXT_BOUNDS_FAILED')
                        # A trace's size can remain 12pt after 50% vertical
                        # compression. TextPage bbox/ascender/descender expose
                        # that delivered vertical scale for this horizontal
                        # native-text subset. This is em size, not glyph ink
                        # height or a readability score. Allow 0.0001pt only for
                        # coordinate/metric floating-point reconstruction.
                        a, d = span.get('ascender'), span.get('descender')
                        if (not number(span.get('size')) or span['size'] < 7 or
                                not number(a) or not number(d) or a <= d or
                                (span['bbox'][3]-span['bbox'][1])/(a-d) < 7-.0001):
                            raise ValueError('INTERIOR_FONT_SIZE_INVALID')
            # The current contract is text-only. Images, drawings, forms and
            # annotations require a separate supported contract and validation.
            # Ordinary drawings omit clipping paths. A clip may remove part of
            # a line (or an entire line beside visible text) while text traces
            # still report black, in-bounds glyphs. Even a full-page scissor can
            # contain an even-odd hole, so do not infer safety from clip bounds.
            if (page.get_images() or page.get_drawings() or
                    any(operation['type'] == 'clip'
                        for operation in page.get_drawings(extended=True)) or
                    next(page.annots(), None) is not None or next(page.widgets(), None) is not None):
                raise ValueError('INTERIOR_CONTENT_UNSUPPORTED')
            font_pages.append(page.number)
        # Inspect every referenced resource, even if unused. Display names do
        # not identify PDF font resources reliably. No Base-14 fallback or
        # ambiguous name-to-resource inference is allowed in this TTF subset.
        # KDP G201857950 / PyMuPDF Document.extract_font, checked 2026-10-20.
        checked=set();total_font_bytes=0
        for page_number in font_pages:
            for font in book[page_number].get_fonts(full=True):
                xref=font[0]
                if xref in checked:
                    continue
                if type(xref) is not int or xref<=0 or len(checked)>=32:
                    raise ValueError('INTERIOR_FONT_EMBEDDING_INVALID')
                checked.add(xref)
                _,ext,kind,_=book.extract_font(xref,info_only=True)
                if ext=='n/a':
                    raise ValueError('INTERIOR_FONT_EMBEDDING_REQUIRED')
                if ext!='ttf' or kind not in ('TrueType','Type0'):
                    raise ValueError('INTERIOR_FONT_EMBEDDING_INVALID')
                data=book.extract_font(xref)[3]
                total_font_bytes+=len(data)
                if (not data or len(data)>16*1024*1024 or total_font_bytes>32*1024*1024 or
                        data[:4] not in (b'\x00\x01\x00\x00',b'true')):
                    raise ValueError('INTERIOR_FONT_EMBEDDING_INVALID')
                try:
                    parsed=fitz.Font(fontbuffer=data)
                    if parsed.glyph_count<=0:
                        raise ValueError()
                except Exception:
                    raise ValueError('INTERIOR_FONT_EMBEDDING_INVALID') from None
        if not checked:
            raise ValueError('INTERIOR_FONT_EMBEDDING_REQUIRED')
    return True
