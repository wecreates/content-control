"""Verify the delivered KDP cover against the exact reviewed print raster.

The supported KDP pipeline embeds one profile-free DeviceCMYK raster. This is
a technical check, not an editorial approval or proof of platform acceptance.
"""
import math
import fitz
from pod_pdf_policy import inspect_static_document, inspect_static_page


def inspect_cover(path, image, dpi):
    if (type(dpi) is not int or not 300 <= dpi <= 1200 or
            image.mode != 'RGB' or min(image.size) <= 0 or
            image.width * image.height > 100_000_000):
        raise ValueError('COVER_SPEC_INVALID')
    expected = (0, 0, image.width * 72 / dpi, image.height * 72 / dpi)
    with fitz.open(path) as cover:
        inspect_static_document(cover, 'COVER')
        if cover.needs_pass or len(cover) != 1:
            raise ValueError('COVER_INVALID')
        page = cover[0]
        inspect_static_page(cover, page, 'COVER')
        # Check boxes before rasterization so malformed dimensions cannot
        # allocate an arbitrarily large render. Cropping/rotation are unsupported.
        # The generated raster PDF has no separate print regions. Optional print
        # boxes must agree too, even though they do not change preview pixels.
        if (page.rotation != 0 or any(
                not math.isfinite(actual) or abs(actual - desired) > .01
                for box in (page.mediabox, page.cropbox, page.rect,
                            page.trimbox, page.bleedbox, page.artbox)
                for actual, desired in zip(box, expected))):
            raise ValueError('COVER_PAGE_BOX_INVALID')
        if (page.get_links() or next(page.annots(), None) is not None or
                next(page.widgets(), None) is not None or cover.embfile_count() or
                any(cover.xref_get_key(page.xref,key)[0]!='null'
                    for key in ('Group','Metadata','PieceInfo','Dur','UserUnit')) or
                cover.xref_get_key(page.xref,'Trans') not in
                    (('null','null'),('dict','<<>>'))):
            raise ValueError('COVER_CONTENT_UNSUPPORTED')
        # The generator supports exactly one full-page raster and no text,
        # paths, clipping or other paint operations. A render-only comparison
        # would pass an RGB file after an implicit conversion and cannot prove
        # the submitted PDF actually uses the required single CMYK space.
        images=page.get_images(full=True)
        info=page.get_image_info(xrefs=True)
        paint=page.get_bboxlog()
        if (len(images)!=1 or len(info)!=1 or page.get_texttrace() or
                page.get_drawings() or len(page.get_contents())!=1 or
                len(paint)!=1 or paint[0][0]!='fill-image'):
            raise ValueError('COVER_CONTENT_UNSUPPORTED')
        entry=images[0]; details=info[0];xref=entry[0]
        if (entry[2:6]!=(image.width,image.height,8,'DeviceCMYK') or
                details.get('xref')!=xref or details.get('width')!=image.width or
                details.get('height')!=image.height or details.get('bpc')!=8 or
                details.get('colorspace')!=4 or details.get('cs-name')!='DeviceCMYK' or
                details.get('has-mask') is not False or
                cover.xref_get_key(xref,'ColorSpace')!=('name','/DeviceCMYK') or
                any(cover.xref_get_key(xref,key)[0]!='null'
                    for key in ('SMask','Mask','Alternates','Metadata','Decode',
                                'DecodeParms','Interpolate','Intent','OC','OPI',
                                'SMaskInData'))):
            raise ValueError('COVER_COLOR_SPACE_INVALID')
        # Decode the image object instead of accepting a color-managed
        # renderer's approximation. This detects a one-channel change while
        # binding the PDF directly to the reviewed RGB raster via the
        # generator's deterministic Pillow CMYK conversion.
        if cover.xref_stream(xref)!=image.convert('CMYK').tobytes():
            raise ValueError('COVER_PIXEL_MISMATCH')
        # ReportLab emits a tiny deterministic content stream. Constraining the
        # operators prevents an otherwise invisible clipping path or transform
        # from altering the delivered page while the image object stays exact.
        tokens=cover.xref_stream(page.get_contents()[0]).split()
        name=('/'+entry[7]).encode()
        if (len(tokens)!=25 or tokens[:15]!=[
                b'1',b'0',b'0',b'1',b'0',b'0',b'cm',b'BT',b'/F1',b'12',b'Tf',b'14.4',b'TL',b'ET',b'q'] or
                tokens[21]!=b'cm' or
                tokens[22:]!=[name,b'Do',b'Q']):
            raise ValueError('COVER_CONTENT_UNSUPPORTED')
        try:
            matrix=tuple(float(value) for value in tokens[15:21])
        except ValueError:
            raise ValueError('COVER_CONTENT_UNSUPPORTED') from None
        desired=(expected[2],0,0,expected[3],0,0)
        if (any(not math.isfinite(actual) or abs(actual-wanted)>0.01
                for actual,wanted in zip(matrix,desired)) or
                any(not math.isfinite(actual) or abs(actual-wanted)>0.01
                    for actual,wanted in zip(paint[0][1],expected))):
            raise ValueError('COVER_PIXEL_MISMATCH')
    return True


