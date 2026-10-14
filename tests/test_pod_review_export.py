import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('export', Path(__file__).resolve().parents[1] / 'scripts/pod_review_export.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ExportTests(unittest.TestCase):
    def fixture(self, name='art.png'):
        body = b'fixture bytes'
        manifest = {'schema_version': 1, 'publication_enabled': False, 'files': {name: hashlib.sha256(body).hexdigest()}}
        manifest['package_sha256'] = hashlib.sha256(json.dumps(manifest, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
        record = json.dumps({'id': 'job', 'manifest': manifest}).encode()
        return lambda route, limit: record if route.endswith('/package') else body

    def test_restore_without_approval(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'review'
            result = module.export_package('https://example.com/api/print', 'job', root, 'k'*32, self.fixture())
            self.assertEqual(result['status'], 'REVIEW_REQUIRED')
            self.assertEqual((root/'art.png').read_bytes(), b'fixture bytes')
            with self.assertRaises(FileExistsError):
                module.export_package('https://example.com/api/print', 'job', root, 'k'*32, self.fixture())

    def test_bad_bytes_remove_partial_directory(self):
        good = self.fixture()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'review'
            with self.assertRaisesRegex(ValueError, 'ARTIFACT_INVALID'):
                module.export_package('https://example.com/api/print', 'job', root, 'k'*32, lambda route, limit: good(route, limit) if route.endswith('/package') else b'corrupt')
            self.assertFalse(root.exists())

    def test_traversal_rejected_before_writing(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'review'
            with self.assertRaisesRegex(ValueError, 'FILE_INVALID'):
                module.export_package('https://example.com/api/print', 'job', root, 'k'*32, self.fixture('../escape'))
            self.assertFalse(root.exists())

    def test_insecure_endpoint_rejected_before_request(self):
        with self.assertRaisesRegex(ValueError, 'ENDPOINT_INVALID'):
            module.export_package('http://example.com', 'job', 'unused', 'k'*32, lambda *_: self.fail('request'))

if __name__ == '__main__':
    unittest.main()
