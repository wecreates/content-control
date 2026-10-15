"""Bounded fixtures: oversized headers never allocate oversized raster buffers."""
import io
from pathlib import Path
import struct
import sys
import tempfile
import unittest
import warnings
from unittest.mock import patch
import zlib
from PIL import Image, ImageFile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from pod_asset_generator import generate
from pod_raster import MAX_RASTER_PIXELS, open_raster


def png_header(path, size):
    stream = io.BytesIO()
    Image.new('RGB', (1, 1)).save(stream, format='PNG')
    data = bytearray(stream.getvalue())
    data[16:24] = struct.pack('>II', *size)
    data[29:33] = struct.pack('>I', zlib.crc32(data[12:29]) & 0xffffffff)
    path.write_bytes(data)


class RasterBoundsTests(unittest.TestCase):
    def template(self):
        return {'platform': 'redbubble', 'dpi': 300, 'size_inches': [1, 1],
                'art_box_px': [0, 0, 1, 1]}

    def test_generator_rejects_oversized_header_before_decode_or_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            src, out = Path(tmp) / 'source.png', Path(tmp) / 'output'
            png_header(src, (10001, 10000))
            with warnings.catch_warnings(), patch.object(ImageFile.ImageFile, 'load',
                    side_effect=AssertionError('decoder must not run')):
                warnings.simplefilter('ignore', Image.DecompressionBombWarning)
                with self.assertRaisesRegex(ValueError, '^IMAGE_PIXEL_LIMIT$'):
                    generate(src, self.template(), [], out)
            self.assertFalse(out.exists())

    def test_generator_rejects_animation_instead_of_silently_using_first_frame(self):
        with tempfile.TemporaryDirectory() as tmp:
            src, out = Path(tmp) / 'source.gif', Path(tmp) / 'output'
            Image.new('RGB', (2, 2), 'white').save(src, save_all=True,
                append_images=[Image.new('RGB', (2, 2), 'black')], duration=100, loop=0)
            with self.assertRaisesRegex(ValueError, '^IMAGE_MULTIFRAME_UNSUPPORTED$'):
                generate(src, self.template(), [], out)
            self.assertFalse(out.exists())

    def test_exact_header_ceiling_and_one_pixel_over_with_pillow_guard_disabled(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(Image, 'MAX_IMAGE_PIXELS', None):
            src = Path(tmp) / 'header.png'
            for size in ((10000, 10000), (100_000_001, 1)):
                png_header(src, size)
                with patch.object(ImageFile.ImageFile, 'load',
                        side_effect=AssertionError('header validation must not decode')):
                    if size[0] * size[1] == MAX_RASTER_PIXELS:
                        with open_raster(src) as image:
                            self.assertEqual(image.size, size)
                    else:
                        with self.assertRaisesRegex(ValueError, '^IMAGE_PIXEL_LIMIT$'):
                            with open_raster(src):
                                self.fail('oversized header accepted')

    def test_pillow_bomb_error_has_fixed_reason(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp) / 'header.png'
            png_header(src, (100000, 100000))
            with self.assertRaisesRegex(ValueError, '^IMAGE_PIXEL_LIMIT$'):
                with open_raster(src):
                    self.fail('bomb header accepted')

    def test_size_mismatch_precedes_decode_and_closes_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp) / 'image.png'
            Image.new('RGB', (2, 2)).save(src)
            real_open = Image.open
            opened = []
            def tracking_open(path):
                image = real_open(path)
                opened.append(image)
                return image
            with patch('pod_raster.Image.open', side_effect=tracking_open), patch.object(
                    ImageFile.ImageFile, 'load', side_effect=AssertionError('decoder must not run')):
                with self.assertRaisesRegex(ValueError, '^IMAGE_SIZE_MISMATCH$'):
                    with open_raster(src, [2, 3]):
                        self.fail('mismatch accepted')
            self.assertIsNone(opened[0].fp)

    def test_invalid_expected_dimensions_fail_before_file_access(self):
        for size in ([], [True, 2], [2.0, 2], [0, 2], '2x2', [2, 2, 2]):
            with self.subTest(size=size), patch('pod_raster.Image.open') as mocked:
                with self.assertRaisesRegex(ValueError, '^IMAGE_SIZE_MISMATCH$'):
                    with open_raster('not-opened', size):
                        self.fail('invalid expected dimensions')
                mocked.assert_not_called()

    def test_supported_static_rasters_and_transparency_still_render(self):
        with tempfile.TemporaryDirectory() as tmp:
            for extension, mode in (('png', 'RGBA'), ('jpg', 'RGB'), ('webp', 'RGB')):
                with self.subTest(extension=extension):
                    src, out = Path(tmp) / ('source.' + extension), Path(tmp) / extension
                    Image.new(mode, (2, 2), (30, 40, 50, 128) if mode == 'RGBA' else (30, 40, 50)).save(src)
                    manifest = generate(src, self.template(), [], out)
                    self.assertEqual(manifest['source_size_px'], [2, 2])
                    with open_raster(out / 'print.png', [300, 300]) as image:
                        image.load()

    def test_truncated_source_creates_no_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            src, out = Path(tmp) / 'broken.png', Path(tmp) / 'output'
            png_header(src, (50, 50))  # Valid header but only one pixel of data.
            with self.assertRaises(OSError):
                generate(src, self.template(), [], out)
            self.assertFalse(out.exists())


if __name__ == '__main__':
    unittest.main()
