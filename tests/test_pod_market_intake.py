"""Synthetic intake authorization regressions; no marketplace requests or clearances."""
import hashlib
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
        def hash_reference(_):
            clock[0] += 200
            return 'a' * 64
        with patch('pod_common.time.time', side_effect=lambda: clock[0] / 1000), \
             patch('pod_market_intake.digest', side_effect=hash_reference):
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


if __name__ == '__main__':
    unittest.main()
