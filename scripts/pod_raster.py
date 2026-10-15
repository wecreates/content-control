"""Validate raster headers before allocating decoded pixels.

The ceiling is a safety bound, not a measured free-tier throughput guarantee.
All callers must use the yielded file object, not reopen the path after validation.
"""
from contextlib import contextmanager
import warnings
from PIL import Image

MAX_RASTER_PIXELS = 100_000_000


@contextmanager
def open_raster(path, expected_size=None):
    if expected_size is not None and (
            not isinstance(expected_size, (list, tuple)) or len(expected_size) != 2 or
            any(type(v) is not int or v <= 0 for v in expected_size)):
        raise ValueError('IMAGE_SIZE_MISMATCH')
    try:
        # Pillow's warning threshold is process-global and normally nonfatal.
        # Apply our explicit ceiling regardless of that warning configuration.
        with warnings.catch_warnings():
            warnings.simplefilter('ignore', Image.DecompressionBombWarning)
            image = Image.open(path)
    except Image.DecompressionBombError as exc:
        raise ValueError('IMAGE_PIXEL_LIMIT') from exc
    with image:
        w, h = image.size
        if min(w, h) <= 0 or w * h > MAX_RASTER_PIXELS:
            raise ValueError('IMAGE_PIXEL_LIMIT')
        if expected_size is not None and (w, h) != tuple(expected_size):
            raise ValueError('IMAGE_SIZE_MISMATCH')
        if getattr(image, 'n_frames', 1) != 1:
            raise ValueError('IMAGE_MULTIFRAME_UNSUPPORTED')
        yield image
