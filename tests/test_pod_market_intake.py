"""Synthetic intake authorization regressions; no marketplace requests or clearances."""
import hashlib
import copy
import io
import json
import os
from pathlib import Path
from types import SimpleNamespace
import sys
import subprocess
import tempfile
import time
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from pod_common import save_json, sign, verified
from pod_market_intake import run, main
from pod_market_intake import analyze_reference
from pod_market_intake import screen
from PIL import Image, ImageFile
from test_pod_raster_bounds import png_header


class RightsEvidenceShapeTests(unittest.TestCase):
    def setUp(self):
        self.registry = {'countries': ['US'], 'categories': ['apparel'],
                         'coverage_verified': True, 'records': []}
        self.policy = {'related_categories_checked': True,
                       'non_trademark_rights_verified': True}

    def test_explicit_empty_records_with_verified_coverage_remain_valid(self):
        self.assertEqual(screen('Original', 'US', 'apparel', self.registry, self.policy), ('PASS', []))

    def test_registry_requires_explicit_list_shapes(self):
        for key, value in [('countries', 'AUS'), ('categories', 'home-apparel'),
                           ('records', {}), ('records', ''), ('records', None),
                           ('countries', ['US', None]), ('categories', ['apparel', ''])]:
            with self.subTest(key=key, value=value):
                registry = {**self.registry, key: value}
                self.assertEqual(screen('Original', 'US', 'apparel', registry, self.policy),
                                 ('UNKNOWN', ['REGISTRY_SCHEMA_INVALID']))
        registry = {k:v for k,v in self.registry.items() if k != 'records'}
        self.assertEqual(screen('Original', 'US', 'apparel', registry, self.policy),
                         ('UNKNOWN', ['REGISTRY_SCHEMA_INVALID']))

    def test_malformed_records_cannot_be_silently_ignored(self):
        record = {'word_mark': 'Unrelated', 'countries': ['CA'], 'related_categories': ['books']}
        for bad in ({}, None, [], 'record', {**record, 'word_mark': ''},
                    {**record, 'word_mark': 123}, {**record, 'countries': 'CA'},
                    {**record, 'related_categories': 'books'}, {**record, 'countries': []}):
            with self.subTest(record=bad):
                registry = {**self.registry, 'records': [bad]}
                self.assertEqual(screen('Original', 'US', 'apparel', registry, self.policy),
                                 ('UNKNOWN', ['REGISTRY_SCHEMA_INVALID']))

    def test_invalid_defensive_term_shapes_are_unknown(self):
        for key in ('blocked_terms', 'blocked_whole_words'):
            for value in ('', {}, None, [''], [12], ['valid', None]):
                with self.subTest(key=key, value=value):
                    self.assertEqual(screen('Original', 'US', 'apparel', self.registry,
                                     {**self.policy, key: value}),
                                     ('UNKNOWN', ['RIGHTS_POLICY_SCHEMA_INVALID']))

    def test_non_object_evidence_is_unknown(self):
        for value in (None, [], 'evidence'):
            with self.subTest(value=value):
                self.assertEqual(screen('Original', 'US', 'apparel', value, self.policy)[0], 'UNKNOWN')
                self.assertEqual(screen('Original', 'US', 'apparel', self.registry, value)[0], 'UNKNOWN')

    def test_non_text_candidate_is_not_coerced_to_a_clearable_string(self):
        for text in (None, 123, ['Original'], {'text': 'Original'}):
            with self.subTest(text=text):
                self.assertEqual(screen(text, 'US', 'apparel', self.registry, self.policy),
                                 ('UNKNOWN', ['TEXT_INVALID']))

    def test_valid_localized_conflict_and_defensive_matching_preserved(self):
        registry = copy.deepcopy(self.registry)
        registry['records'] = [{'word_mark': 'Étoile', 'countries': ['US'],
                                'related_categories': ['apparel']}]
        self.assertEqual(screen('E\u0301TOILE design', 'US', 'apparel', registry, self.policy),
                         ('UNKNOWN', ['POTENTIAL_MARK_CONFLICT']))
        self.assertEqual(screen('Original', 'US', 'apparel', self.registry,
                         {**self.policy, 'blocked_terms': ['ORIGINAL']}),
                         ('FAIL', ['DEFENSIVE_TERM_MATCH']))
        self.assertEqual(screen('Original', 'US', 'apparel', self.registry,
                         {**self.policy, 'blocked_whole_words': ['ORIGINAL']}),
                         ('FAIL', ['LOCALIZED_WORD_MATCH']))


class ReferenceRasterTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def test_oversized_reference_rejected_before_any_decoder(self):
        path = self.root / 'oversized.png'
        png_header(path, (10001, 10000))
        with patch.object(Image, 'MAX_IMAGE_PIXELS', None), patch.object(
                ImageFile.ImageFile, 'load', side_effect=AssertionError('pixel decoder reached')), patch(
                'pod_market_intake.cv2.imread', create=True,
                side_effect=AssertionError('unchecked OpenCV decoder reached')):
            with self.assertRaisesRegex(ValueError, '^IMAGE_PIXEL_LIMIT$'):
                analyze_reference(path)

    def test_bomb_reference_has_bounded_failure(self):
        path = self.root / 'bomb.png'
        png_header(path, (100000, 100000))
        with patch('pod_market_intake.cv2.imread', create=True,
                   side_effect=AssertionError('unchecked decoder reached')):
            with self.assertRaisesRegex(ValueError, '^IMAGE_PIXEL_LIMIT$'):
                analyze_reference(path)

    def test_animated_reference_rejected_before_edge_analysis(self):
        path = self.root / 'animation.gif'
        Image.new('RGB', (2, 2), 'white').save(path, save_all=True,
            append_images=[Image.new('RGB', (2, 2), 'black')], duration=100, loop=0)
        with patch('pod_market_intake.cv2.Canny', create=True,
                   side_effect=AssertionError('edge analysis reached')), patch(
                   'pod_market_intake.cv2.imread', create=True,
                   side_effect=AssertionError('unchecked decoder reached')):
            with self.assertRaisesRegex(ValueError, '^IMAGE_MULTIFRAME_UNSUPPORTED$'):
                analyze_reference(path)

    def test_truncated_reference_fails_before_edge_analysis(self):
        path = self.root / 'truncated.png'
        png_header(path, (50, 50))
        with patch('pod_market_intake.cv2.Canny', create=True,
                   side_effect=AssertionError('edge analysis reached')), patch(
                   'pod_market_intake.cv2.imread', create=True,
                   side_effect=AssertionError('unchecked decoder reached')):
            with self.assertRaises(OSError):
                analyze_reference(path)

    def test_unsupported_reference_fails_closed(self):
        path = self.root / 'invalid.bin'
        path.write_bytes(b'not an image')
        with patch('pod_market_intake.cv2.imread', create=True,
                   side_effect=AssertionError('unchecked decoder reached')):
            with self.assertRaises(OSError):
                analyze_reference(path)

    def test_static_modes_preserve_display_geometry(self):
        for mode in ('RGB', 'RGBA', 'L', 'P'):
            with self.subTest(mode=mode):
                path = self.root / (mode + '.png')
                image = Image.new('RGB', (64, 48), 'white')
                image.paste('black', (16, 12, 40, 36))
                image.convert(mode).save(path)
                result = analyze_reference(path)
                self.assertEqual(result['display_pixels'], [64, 48])
                self.assertGreater(result['edge_density'], 0)
                self.assertLess(result['edge_density'], 1)
                self.assertTrue(result['normalized_regions'])
                for x, y, w, h in result['normalized_regions']:
                    self.assertTrue(0 <= x < x+w <= 1 and 0 <= y < y+h <= 1)
                self.assertIsNone(result['print_dimensions'])
                self.assertIsNone(result['font_identity'])

    def test_validated_file_is_not_reopened_after_path_replacement(self):
        path = self.root / 'source.png'
        Image.new('RGB', (64, 48), 'white').save(path)
        replacement = self.root / 'replacement.png'
        png_header(replacement, (10001, 10000))
        real_open = Image.open
        opened = []
        def replace_after_open(source):
            image = real_open(source)
            opened.append(image)
            replacement.replace(path)
            return image
        with patch('pod_raster.Image.open', side_effect=replace_after_open) as opener:
            result = analyze_reference(path)
        self.assertEqual(opener.call_count, 1)
        self.assertEqual(result['display_pixels'], [64, 48])
        self.assertEqual(result['edge_density'], 0)
        self.assertIsNone(opened[0].fp)


class MarketSourceAuthorizationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.keys = patch.dict(os.environ, {
            'POD_REGISTRY_KEY': 'r' * 48, 'POD_RIGHTS_KEY': 'p' * 48,
            'POD_SOURCE_KEY': 's' * 48,
        })
        self.keys.start()
        self.addCleanup(self.keys.stop)
        self.body = b'<script type="application/ld+json">{"@type":"Product","name":"Fixture"}</script>\r\n'
        self.html = self.root / 'snapshot.html'
        self.html.write_bytes(self.body)
        self.reference = self.root / 'reference.bin'
        self.reference.write_bytes(b'synthetic reference')
        self.args = SimpleNamespace(platform='redbubble', country='US', category='apparel',
            text='Original fixture', registry=str(self.root / 'registry.json'),
            policy=str(self.root / 'rights.json'), reference=str(self.reference),
            html=str(self.html), url='https://approved.example/product',
            source_policy=str(self.root / 'source.json'))
        self.write_evidence(self.args.registry, 'POD_REGISTRY_KEY', 'pod:registry', {
            'countries': ['US'], 'categories': ['apparel'], 'coverage_verified': True,
            'records': [],
        })
        self.write_evidence(self.args.policy, 'POD_RIGHTS_KEY', 'pod:rights-policy', {
            'text_sha256': hashlib.sha256(self.args.text.encode()).hexdigest(),
            'country': 'US', 'category': 'apparel', 'related_categories_checked': True,
            'non_trademark_rights_verified': True,
        })
        self.source = {'collection_authorized': True, 'approved_hosts': ['approved.example'],
            'snapshot': {'source_url': self.args.url, 'sha256': hashlib.sha256(self.body).hexdigest()}}
        self.write_source()
        self.visual = patch('pod_market_intake.analyze_reference', return_value={'fixture': True})
        self.visual.start()
        self.addCleanup(self.visual.stop)
        self.network = patch('pod_market_intake.fetch_market', side_effect=AssertionError('No network permitted'))
        self.network.start()
        self.addCleanup(self.network.stop)

    def write_evidence(self, path, key, audience, values):
        now = int(time.time() * 1000)
        save_json(path, sign({'schema_version': 1, 'audience': audience,
            'issued_at_ms': now - 1000, 'expires_at_ms': now + 60000, **values}, key))

    def write_source(self):
        self.write_evidence(self.args.source_policy, 'POD_SOURCE_KEY', 'pod:source-policy', self.source)

    def test_offline_snapshot_requires_source_policy(self):
        Path(self.args.source_policy).unlink()
        with self.assertRaises((ValueError, FileNotFoundError)):
            run(self.args)

    def test_offline_snapshot_requires_collection_authorization(self):
        self.source['collection_authorized'] = False
        self.write_source()
        with self.assertRaisesRegex(ValueError, 'SOURCE_NOT_AUTHORIZED'):
            run(self.args)

    def test_offline_snapshot_requires_exact_bytes(self):
        self.html.write_bytes(self.body.replace(b'Fixture', b'Invented'))
        with self.assertRaisesRegex(ValueError, 'SOURCE_SNAPSHOT_MISMATCH'):
            run(self.args)

    def test_offline_snapshot_requires_exact_url(self):
        self.args.url = 'https://approved.example/another-product'
        with self.assertRaisesRegex(ValueError, 'SOURCE_SNAPSHOT_MISMATCH'):
            run(self.args)

    def test_offline_snapshot_requires_approved_url(self):
        for url in ('http://approved.example/product', 'https://unapproved.example/product',
                    'https://user:password@approved.example/product', 'https://approved.example:444/product'):
            with self.subTest(url=url):
                self.args.url = url
                with self.assertRaisesRegex(ValueError, 'SOURCE_NOT_APPROVED'):
                    run(self.args)

    def test_missing_snapshot_binding_is_rejected(self):
        del self.source['snapshot']
        self.write_source()
        with self.assertRaisesRegex(ValueError, 'SOURCE_SNAPSHOT_MISMATCH'):
            run(self.args)

    def test_authorized_snapshot_preserves_exact_source_digest(self):
        result = run(self.args)
        self.assertEqual(result['rights_state'], 'PASS')
        self.assertFalse(result['publication_enabled'])
        self.assertEqual(result['source_sha256'], hashlib.sha256(self.body).hexdigest())
        self.assertEqual(result['observations'][0]['name'], 'Fixture')

    def test_oversized_snapshot_is_rejected(self):
        self.html.write_bytes(b' ' * (2 * 1024 * 1024 + 1))
        with self.assertRaisesRegex(ValueError, 'SOURCE_TOO_LARGE'):
            run(self.args)

    def test_source_policy_host_list_cannot_be_a_substring_match(self):
        self.source['approved_hosts'] = 'approved.example.evil.example'
        self.write_source()
        with self.assertRaisesRegex(ValueError, 'SOURCE_NOT_APPROVED'):
            run(self.args)

    def test_expired_source_policy_is_rejected_for_offline_import(self):
        self.source['expires_at_ms'] = int(time.time() * 1000) - 100
        self.write_source()
        with self.assertRaisesRegex(ValueError, 'EVIDENCE_EXPIRED'):
            run(self.args)

    def test_online_authorization_blocks_before_fetch(self):
        self.args.html = None
        self.source['collection_authorized'] = False
        self.write_source()
        with self.assertRaisesRegex(ValueError, 'SOURCE_NOT_AUTHORIZED'):
            run(self.args)

    def test_authorized_online_source_still_uses_existing_fetch_contract(self):
        self.args.html = None
        del self.source['snapshot']
        self.write_source()
        with patch('pod_market_intake.fetch_market', return_value=self.body.decode()) as fetch:
            result = run(self.args)
        fetch.assert_called_once_with(self.args.url, ['approved.example'])
        self.assertTrue(result['collection_authorized'])
        self.assertEqual(len(result['source_policy_sha256']), 64)

    def test_cli_cannot_sign_pass_after_unauthorized_import(self):
        self.source['collection_authorized'] = False
        self.write_source()
        output = self.root / 'output.json'
        signed = self.root / 'signed.json'
        command = [sys.executable, str(Path(__file__).resolve().parents[1] / 'scripts/pod_market_intake.py')]
        for key, value in vars(self.args).items():
            command.extend(['--' + key.replace('_', '-'), value])
        command.extend(['--output', str(output), '--signed-output', str(signed),
                        '--concept-id', 'fixture-concept', '--business-id', 'fixture-business'])
        with patch.dict(os.environ, {'POD_INTAKE_KEY': 'i' * 48}):
            result = subprocess.run(command, capture_output=True, text=True, timeout=10)
            self.assertEqual(result.returncode, 2, result.stderr)
            evidence = verified(json.loads(signed.read_text()), 'POD_INTAKE_KEY', 'content-control:pod:intake')
        self.assertEqual(evidence['rights_state'], 'UNKNOWN')
        self.assertTrue(evidence['permanently_unpublished'])
        self.assertFalse(evidence['publication_enabled'])
        self.assertEqual(json.loads(result.stdout)['status'], 'BLOCKED')

    def expire_one_evidence(self, index, now):
        paths = [self.args.registry, self.args.policy, self.args.source_policy]
        keys = ['POD_REGISTRY_KEY', 'POD_RIGHTS_KEY', 'POD_SOURCE_KEY']
        for i, (path, key) in enumerate(zip(paths, keys)):
            payload = json.loads(json.loads(Path(path).read_text())['payload'])
            payload.update(issued_at_ms=now - 1000,
                           expires_at_ms=now + (100 if i == index else 60000))
            save_json(path, sign(payload, key))

    def cli_args(self):
        argv = ['pod_market_intake.py']
        for key, value in vars(self.args).items():
            argv.extend(['--' + key.replace('_', '-'), value])
        argv.extend(['--output', str(self.root / 'output.json'),
                     '--signed-output', str(self.root / 'signed.json'),
                     '--concept-id', 'fixture-concept', '--business-id', 'fixture-business'])
        return argv

    def test_each_authority_expiring_during_analysis_blocks_pass(self):
        for index in range(3):
            with self.subTest(authority=index):
                now = int(time.time() * 1000)
                self.expire_one_evidence(index, now)
                clock = [now]
                def analyze(_):
                    clock[0] += 200
                    return {'fixture': True}
                with patch('pod_common.time.time', side_effect=lambda: clock[0] / 1000), \
                     patch('pod_market_intake.analyze_reference', side_effect=analyze):
                    with self.assertRaisesRegex(ValueError, 'EVIDENCE_EXPIRED'):
                        run(self.args)

    def test_expiry_during_final_reference_hash_also_blocks_pass(self):
        now = int(time.time() * 1000)
        self.expire_one_evidence(0, now)
        clock = [now]
        reference = self.reference.read_bytes()
        real_sha256 = hashlib.sha256
        def hash_reference(data=b''):
            if data == reference:
                clock[0] += 200
            return real_sha256(data)
        with patch('pod_common.time.time', side_effect=lambda: clock[0] / 1000), \
             patch('pod_market_intake.hashlib.sha256', side_effect=hash_reference):
            with self.assertRaisesRegex(ValueError, 'EVIDENCE_EXPIRED'):
                run(self.args)

    def test_signed_pass_cannot_outlive_shortest_input_authority(self):
        for index in range(3):
            with self.subTest(authority=index):
                now = int(time.time() * 1000)
                self.expire_one_evidence(index, now)
                with patch('pod_common.time.time', return_value=now / 1000), \
                     patch.dict(os.environ, {'POD_INTAKE_KEY': 'i' * 48}), \
                     patch.object(sys, 'argv', self.cli_args()), patch('sys.stdout', new_callable=io.StringIO):
                    self.assertEqual(main(), 0)
                    evidence = verified(json.loads((self.root / 'signed.json').read_text()),
                                        'POD_INTAKE_KEY', 'content-control:pod:intake')
                self.assertEqual(evidence['expires_at_ms'], now + 100)
                self.assertEqual(evidence['rights_state'], 'PASS')
                with patch('pod_common.time.time', return_value=(now + 101) / 1000), \
                     patch.dict(os.environ, {'POD_INTAKE_KEY': 'i' * 48}):
                    with self.assertRaisesRegex(ValueError, 'EVIDENCE_EXPIRED'):
                        verified(json.loads((self.root / 'signed.json').read_text()),
                                 'POD_INTAKE_KEY', 'content-control:pod:intake')

    def test_replacement_file_does_not_renew_the_used_authority(self):
        now = int(time.time() * 1000)
        self.expire_one_evidence(0, now)
        clock = [now]
        def analyze(_):
            self.expire_one_evidence(-1, now)
            clock[0] += 200
            return {'fixture': True}
        with patch('pod_common.time.time', side_effect=lambda: clock[0] / 1000), \
             patch('pod_market_intake.analyze_reference', side_effect=analyze):
            with self.assertRaisesRegex(ValueError, 'EVIDENCE_EXPIRED'):
                run(self.args)

    def test_cli_emits_only_unpublished_unknown_when_analysis_outlives_authority(self):
        now = int(time.time() * 1000)
        self.expire_one_evidence(1, now)
        clock = [now]
        def analyze(_):
            clock[0] += 200
            return {'fixture': True}
        with patch('pod_common.time.time', side_effect=lambda: clock[0] / 1000), \
             patch('pod_market_intake.analyze_reference', side_effect=analyze), \
             patch.dict(os.environ, {'POD_INTAKE_KEY': 'i' * 48}), \
             patch.object(sys, 'argv', self.cli_args()), patch('sys.stdout', new_callable=io.StringIO):
            self.assertEqual(main(), 2)
            evidence = verified(json.loads((self.root / 'signed.json').read_text()),
                                'POD_INTAKE_KEY', 'content-control:pod:intake')
        self.assertEqual(evidence['rights_state'], 'UNKNOWN')
        self.assertTrue(evidence['permanently_unpublished'])
        self.assertFalse(evidence['publication_enabled'])


    def test_reference_hash_keeps_analyzed_bytes_after_path_mutation(self):
        for mutation in ('replace', 'overwrite', 'delete'):
            with self.subTest(mutation=mutation):
                original = b'original synthetic reference'
                self.reference.write_bytes(original)
                def analyze(source):
                    observed = source.read() if hasattr(source, 'read') else Path(source).read_bytes()
                    if mutation == 'replace':
                        replacement = self.root / 'replacement.bin'
                        replacement.write_bytes(b'replaced reference')
                        replacement.replace(self.reference)
                    elif mutation == 'overwrite':
                        self.reference.write_bytes(b'overwritten reference')
                    else:
                        self.reference.unlink()
                    return {'observed_sha256': hashlib.sha256(observed).hexdigest()}
                with patch('pod_market_intake.analyze_reference', side_effect=analyze):
                    result = run(self.args)
                expected = hashlib.sha256(original).hexdigest()
                self.assertEqual(result['visual']['observed_sha256'], expected)
                self.assertEqual(result['reference_sha256'], expected)

    def test_reference_byte_limit_rejects_before_analysis(self):
        self.reference.write_bytes(b'x' * 33)
        with patch('pod_market_intake.MAX_REFERENCE_BYTES', 32, create=True), \
             patch('pod_market_intake.analyze_reference') as analyze:
            with self.assertRaisesRegex(ValueError, '^REFERENCE_TOO_LARGE$'):
                run(self.args)
            analyze.assert_not_called()

    def test_empty_reference_rejected_before_analysis(self):
        self.reference.write_bytes(b'')
        with patch('pod_market_intake.analyze_reference') as analyze:
            with self.assertRaisesRegex(ValueError, '^REFERENCE_EMPTY$'):
                run(self.args)
            analyze.assert_not_called()

    def test_exact_reference_byte_limit_preserves_snapshot(self):
        original = b'x' * 32
        self.reference.write_bytes(original)
        with patch('pod_market_intake.MAX_REFERENCE_BYTES', 32, create=True):
            result = run(self.args)
        self.assertEqual(result['reference_sha256'], hashlib.sha256(original).hexdigest())

    def test_real_reference_analysis_and_hash_share_snapshot(self):
        Image.new('RGB', (64, 48), 'white').save(self.reference, format='PNG')
        original = self.reference.read_bytes()
        def analyze(source):
            # Replacement precedes the actual decoder, after the snapshot boundary.
            Image.new('RGB', (12, 20), 'black').save(self.reference, format='PNG')
            return analyze_reference(source)
        with patch('pod_market_intake.analyze_reference', side_effect=analyze):
            result = run(self.args)
        self.assertEqual(result['visual']['display_pixels'], [64, 48])
        self.assertEqual(result['reference_sha256'], hashlib.sha256(original).hexdigest())

    def test_signed_intake_binds_reference_hash_to_analyzed_snapshot(self):
        original = self.reference.read_bytes()
        def analyze(source):
            observed = source.read()
            self.reference.write_bytes(b'replacement after snapshot')
            return {'observed_sha256': hashlib.sha256(observed).hexdigest()}
        with patch('pod_market_intake.analyze_reference', side_effect=analyze), \
             patch.dict(os.environ, {'POD_INTAKE_KEY': 'i' * 48}), \
             patch.object(sys, 'argv', self.cli_args()), patch('sys.stdout', new_callable=io.StringIO):
            self.assertEqual(main(), 0)
            evidence = verified(json.loads((self.root / 'signed.json').read_text()),
                                'POD_INTAKE_KEY', 'content-control:pod:intake')
        expected = hashlib.sha256(original).hexdigest()
        self.assertEqual(evidence['reference_sha256'], expected)
        self.assertEqual(evidence['visual']['observed_sha256'], expected)
        self.assertFalse(evidence['publication_enabled'])

    def test_signed_malformed_registry_emits_unknown_before_collection(self):
        self.write_evidence(self.args.registry, 'POD_REGISTRY_KEY', 'pod:registry', {
            'countries': ['US'], 'categories': ['apparel'], 'coverage_verified': True,
            # Missing records cannot assert that no matching records exist.
        })
        with patch('pod_market_intake.fetch_market', side_effect=AssertionError('collection reached')), \
             patch('pod_market_intake.analyze_reference', side_effect=AssertionError('analysis reached')), \
             patch.dict(os.environ, {'POD_INTAKE_KEY': 'i' * 48}), \
             patch.object(sys, 'argv', self.cli_args()), patch('sys.stdout', new_callable=io.StringIO):
            self.assertEqual(main(), 2)
            evidence = verified(json.loads((self.root / 'signed.json').read_text()),
                                'POD_INTAKE_KEY', 'content-control:pod:intake')
        self.assertEqual(evidence['rights_state'], 'UNKNOWN')
        self.assertEqual(evidence['reason_codes'], ['REGISTRY_SCHEMA_INVALID'])
        self.assertTrue(evidence['permanently_unpublished'])
        self.assertFalse(evidence['publication_enabled'])


if __name__ == '__main__':
    unittest.main()
