"""Verify the delivered KDP cover against the exact reviewed print raster.

This is a technical check for the lossless raster-cover pipeline, not an
editorial approval or proof of platform acceptance.
"""
import math
import fitz
from PIL import Image, ImageChops
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
                next(page.widgets(), None) is not None or cover.embfile_count()):
            raise ValueError('COVER_CONTENT_UNSUPPORTED')
        pix = page.get_pixmap(matrix=fitz.Matrix(dpi / 72, dpi / 72),
                              colorspace=fitz.csRGB, alpha=False, annots=False)
        if (pix.width, pix.height) != image.size:
            raise ValueError('COVER_RASTER_SIZE_MISMATCH')
        raster = Image.frombytes('RGB', image.size, pix.samples)
        # An average error threshold can hide a missing glyph or local defect
        # on a large cover. The supported generator embeds lossless RGB pixels.
        if ImageChops.difference(raster, image).getbbox() is not None:
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
