"""CLI authority boundaries with synthetic keys and controlled rendering time."""
import contextlib
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import pod_asset_generator as asset
import pod_book_interior as interior
import pod_book_package as package
from pod_common import canonical, save_json, sign


class StageExpiryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.now = 1800000000.0
        for mocked in (patch.dict(os.environ, {'POD_RIGHTS_KEY': 'r'*48, 'POD_TEMPLATE_KEY': 't'*48}),
                       patch('pod_common.time.time', side_effect=lambda: self.now)):
            mocked.start(); self.addCleanup(mocked.stop)

    def envelope(self, audience, values, ttl=1000, key='POD_TEMPLATE_KEY'):
        return sign({'schema_version': 1, 'audience': audience,
                     'issued_at_ms': int(self.now*1000)-1,
                     'expires_at_ms': int(self.now*1000)+ttl, **values}, key)

    def invoke(self, kind, effect=None, rights_ttl=60000, template_ttl=1000):
        template = self.root / 'template.json'
        audience = 'pod:template' if kind == 'asset' else 'pod:interior-template'
        save_json(template, self.envelope(audience, {'template': {'fixture': True}}, template_ttl))
        pages = self.root / 'pages.json'; save_json(pages, [])
        rights = self.root / 'rights.json'
        save_json(rights, self.envelope('pod:asset-rights', {'status': 'PASS',
            'source_sha256': '1'*64, 'text_layers_sha256': hashlib.sha256(canonical([]).encode()).hexdigest()},
            rights_ttl, 'POD_RIGHTS_KEY'))
        if kind == 'asset':
            module, stage = asset, 'generate'
            argv = ['asset', '--source', 'unused', '--template', str(template), '--text-layers', str(pages),
                    '--rights', str(rights), '--output-dir', str(self.root/'output')]
        elif kind == 'interior':
            module, stage = interior, 'render_book'
            argv = ['interior', '--template', str(template), '--pages', str(pages),
                    '--font', 'unused', '--output', str(self.root/'interior.pdf')]
        else:
            module, stage = package, 'assemble'
            argv = ['package', '--template', str(template), '--pages', str(pages),
                    '--font', 'unused', '--package-dir', str(self.root/'package')]
        def render(*args, **kwargs):
            if effect:
                effect(template, rights, audience)
            return {'package_sha256': '2'*64, 'publication_enabled': False}
        stdout = io.StringIO()
        with patch.object(sys, 'argv', argv), patch.object(module, stage, side_effect=render) as rendered, contextlib.redirect_stdout(stdout):
            code = module.main()
        return code, json.loads(stdout.getvalue()), rendered.call_count

    def test_template_expiry_during_each_render_is_blocked(self):
        for kind in ('asset', 'interior', 'package'):
            with self.subTest(kind=kind):
                code, result, calls = self.invoke(kind, lambda *_: setattr(self, 'now', self.now+2))
                self.assertEqual(calls, 1)
                self.assertEqual(code, 2)
                self.assertEqual(result['status'], 'BLOCKED')
                self.assertEqual(result['reason_code'], 'EVIDENCE_EXPIRED')
                self.assertFalse(result['publication_enabled'])

    def test_asset_rights_expiry_is_independent_of_template_lifetime(self):
        code, result, _ = self.invoke('asset', lambda *_: setattr(self, 'now', self.now+2),
                                      rights_ttl=1000, template_ttl=60000)
        self.assertEqual(code, 2)
        self.assertEqual(result['reason_code'], 'EVIDENCE_EXPIRED')

    def test_replacing_template_cannot_extend_the_original_render_authority(self):
        def replace(template, rights, audience):
            self.now += 2
            save_json(template, self.envelope(audience, {'template': {'different': True}}, 60000))
        for kind in ('asset', 'interior', 'package'):
            with self.subTest(kind=kind):
                code, result, _ = self.invoke(kind, replace)
                self.assertEqual(code, 2)
                self.assertEqual(result['reason_code'], 'EVIDENCE_EXPIRED')

    def test_replacing_rights_cannot_extend_the_original_asset_authority(self):
        def replace(template, rights, audience):
            self.now += 2
            save_json(rights, self.envelope('pod:asset-rights', {'status': 'PASS'}, 60000, 'POD_RIGHTS_KEY'))
        code, result, _ = self.invoke('asset', replace, rights_ttl=1000, template_ttl=60000)
        self.assertEqual(code, 2)
        self.assertEqual(result['reason_code'], 'EVIDENCE_EXPIRED')

    def test_valid_original_snapshot_survives_input_file_deletion(self):
        def delete(template, rights, audience):
            template.unlink(); rights.unlink()
        for kind in ('asset', 'interior', 'package'):
            with self.subTest(kind=kind):
                code, result, _ = self.invoke(kind, delete)
                self.assertEqual(code, 0)
                self.assertNotEqual(result.get('status'), 'BLOCKED')

    def test_initial_expiry_never_starts_rendering(self):
        for kind in ('asset', 'interior', 'package'):
            with self.subTest(kind=kind):
                code, result, calls = self.invoke(kind, template_ttl=0)
                self.assertEqual(code, 2)
                self.assertEqual(calls, 0)
                self.assertEqual(result['reason_code'], 'EVIDENCE_EXPIRED')

    def test_interior_receipt_write_cannot_extend_template_lifetime(self):
        real_save = interior.save_json
        def delayed_save(path, value):
            real_save(path, value)
            self.now += 2
        with patch.object(interior, 'save_json', side_effect=delayed_save):
            code, result, calls = self.invoke('interior')
        self.assertEqual(calls, 1)
        self.assertEqual(code, 2)
        self.assertEqual(result['reason_code'], 'EVIDENCE_EXPIRED')


if __name__ == '__main__':
    unittest.main()
