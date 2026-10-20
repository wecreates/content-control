"""Bounded fixtures: oversized headers never allocate oversized raster buffers."""
import io
import contextlib
import hashlib
import json
import os
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
import pod_asset_generator as generator
from pod_common import canonical, digest, save_json, sign
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


class OriginalSourceTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name);self.source=self.root/'source.png'
        Image.new('RGBA',(31,19),(30,90,150,128)).save(self.source)
        self.env=patch.dict(os.environ,{'POD_RIGHTS_KEY':'synthetic-source-rights-key-'*2})
        self.env.start();self.addCleanup(self.env.stop)

    def case(self,layers=None):
        import time
        template={'platform':'redbubble','dpi':300,'size_inches':[1,1],
            'art_box_px':[30,40,23,21],'background_rgba':[220,210,200,180]}
        out=self.root/('package-'+str(len(list(self.root.glob('package-*')))))
        manifest=generate(self.source,template,layers or [],out)
        now=int(time.time()*1000)
        record=dict(schema_version=1,issued_at_ms=now-1,expires_at_ms=now+60000,
            audience='pod:asset-rights',status='PASS',source_sha256=digest(self.source))
        rights=self.root/'rights.json';save_json(rights,sign(record,'POD_RIGHTS_KEY'))
        return manifest,out,{'source':self.source,'rights':rights},record

    def inspect(self,manifest,out,paths):
        from pod_source_preflight import inspect_original_source
        with Image.open(out/'print.png') as p,Image.open(out/'art-mask.png') as a,Image.open(out/'text-mask.png') as t:
            return inspect_original_source(manifest,p.convert('RGB'),a.copy(),t.copy(),paths)

    def test_actual_rgb_alpha_and_odd_placement_match_without_source_path_reopen(self):
        from pod_source_preflight import source_evidence_deadline
        import pod_source_preflight as preflight
        for mode in ('RGB','RGBA'):
            Image.new(mode,(31,19),(30,90,150) if mode=='RGB' else (30,90,150,128)).save(self.source)
            manifest,out,paths,record=self.case();real_open=preflight.open_raster
            def changed_path(captured):
                self.source.write_bytes(b'replaced after capture')
                return real_open(captured)
            with patch.object(preflight,'open_raster',side_effect=changed_path):
                result=self.inspect(manifest,out,paths)
            self.assertEqual(result['source_size_px'],[31,19])
            self.assertEqual(result['source_sha256'],manifest['source_sha256'])
            self.assertEqual(source_evidence_deadline(result),record['expires_at_ms'])

    def test_source_identity_dimensions_placement_and_mask_cannot_be_rebound(self):
        import copy
        manifest,out,paths,_=self.case()
        for change,reason in [({'source_sha256':'0'*64},'SOURCE_HASH_MISMATCH'),
                ({'source_size_px':[310,190]},'SOURCE_LAYOUT_INVALID'),
                ({'placed_size_px':[23,15]},'SOURCE_LAYOUT_INVALID'),
                ({'placed_origin_px':[30,40]},'SOURCE_LAYOUT_INVALID'),
                ({'effective_native_ppi':9999},'SOURCE_LAYOUT_INVALID')]:
            altered={**copy.deepcopy(manifest),**change}
            with self.subTest(change=change),self.assertRaisesRegex(ValueError,'^'+reason+'$'):
                self.inspect(altered,out,paths)
        for filename,point,reason in [('art-mask.png',(0,299),'SOURCE_MASK_MISMATCH'),
                ('print.png',(0,299),'SOURCE_PIXELS_MISMATCH'),
                ('text-mask.png',tuple(manifest['placed_origin_px']),'SOURCE_PIXELS_MISMATCH')]:
            original=(out/filename).read_bytes()
            with Image.open(out/filename) as image:
                image.putpixel(point,255 if image.mode=='L' else (0,0,0,255));image.save(out/filename)
            with self.subTest(filename=filename),self.assertRaisesRegex(ValueError,'^'+reason+'$'):
                self.inspect(manifest,out,paths)
            (out/filename).write_bytes(original)

    def test_text_outside_art_remains_for_existing_ocr_and_geometry_checks(self):
        font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
        layer=dict(font_path=font,font_sha256=digest(font),font_size_px=12,
            position_px=[70,70],text='Fixture',rgba=[0,0,0,255])
        manifest,out,paths,_=self.case([layer])
        self.assertEqual(self.inspect(manifest,out,paths)['source_sha256'],manifest['source_sha256'])

    def test_missing_malformed_ambiguous_or_expired_original_rights_block(self):
        from pod_common import canonical
        manifest,out,paths,record=self.case()
        for missing in (None,{}, {'source':self.source}):
            with self.assertRaisesRegex(ValueError,'^SOURCE_EVIDENCE_REQUIRED$'):self.inspect(manifest,out,missing)
        for change in ({'status':'FAIL'},{'expires_at_ms':0},{'audience':'pod:package-rights'}):
            save_json(paths['rights'],sign({**record,**change},'POD_RIGHTS_KEY'))
            with self.assertRaisesRegex(ValueError,'^SOURCE_RIGHTS_INVALID$'):self.inspect(manifest,out,paths)
        envelope=sign(record,'POD_RIGHTS_KEY');text=canonical(envelope)
        paths['rights'].write_text(text[:-1]+',"payload":'+json.dumps(envelope['payload'])+'}')
        with self.assertRaisesRegex(ValueError,'^SOURCE_RIGHTS_INVALID$'):self.inspect(manifest,out,paths)
        save_json(paths['rights'],sign({**record,'source_sha256':'0'*64},'POD_RIGHTS_KEY'))
        with self.assertRaisesRegex(ValueError,'^SOURCE_HASH_MISMATCH$'):self.inspect(manifest,out,paths)

    def test_source_bound_and_nonregular_files_precede_decoding(self):
        import pod_source_preflight as preflight
        manifest,out,paths,_=self.case();raw=self.source.read_bytes()
        with patch.object(preflight,'MAX_SOURCE_BYTES',len(raw)-1),patch.object(preflight,'open_raster',side_effect=AssertionError('decoded')):
            with self.assertRaisesRegex(ValueError,'^SOURCE_BYTES_INVALID$'):self.inspect(manifest,out,paths)
        with patch.object(preflight,'MAX_SOURCE_BYTES',len(raw)):
            self.inspect(manifest,out,paths)
        fifo=self.root/'pipe';os.mkfifo(fifo);link=self.root/'link';link.symlink_to(self.source)
        for path in (fifo,link):
            with self.assertRaisesRegex(ValueError,'^SOURCE_BYTES_INVALID$'):self.inspect(manifest,out,{**paths,'source':path})

    def test_captured_original_rights_are_rechecked_at_expiry(self):
        from pod_source_preflight import source_evidence_deadline
        manifest,out,paths,record=self.case();evidence=self.inspect(manifest,out,paths)
        paths['rights'].write_text('replacement is not re-read')
        self.assertEqual(source_evidence_deadline(evidence),record['expires_at_ms'])
        with patch('pod_common.time.time',return_value=record['expires_at_ms']/1000):
            with self.assertRaisesRegex(ValueError,'^SOURCE_RIGHTS_INVALID$'):source_evidence_deadline(evidence)


class GenerationSnapshotTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / 'source.png'
        Image.new('RGB', (20, 20), 'red').save(self.source)
        self.template = {'platform': 'redbubble', 'dpi': 300, 'size_inches': [1, 1],
                         'art_box_px': [0, 0, 20, 20]}
        self.out = self.root / 'package'

    def test_source_replacement_after_capture_cannot_change_rendered_pixels(self):
        real_open = generator.open_raster
        def replace_then_open(source):
            Image.new('RGB', (20, 20), 'blue').save(self.source)
            return real_open(source)
        with patch.object(generator, 'open_raster', side_effect=replace_then_open):
            generate(self.source, self.template, [], self.out)
        with Image.open(self.out / 'print.png') as output:
            self.assertEqual(output.getpixel((5, 5)), (255, 0, 0, 255))

    def test_source_deletion_after_capture_still_uses_captured_bytes(self):
        real_open = generator.open_raster
        def delete_then_open(source):
            self.source.unlink()
            return real_open(source)
        with patch.object(generator, 'open_raster', side_effect=delete_then_open):
            result = generate(self.source, self.template, [], self.out)
        self.assertEqual(result['source_size_px'], [20, 20])

    def test_source_byte_limit_checked_before_decoder_and_output(self):
        data = self.source.read_bytes()
        with patch.object(generator, 'MAX_INPUT_BYTES', len(data) - 1, create=True), patch.object(
                generator, 'open_raster', side_effect=AssertionError('decoder reached')):
            with self.assertRaisesRegex(ValueError, '^INPUT_BYTES_INVALID$'):
                generate(self.source, self.template, [], self.out)
        self.assertFalse(self.out.exists())

    def test_exact_source_byte_limit_is_accepted(self):
        with patch.object(generator, 'MAX_INPUT_BYTES', self.source.stat().st_size, create=True):
            result = generate(self.source, self.template, [], self.out)
        self.assertEqual(result['source_size_px'], [20, 20])

    def font_layer(self):
        font = self.root / 'font.ttf'
        font.write_bytes(Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf').read_bytes())
        return {'font_path': str(font), 'font_sha256': digest(font), 'font_size_px': 20,
                'position_px': [30, 30], 'text': 'Original', 'rgba': [0, 0, 0, 255]}

    def test_font_replacement_after_hash_cannot_change_render(self):
        layer = self.font_layer()
        baseline = self.root / 'baseline'
        generate(self.source, self.template, [layer], baseline)
        original = generator.ImageFont.truetype
        def change_then_load(font, *args, **kwargs):
            Path(layer['font_path']).write_bytes(b'unverified replacement')
            return original(font, *args, **kwargs)
        with patch.object(generator.ImageFont, 'truetype', side_effect=change_then_load):
            generate(self.source, self.template, [layer], self.out)
        self.assertEqual(digest(baseline / 'print.png'), digest(self.out / 'print.png'))

    def test_font_bound_precedes_font_decoder(self):
        layer = self.font_layer()
        with patch.object(generator, 'MAX_INPUT_BYTES', 1024, create=True), patch.object(
                generator.ImageFont, 'truetype', side_effect=AssertionError('font decoder reached')):
            with self.assertRaisesRegex(ValueError, '^INPUT_BYTES_INVALID$'):
                generate(self.source, self.template, [layer], self.out)

    def test_wrong_font_digest_blocks_font_decoder(self):
        layer = self.font_layer()
        layer['font_sha256'] = '0' * 64
        with patch.object(generator.ImageFont, 'truetype', side_effect=AssertionError('font decoder reached')):
            with self.assertRaisesRegex(ValueError, '^FONT_HASH_MISMATCH$'):
                generate(self.source, self.template, [layer], self.out)

    def test_cli_rechecks_source_identity_on_bytes_passed_to_renderer(self):
        import time
        now = int(time.time() * 1000)
        common = {'schema_version': 1, 'issued_at_ms': now - 1000, 'expires_at_ms': now + 60000}
        rights_path, template_path, layers_path = [self.root / n for n in ('rights.json', 'template.json', 'layers.json')]
        with patch.dict(os.environ, {'POD_RIGHTS_KEY': 'r' * 48, 'POD_TEMPLATE_KEY': 't' * 48}):
            save_json(rights_path, sign({**common, 'audience': 'pod:asset-rights', 'status': 'PASS',
                'source_sha256': digest(self.source),
                'text_layers_sha256': hashlib.sha256(canonical([]).encode()).hexdigest()}, 'POD_RIGHTS_KEY'))
            save_json(template_path, sign({**common, 'audience': 'pod:template',
                'template': self.template}, 'POD_TEMPLATE_KEY'))
            save_json(layers_path, [])
            real_generate = generate
            def replace_then_generate(*args, **kwargs):
                Image.new('RGB', (20, 20), 'blue').save(self.source)
                return real_generate(*args, **kwargs)
            argv = ['pod_asset_generator.py', '--source', str(self.source), '--template', str(template_path),
                    '--text-layers', str(layers_path), '--rights', str(rights_path), '--output-dir', str(self.out)]
            stdout = io.StringIO()
            with patch.object(sys, 'argv', argv), patch.object(generator, 'generate', side_effect=replace_then_generate), contextlib.redirect_stdout(stdout):
                code = generator.main()
        self.assertEqual(code, 2)
        self.assertEqual(json.loads(stdout.getvalue())['status'], 'BLOCKED')
        self.assertFalse(self.out.exists())


if __name__ == '__main__':
    unittest.main()
