"""Independent geometry inspection for the supported text-only, no-bleed interior.

This reads the delivered PDF; a renderer receipt is not evidence of these checks.
It does not assess editorial quality, licensing or official platform acceptance.
"""
import math
import hashlib
import io
import fitz
import re
import unicodedata
from pod_pdf_policy import inspect_static_document, inspect_static_page

MAX_FONT_BYTES = 16 * 1024 * 1024


def inspect_book_details(details_path, manifest, manuscript):
    """Bind the supported KDP files to one immutable book-details record.

    This verifies byte-bound task data against the produced cover and original
    manuscript. It does not prove that the same values were entered in KDP;
    account-side readback remains a separate live acceptance requirement.
    """
    from pod_common import read_json, canonical

    if details_path is None:
        raise ValueError('KDP_BOOK_DETAILS_REQUIRED')
    details = read_json(details_path)
    required_keys = {'schema_version', 'title', 'subtitle', 'author_name',
                     'language', 'isbn', 'imprint', 'title_page', 'edition',
                     'series', 'contributors'}

    def clean(value, limit):
        return (type(value) is str and 0 < len(value) <= limit and
                value == value.strip() and '\n' not in value and '\r' not in value and
                value == unicodedata.normalize('NFC', value) and value.isprintable())

    # KDP treats these as customer-facing metadata rather than arbitrary cover
    # copy. Reject values the current title/author guidance explicitly does not
    # accept, before comparing them with the immutable cover and manuscript.
    invalid_singletons = {'unknown', 'n/a', 'na', 'blank', 'none', 'null',
                          'not applicable'}

    def metadata_text(value, limit=200):
        return (clean(value, limit) and any(character.isalnum() for character in value) and
                value.casefold() not in invalid_singletons and
                re.search(r'</?[A-Za-z][^>]*>', value) is None)

    edition = details.get('edition') if isinstance(details, dict) else None
    series = details.get('series') if isinstance(details, dict) else None
    contributors = details.get('contributors') if isinstance(details, dict) else None
    edition_valid = (edition is None or
                     isinstance(edition, dict) and set(edition) == {'number', 'display_text'} and
                     type(edition.get('number')) is int and 1 <= edition['number'] <= 9999 and
                     metadata_text(edition.get('display_text')))
    series_valid = (series is None or
                    isinstance(series, dict) and set(series) == {'title', 'display_text'} and
                    metadata_text(series.get('title')) and
                    metadata_text(series.get('display_text')))
    # KDP's ten-contributor total includes the primary author_name, leaving at
    # most nine additional ordered contributor records in this contract.
    contributors_valid = (isinstance(contributors, list) and len(contributors) <= 9 and
                          all(isinstance(contributor, dict) and
                              set(contributor) == {'role', 'name'} and
                              metadata_text(contributor.get('role'), 100) and
                              metadata_text(contributor.get('name'))
                              for contributor in contributors) and
                          len({contributor['name'].casefold() for contributor in contributors}) ==
                          len(contributors))

    if (not isinstance(details, dict) or set(details) != required_keys or
            details.get('schema_version') != 2 or
            not metadata_text(details.get('title')) or
            not metadata_text(details.get('author_name')) or
            details.get('language') != 'en' or
            details.get('subtitle') is not None and not metadata_text(details['subtitle']) or
            len(details.get('title', '')) + len(details.get('subtitle') or '') > 200 or
            details.get('isbn') is not None and not clean(details['isbn'], 32) or
            details.get('imprint') is not None and not clean(details['imprint'], 200) or
            type(details.get('title_page')) is not int or details['title_page'] not in (1, 3) or
            not edition_valid or not series_valid or not contributors_valid):
        raise ValueError('KDP_BOOK_DETAILS_INVALID')
    try:
        template = manifest['template']
        kdp = template['kdp']
        if (manifest['platform'] != 'kdp' or template['platform'] != 'kdp' or
                kdp.get('locale') != 'en_US' or kdp.get('reading_direction') != 'left_to_right'):
            raise ValueError('KDP_BOOK_DETAILS_INVALID')
        layers = manifest['expected_text']
        if not isinstance(layers, list):
            raise ValueError('KDP_BOOK_DETAILS_INVALID')
        dpi = template['dpi']; trim = kdp['trim_width_inches']
        spine = kdp['spine_width_inches']; bleed = kdp['bleed_inches']
        inches = template['size_inches']
        if (type(dpi) is not int or not 300 <= dpi <= 1200 or
                not isinstance(inches, list) or len(inches) != 2 or
                any(type(value) not in (int, float) or not math.isfinite(value) or value <= 0
                    for value in (trim, spine, bleed, *inches))):
            raise ValueError('KDP_BOOK_DETAILS_INVALID')
        width, height = inches
        # The supported LTR cover places the front to the right of the back and
        # spine. Metadata must be explicit front-cover text, at least 0.125 in
        # inside the trim as required by KDP, rather than incidental back copy.
        front = ((bleed + trim + spine + .125) * dpi, (bleed + .125) * dpi,
                 (width - bleed - .125) * dpi, (height - bleed - .125) * dpi)
        cover_fields = [details['title'], details['author_name']]
        if details['subtitle'] is not None:
            cover_fields.insert(1, details['subtitle'])
        if len(set(cover_fields)) != len(cover_fields):
            raise ValueError('KDP_BOOK_DETAILS_MISMATCH')
        for value in cover_fields:
            matches = [layer for layer in layers if isinstance(layer, dict) and layer.get('text') == value]
            if len(matches) != 1:
                raise ValueError('KDP_BOOK_DETAILS_MISMATCH')
            box = matches[0].get('box_px')
            if (not isinstance(box, list) or len(box) != 4 or
                    any(type(point) not in (int, float) or not math.isfinite(point) for point in box) or
                    box[0] < front[0] or box[1] < front[1] or
                    box[2] > front[2] or box[3] > front[3] or
                    box[0] >= box[2] or box[1] >= box[3]):
                raise ValueError('KDP_BOOK_DETAILS_MISMATCH')
    except (KeyError, TypeError, OverflowError):
        raise ValueError('KDP_BOOK_DETAILS_INVALID') from None

    pages = read_json(manuscript)
    if (not isinstance(pages, list) or details['title_page'] > len(pages) or
            any(not isinstance(page, dict) or not isinstance(page.get('lines'), list) or
                any(type(line) is not str for line in page['lines']) for page in pages)):
        raise ValueError('KDP_BOOK_DETAILS_MISMATCH')
    title_lines = [details['title']]
    if details['subtitle'] is not None:
        title_lines.append(details['subtitle'])
    title_lines.append(details['author_name'])
    if pages[details['title_page'] - 1].get('lines') != title_lines:
        raise ValueError('KDP_BOOK_DETAILS_MISMATCH')

    front_matter = [line for page in pages[:8] if isinstance(page, dict)
                    for line in page.get('lines', []) if type(line) is str]
    for field in ('isbn', 'imprint'):
        if details[field] is not None and front_matter.count(details[field]) != 1:
            raise ValueError('KDP_BOOK_DETAILS_MISMATCH')
    bound_front_matter = []
    if edition is not None:
        bound_front_matter.append(edition['display_text'])
    if series is not None:
        bound_front_matter.append(series['display_text'])
    bound_front_matter.extend(contributor['name'] for contributor in contributors)
    if (len(set(bound_front_matter)) != len(bound_front_matter) or
            any(front_matter.count(value) != 1 for value in bound_front_matter)):
        raise ValueError('KDP_BOOK_DETAILS_MISMATCH')
    placeholders = {'insert text here', 'insert chapter one text here',
                    'insert acknowledgements text here', 'insert author bio text here',
                    'type text', 'type here', 'placeholder text'}
    actual_text = [layer.get('text') for layer in manifest['expected_text']
                   if isinstance(layer, dict)] + [line for page in pages
                   if isinstance(page, dict) for line in page.get('lines', [])]
    if any(type(value) is str and value.strip().casefold() in placeholders for value in actual_text):
        raise ValueError('KDP_TEMPLATE_PLACEHOLDER')
    return hashlib.sha256(canonical(details).encode()).hexdigest()


