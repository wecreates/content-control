"""Offline smoke checks using only images created in this test, never fixtures."""
import io
import unittest
from PIL import Image, ImageChops, ImageDraw, ImageFont


class PillowCompatibilityTests(unittest.TestCase):
    def test_patched_runtime(self):
        self.assertEqual(Image.__version__, '13.0.0')

    def test_generated_rgb_roundtrip_and_semantic_conversion(self):
        for format in ('PNG', 'JPEG'):
            with self.subTest(format=format):
                data = io.BytesIO()
                Image.new('RGB', (32, 32), 'blue').save(data, format=format)
                data.seek(0)
                with Image.open(data, formats=[format]) as image:
                    image.load()
                    converted = image.convert('RGB').resize((16, 16), Image.Resampling.LANCZOS)
                    self.assertEqual(converted.size, (16, 16))

    def test_pod_image_operations_and_builtin_font(self):
        image = Image.new('RGBA', (64, 64), 'white')
        ImageDraw.Draw(image).text((2, 2), 'QA', font=ImageFont.load_default(), fill='black')
        rgb = image.convert('RGB')
        self.assertIsNone(ImageChops.difference(rgb, rgb.copy()).getbbox())
        mask = Image.new('L', image.size, 128)
        self.assertEqual(ImageChops.multiply(mask, mask).mode, 'L')
        self.assertEqual(image.crop((0, 0, 32, 32)).size, (32, 32))


if __name__ == '__main__':
    unittest.main()