def inspect_barcode_region(template, art_mask, text_mask):
    """Protect declared critical content; do not generate or scan a barcode."""
    from pod_cover_regions import barcode_region_px
    canvas,box=barcode_region_px(template)
    critical=template.get('art_is_critical',True)
    if (type(critical) is not bool or art_mask.mode!='L' or text_mask.mode!='L' or
            art_mask.size!=canvas or text_mask.size!=canvas):
        raise ValueError('COVER_BARCODE_SPEC_INVALID')
    if (text_mask.crop(box).getbbox() is not None or
            (critical and art_mask.crop(box).getbbox() is not None)):
        raise ValueError('COVER_BARCODE_CONTENT_INVALID')
    return True


def inspect_spine_text(template, text_mask):
    """Check declared text-mask pixels in the supported full-cover geometry.

    Package QA calls this after independent cover/interior pairing. This does
    not discover unlabelled text or approve spine typography/official templates.
    """
    def number(value):
        return type(value) in (int, float) and math.isfinite(value) and value > 0

    try:
        dpi=template['dpi'];size=template['size_inches'];k=template['kdp']
        count=k['page_count'];width=k['trim_width_inches'];spine=k['spine_width_inches']
        bleed=k['bleed_inches']
        if (template['platform']!='kdp' or type(dpi) is not int or not 300<=dpi<=1200 or
                type(count) is not int or not 24<=count<=828 or count%2 or
                not isinstance(size,list) or len(size)!=2 or not all(number(v) for v in size) or
                not number(width) or not number(spine) or type(bleed) not in (int,float) or bleed!=.125 or
                abs(size[0]-(2*width+spine+2*bleed))>1e-6):
            raise ValueError('COVER_SPINE_SPEC_INVALID')
        expected=tuple(math.ceil(v*dpi) for v in size)
        if text_mask.mode!='L' or text_mask.size!=expected or expected[0]*expected[1]>100_000_000:
            raise ValueError('COVER_SPINE_SPEC_INVALID')
        # KDP G201857950, checked 2026-10-20: spine text only above 79
        # pages, .0625-inch inner clearance, and fold variance either side.
        # Expand forbidden strips outward, never into a raster rounding gap.
        left=(bleed+width)*dpi;right=(bleed+width+spine)*dpi;clearance=.0625*dpi
        back_end=math.floor(left-clearance);spine_start=math.ceil(left+clearance)
        spine_end=math.floor(right-clearance);front_start=math.ceil(right+clearance)
        if not 0<=back_end<front_start<=expected[0]:
            raise ValueError('COVER_SPINE_SPEC_INVALID')
        bands=([(back_end,front_start)] if count<80 or spine_start>=spine_end else
               [(back_end,spine_start),(spine_end,front_start)])
        for start,end in bands:
            if text_mask.crop((start,0,end,expected[1])).getbbox() is not None:
                raise ValueError('COVER_SPINE_TEXT_INVALID')
    except (KeyError,TypeError,AttributeError,OverflowError):
        raise ValueError('COVER_SPINE_SPEC_INVALID') from None
    return True