def inspect_font_source(path, font_path, spec):
    """Bind every delivered glyph to the authenticated original TTF bytes.

    This proves the visible glyph programs and metrics came from the source
    whose SHA-256 is signed in the interior template. It does not establish
    that the source is licensed; rights evidence remains a separate gate.

    The supported renderer emits one TrueType subset. Requiring exactly one
    resource prevents an unused matching font from masking a different active
    resource when PyMuPDF's text trace does not expose the PDF resource name.
    """
    from fontTools.pens.recordingPen import DecomposingRecordingPen
    from fontTools.ttLib import TTFont
    from pod_common import open_regular_binary

    if font_path is None:
        raise ValueError('INTERIOR_FONT_SOURCE_REQUIRED')
    try:
        with open_regular_binary(font_path) as source_file:
            source_bytes = source_file.read(MAX_FONT_BYTES + 1)
    except OSError:
        raise ValueError('INTERIOR_FONT_SOURCE_INVALID') from None
    if not source_bytes or len(source_bytes) > MAX_FONT_BYTES:
        raise ValueError('INTERIOR_FONT_SOURCE_INVALID')
    if hashlib.sha256(source_bytes).hexdigest() != spec.get('font_sha256'):
        raise ValueError('INTERIOR_FONT_SOURCE_HASH_MISMATCH')

    try:
        source = TTFont(io.BytesIO(source_bytes), lazy=False,
                        recalcBBoxes=False, recalcTimestamp=False)
        if (source.sfntVersion != '\x00\x01\x00\x00' or
                not {'head', 'hhea', 'maxp', 'hmtx', 'cmap', 'glyf'}.issubset(source.keys())):
            raise ValueError()
        source_cmap = source.getBestCmap()
        if not source_cmap:
            raise ValueError()
    except Exception:
        raise ValueError('INTERIOR_FONT_SOURCE_INVALID') from None

    def outline(font, glyph_name):
        glyphs = font.getGlyphSet()
        pen = DecomposingRecordingPen(glyphs)
        glyphs[glyph_name].draw(pen)
        return pen.value

    try:
        with fitz.open(path) as book:
            resources = {}
            for page in book:
                for item in page.get_fonts(full=True):
                    resources[item[0]] = item
            if len(resources) != 1:
                raise ValueError('INTERIOR_FONT_RESOURCE_AMBIGUOUS')
            xref, item = next(iter(resources.items()))
            if item[1] != 'ttf' or item[2] not in ('TrueType', 'Type0'):
                raise ValueError('INTERIOR_FONT_SOURCE_MISMATCH')
            embedded_bytes = book.extract_font(xref)[3]
            if not embedded_bytes or len(embedded_bytes) > MAX_FONT_BYTES:
                raise ValueError('INTERIOR_FONT_SOURCE_MISMATCH')
            embedded = TTFont(io.BytesIO(embedded_bytes), lazy=False,
                              recalcBBoxes=False, recalcTimestamp=False)
            if (embedded.sfntVersion != source.sfntVersion or
                    not {'head', 'hhea', 'maxp', 'hmtx', 'glyf'}.issubset(embedded.keys()) or
                    embedded['head'].unitsPerEm != source['head'].unitsPerEm or
                    any(getattr(embedded['hhea'], field) != getattr(source['hhea'], field)
                        for field in ('ascent', 'descent', 'lineGap'))):
                raise ValueError('INTERIOR_FONT_SOURCE_MISMATCH')
            embedded_order = embedded.getGlyphOrder()
            checked = set()
            for page in book:
                for trace in page.get_texttrace():
                    for codepoint, glyph_id, *_ in trace['chars']:
                        pair = (codepoint, glyph_id)
                        if pair in checked:
                            continue
                        checked.add(pair)
                        if (type(codepoint) is not int or type(glyph_id) is not int or
                                codepoint not in source_cmap or
                                not 0 < glyph_id < len(embedded_order)):
                            raise ValueError('INTERIOR_FONT_SOURCE_MISMATCH')
                        source_name = source_cmap[codepoint]
                        embedded_name = embedded_order[glyph_id]
                        if (source['hmtx'][source_name] != embedded['hmtx'][embedded_name] or
                                outline(source, source_name) != outline(embedded, embedded_name)):
                            raise ValueError('INTERIOR_FONT_SOURCE_MISMATCH')
            if not checked:
                raise ValueError('INTERIOR_FONT_SOURCE_MISMATCH')
    except ValueError:
        raise
    except Exception:
        raise ValueError('INTERIOR_FONT_SOURCE_MISMATCH') from None
    return spec['font_sha256']


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
