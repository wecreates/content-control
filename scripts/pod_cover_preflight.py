"""Verify the delivered KDP cover against the exact reviewed print raster.

This is a technical check for the lossless raster-cover pipeline, not an
editorial approval or proof of platform acceptance.
"""
import math
import fitz
from PIL import Image, ImageChops


def inspect_cover(path, image, dpi):
    if (type(dpi) is not int or not 300 <= dpi <= 1200 or
            image.mode != 'RGB' or min(image.size) <= 0 or
            image.width * image.height > 100_000_000):
        raise ValueError('COVER_SPEC_INVALID')
    expected = (0, 0, image.width * 72 / dpi, image.height * 72 / dpi)
    with fitz.open(path) as cover:
        if cover.needs_pass or len(cover) != 1:
            raise ValueError('COVER_INVALID')
        page = cover[0]
        # Check boxes before rasterization so malformed dimensions cannot
        # allocate an arbitrarily large render. Cropping/rotation are unsupported.
        if (page.rotation != 0 or any(
                not math.isfinite(actual) or abs(actual - desired) > .01
                for box in (page.mediabox, page.cropbox, page.rect)
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
