import hashlib
import importlib.util
import json
import os
from pathlib import Path
import stat
import tempfile
import unittest
import contextlib
import http.server
import signal
import sys
import threading
import time
import urllib.request
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
spec = importlib.util.spec_from_file_location('export', Path(__file__).resolve().parents[1] / 'scripts/pod_review_export.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
import pod_output_attempt as attempts

def png_bytes(marker=0, padding=0):
    body = bytearray(45 + padding)
    body[:8] = bytes.fromhex('89504e470d0a1a0a')
    body[8:12] = (13).to_bytes(4, 'big')
    body[12:16] = b'IHDR'
    body[16] = marker
    end = len(body) - 12
    body[end:end + 4] = (0).to_bytes(4, 'big')
    body[end + 4:end + 8] = b'IEND'
    return bytes(body)

PDF_BYTES = b'%PDF-1.7\n%%EOF'
JSON_BYTES = b'{}'

def stored_record(manifest, platform=None, state='qa_failed', reason='REVIEW_REQUIRED'):
    identity = hashlib.sha256(json.dumps(
        manifest, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    return json.dumps({'id': 'job', 'platform': platform or manifest['platform'],
                       'state': state, 'reason_code': reason,
                       'manifest': manifest, 'manifest_sha256': identity}).encode()

class ExportTests(unittest.TestCase):
    def fixture(self, name='print.png'):
        body = png_bytes()
        files = {item: hashlib.sha256(body).hexdigest()
                 for item in ('art-mask.png','print.png','text-mask.png')}
        if name != 'print.png':
            files[name] = files.pop('print.png')
        manifest = {'schema_version': 1, 'publication_enabled': False,
                    'platform': 'redbubble', 'files': files}
        manifest['package_sha256'] = hashlib.sha256(json.dumps(manifest, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
        record = stored_record(manifest)
        return lambda route, limit: record if route.endswith('/package') else body

    def test_restore_without_approval(self):
        routes = []
        fixture = self.fixture()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'review'
            result = module.export_package('https://example.com/api/print', 'job', root, 'k'*32,
                lambda route, limit: routes.append(route) or fixture(route, limit))
            self.assertEqual(result['status'], 'REVIEW_REQUIRED')
            self.assertEqual((root/'print.png').read_bytes(), png_bytes())
            digest = hashlib.sha256(png_bytes()).hexdigest()
            self.assertEqual(routes, ['/jobs/job/package'] + ['/jobs/job/artifacts/' + digest] * 3)
            with self.assertRaises(FileExistsError):
                module.export_package('https://example.com/api/print', 'job', root, 'k'*32, self.fixture())

    def test_exported_review_files_are_private_with_permissive_umask(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'review'
            previous = os.umask(0)
            try:
                module.export_package(
                    'https://example.com/api/print', 'job', root, 'k'*32,
                    self.fixture())
            finally:
                os.umask(previous)
            self.assertEqual(stat.S_IMODE(root.stat().st_mode), 0o700)
            for path in root.iterdir():
                with self.subTest(path=path.name):
                    self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)

    def test_bad_bytes_remove_partial_directory(self):
        good = self.fixture()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'review'
            with self.assertRaisesRegex(ValueError, 'ARTIFACT_INVALID'):
                module.export_package('https://example.com/api/print', 'job', root, 'k'*32, lambda route, limit: good(route, limit) if route.endswith('/package') else b'corrupt')
            self.assertFalse(root.exists())

    def test_failure_does_not_remove_a_replacement_directory(self):
        good = self.fixture()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'review'
            moved = Path(tmp) / 'moved-attempt'
            def replace(route, limit):
                if route.endswith('/package'):
                    return good(route, limit)
                root.rename(moved)
                root.mkdir()
                (root / 'concurrent').write_bytes(b'keep')
                raise RuntimeError('replacement fixture')
            with self.assertRaisesRegex(RuntimeError, 'replacement fixture'):
                module.export_package(
                    'https://example.com/api/print', 'job', root, 'k'*32,
                    replace)
            self.assertEqual((root / 'concurrent').read_bytes(), b'keep')
            self.assertTrue(moved.is_dir())

    def test_cleanup_failure_preserves_original_error_and_marks_recovery(self):
        good = self.fixture()
        failure = RuntimeError('original export error')
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'review'
            def fail(route, limit):
                if route.endswith('/package'):
                    return good(route, limit)
                (root / 'partial').write_bytes(b'fixture')
                raise failure
            with patch.object(attempts.shutil, 'rmtree',
                              side_effect=PermissionError('fixture')):
                with self.assertRaises(RuntimeError) as caught:
                    module.export_package(
                        'https://example.com/api/print', 'job', root, 'k'*32,
                        fail)
            self.assertIs(caught.exception, failure)
            self.assertIn('REVIEW_EXPORT_OUTPUT_CLEANUP_FAILED',
                          failure.__notes__)
            self.assertEqual((root / 'partial').read_bytes(), b'fixture')

    def test_hash_correct_malformed_media_remove_partial_directory(self):
        for bad in (b'not a png', b'\x89PNG\r\n\x1a\nmissing chunks'):
            sha = hashlib.sha256(bad).hexdigest()
            manifest = {'schema_version': 1, 'publication_enabled': False,
                        'platform': 'redbubble',
                        'files': {name: sha for name in ('art-mask.png','print.png','text-mask.png')}}
            manifest['package_sha256'] = hashlib.sha256(json.dumps(
                manifest, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
            record = stored_record(manifest)
            with self.subTest(bad=bad), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp) / 'review'
                with self.assertRaisesRegex(ValueError, 'ARTIFACT_INVALID'):
                    module.export_package('https://example.com/api/print', 'job', root, 'k'*32,
                        lambda route, limit: record if route.endswith('/package') else bad)
                self.assertFalse(root.exists())

    def test_mismatched_stored_manifest_identity_is_rejected_before_artifact_fetch(self):
        good = self.fixture()
        record = json.loads(good('/jobs/job/package', 262144))
        record['manifest']['package_sha256'] = 'c' * 64
        calls = []
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'review'
            with self.assertRaisesRegex(ValueError, 'MANIFEST_IDENTITY_MISMATCH'):
                module.export_package('https://example.com/api/print', 'job', root, 'k'*32,
                    lambda route, limit: calls.append(route) or json.dumps(record).encode())
            self.assertEqual(calls, ['/jobs/job/package'])
            self.assertFalse(root.exists())

    def test_package_outside_exact_review_hold_is_rejected_before_artifact_fetch(self):
        good = self.fixture()
        for state, reason in (('qa_passed', None), ('submitted', None),
                              ('qa_failed', 'QA_FAILED'), ('qa_failed', None)):
            record = json.loads(good('/jobs/job/package', 262144))
            record['state'], record['reason_code'] = state, reason
            calls = []
            with tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp) / 'review'
                with self.assertRaisesRegex(ValueError, 'REVIEW_STATE_INVALID'):
                    module.export_package('https://example.com/api/print', 'job', root, 'k'*32,
                        lambda route, limit: calls.append(route) or json.dumps(record).encode())
                self.assertEqual(calls, ['/jobs/job/package'])
                self.assertFalse(root.exists())

    def test_traversal_rejected_before_writing(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'review'
            with self.assertRaisesRegex(ValueError, 'FILES_INVALID'):
                module.export_package('https://example.com/api/print', 'job', root, 'k'*32, self.fixture('../escape'))
            self.assertFalse(root.exists())

    def test_insecure_endpoint_rejected_before_request(self):
        with self.assertRaisesRegex(ValueError, 'ENDPOINT_INVALID'):
            module.export_package('http://example.com', 'job', 'unused', 'k'*32, lambda *_: self.fail('request'))

    def test_duplicate_decoded_record_keys_are_rejected_before_writing(self):
        good = self.fixture()
        record = good('/jobs/job/package', 262144).decode()
        ambiguous = record.replace('"id": "job"', '"id": "other", "\\u0069d": "job"')
        self.assertNotEqual(ambiguous, record)
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'review'
            with self.assertRaises(ValueError):
                module.export_package('https://example.com/api/print', 'job', root, 'k'*32,
                    lambda route, limit: ambiguous.encode() if route.endswith('/package') else good(route, limit))
            self.assertFalse(root.exists())

    def test_queue_and_manifest_marketplaces_must_match_before_writing(self):
        good = self.fixture()
        record = json.loads(good('/jobs/job/package', 262144))
        record['manifest']['platform'] = 'etsy'
        unsigned = {k: v for k, v in record['manifest'].items() if k != 'package_sha256'}
        record['manifest']['package_sha256'] = hashlib.sha256(
            json.dumps(unsigned, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'review'
            with self.assertRaisesRegex(ValueError, 'MANIFEST_INVALID'):
                module.export_package('https://example.com/api/print', 'job', root, 'k'*32,
                    lambda route, limit: json.dumps(record).encode() if route.endswith('/package') else good(route, limit))
            self.assertFalse(root.exists())

    def test_incomplete_or_extra_marketplace_artifact_sets_are_rejected(self):
        body = b'fixture bytes'
        sha = hashlib.sha256(body).hexdigest()
        for files in ({'print.png': sha},
                      {'art-mask.png': sha, 'print.png': sha, 'text-mask.png': sha, 'debug.txt': sha}):
            manifest = {'schema_version': 1, 'publication_enabled': False,
                        'platform': 'redbubble', 'files': files}
            manifest['package_sha256'] = hashlib.sha256(json.dumps(
                manifest, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
            record = stored_record(manifest)
            with tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp) / 'review'
                with self.assertRaisesRegex(ValueError, 'FILES_INVALID'):
                    module.export_package('https://example.com/api/print', 'job', root, 'k'*32,
                        lambda route, limit: record if route.endswith('/package') else body)
                self.assertFalse(root.exists())

    def test_exact_kdp_artifact_set_is_restored_without_approval(self):
        bodies = {'art-mask.png': png_bytes(1), 'print.png': png_bytes(2),
                  'text-mask.png': png_bytes(3), 'cover.pdf': PDF_BYTES,
                  'interior.pdf': PDF_BYTES, 'interior.receipt.json': JSON_BYTES}
        files = {name: hashlib.sha256(body).hexdigest() for name, body in bodies.items()}
        by_hash = {files[name]: body for name, body in bodies.items()}
        manifest = {'schema_version': 1, 'publication_enabled': False,
                    'platform': 'kdp', 'files': files}
        manifest['package_sha256'] = hashlib.sha256(json.dumps(
            manifest, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
        record = stored_record(manifest)
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'review'
            result = module.export_package('https://example.com/api/print', 'job', root, 'k'*32,
                lambda route, limit: record if route.endswith('/package') else by_hash[route.rsplit('/', 1)[-1]])
            self.assertEqual(result['status'], 'REVIEW_REQUIRED')
            self.assertEqual(set(path.name for path in root.iterdir()), {*files, 'manifest.json'})
            for name, body in bodies.items():
                self.assertEqual((root/name).read_bytes(), body)

    def test_hash_correct_malformed_kdp_pdf_and_json_are_rejected(self):
        base = {'art-mask.png': png_bytes(1), 'print.png': png_bytes(2),
                'text-mask.png': png_bytes(3), 'cover.pdf': PDF_BYTES,
                'interior.pdf': PDF_BYTES, 'interior.receipt.json': JSON_BYTES}
        for name, bad in (('cover.pdf', b'%PDF-1.8\n%%EOF'),
                          ('interior.receipt.json', b'{"a":1,"a":2}'),
                          ('interior.receipt.json', b'[1]'),
                          ('interior.receipt.json', b'{"unsafe":9007199254740992.0}')):
            bodies = {**base, name: bad}
            files = {item: hashlib.sha256(body).hexdigest() for item, body in bodies.items()}
            by_hash = {files[item]: body for item, body in bodies.items()}
            manifest = {'schema_version': 1, 'publication_enabled': False,
                        'platform': 'kdp', 'files': files}
            manifest['package_sha256'] = hashlib.sha256(json.dumps(
                manifest, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
            record = stored_record(manifest)
            with self.subTest(name=name), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp) / 'review'
                with self.assertRaisesRegex(ValueError, 'ARTIFACT_INVALID'):
                    module.export_package('https://example.com/api/print', 'job', root, 'k'*32,
                        lambda route, limit: record if route.endswith('/package') else by_hash[route.rsplit('/', 1)[-1]])
                self.assertFalse(root.exists())


class ExportDeadlineTests(unittest.TestCase):
    @contextlib.contextmanager
    def server(self, slow):
        first,second,third=png_bytes(1),png_bytes(2,96),png_bytes(3)
        sha1,sha2,sha3=[hashlib.sha256(b).hexdigest() for b in (first,second,third)]
        manifest={'schema_version':1,'publication_enabled':False,'platform':'redbubble',
                  'files':{'art-mask.png':sha1,'print.png':sha2,'text-mask.png':sha3}}
        manifest['package_sha256']=hashlib.sha256(json.dumps(manifest,sort_keys=True,separators=(',',':')).encode()).hexdigest()
        record=stored_record(manifest)
        class Handler(http.server.BaseHTTPRequestHandler):
            def log_message(self,*args): pass
            def do_GET(self):
                package=self.path.endswith('/package')
                body=record if package else first if self.path.endswith(sha1) else second if self.path.endswith(sha2) else third
                if package and slow=='headers': time.sleep(.4)
                try:
                    self.send_response(200);self.send_header('Content-Length',str(len(body)));self.end_headers()
                    if (package and slow=='manifest') or (self.path.endswith(sha2) and slow=='artifact'):
                        # Each socket read makes progress well within its idle
                        # timeout, but the complete response exceeds the budget.
                        for start in range(0,len(body),8):
                            self.wfile.write(body[start:start+8]);self.wfile.flush();time.sleep(.015)
                    else: self.wfile.write(body)
                except (BrokenPipeError,ConnectionResetError): pass
        server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        original=urllib.request.build_opener(module.NoRedirect)
        class LocalOpener:
            def open(self,request,timeout):
                # Only the fixture transport maps the validated HTTPS endpoint
                # to a local HTTP server; production URL/TLS rules are unchanged.
                route=urllib.parse.urlsplit(request.full_url).path
                local=urllib.request.Request('http://127.0.0.1:'+str(server.server_port)+route,
                    headers=dict(request.header_items()))
                return original.open(local,timeout=timeout)
        try:
            with patch.object(module.urllib.request,'build_opener',return_value=LocalOpener()): yield
        finally:
            server.shutdown();server.server_close();thread.join(1)

    def check_timeout(self, mode):
        with tempfile.TemporaryDirectory() as tmp, self.server(mode), \
                patch.object(module,'REQUEST_TIMEOUT_SECONDS',.12,create=True):
            root=Path(tmp)/'review';handler=signal.getsignal(signal.SIGALRM)
            start=time.monotonic()
            with self.assertRaisesRegex(ValueError,'^RESPONSE_DEADLINE_EXCEEDED$'):
                module.export_package('https://example.invalid/api/print','job',root,'k'*32)
            self.assertLess(time.monotonic()-start,.8)
            self.assertFalse(root.exists())
            self.assertEqual(signal.getitimer(signal.ITIMER_REAL),(0.0,0.0))
            self.assertEqual(signal.getsignal(signal.SIGALRM),handler)

    def test_slow_drip_manifest_cannot_extend_request_deadline(self): self.check_timeout('manifest')
    def test_response_headers_are_inside_request_deadline(self): self.check_timeout('headers')
    def test_slow_artifact_removes_already_written_partial_package(self): self.check_timeout('artifact')

    def test_fast_http_restore_preserves_hashes_and_review_hold(self):
        with tempfile.TemporaryDirectory() as tmp,self.server(None):
            root=Path(tmp)/'review'
            result=module.export_package('https://example.invalid/api/print','job',root,'k'*32)
            self.assertEqual(result['status'],'REVIEW_REQUIRED')
            self.assertFalse(result['publication_enabled'])
            self.assertEqual((root/'art-mask.png').read_bytes(),png_bytes(1))
            self.assertEqual((root/'print.png').read_bytes(),png_bytes(2,96))
            self.assertEqual((root/'text-mask.png').read_bytes(),png_bytes(3))

    def test_existing_alarm_is_not_replaced_and_network_is_not_opened(self):
        handler=signal.getsignal(signal.SIGALRM)
        signal.setitimer(signal.ITIMER_REAL,30)
        try:
            with patch.object(module.urllib.request,'build_opener') as build:
                with self.assertRaisesRegex(ValueError,'^RESPONSE_DEADLINE_TIMER_IN_USE$'):
                    module.export_package('https://example.invalid/api/print','job','unused','k'*32)
                build.return_value.open.assert_not_called()
            self.assertGreater(signal.getitimer(signal.ITIMER_REAL)[0],0)
            self.assertEqual(signal.getsignal(signal.SIGALRM),handler)
        finally: signal.setitimer(signal.ITIMER_REAL,0)

    def test_nonmain_thread_fails_before_network_access(self):
        errors=[]
        def export():
            try: module.export_package('https://example.invalid/api/print','job','unused','k'*32)
            except ValueError as exc: errors.append(str(exc))
        with patch.object(module.urllib.request,'build_opener') as build:
            thread=threading.Thread(target=export);thread.start();thread.join(1)
            self.assertFalse(thread.is_alive())
            build.return_value.open.assert_not_called()
        self.assertEqual(errors,['RESPONSE_DEADLINE_UNAVAILABLE'])

    def test_late_return_is_rejected_even_if_alarm_callback_was_delayed(self):
        with patch.object(module.time,'monotonic',side_effect=[1,21]):
            with self.assertRaisesRegex(ValueError,'^RESPONSE_DEADLINE_EXCEEDED$'):
                with module.request_deadline(): pass
        self.assertEqual(signal.getitimer(signal.ITIMER_REAL),(0.0,0.0))

    def test_previous_handler_restored_after_success_and_failure(self):
        previous=signal.getsignal(signal.SIGALRM)
        def handler(*_): raise AssertionError('old handler should not run')
        signal.signal(signal.SIGALRM,handler)
        try:
            with module.request_deadline(): pass
            self.assertIs(signal.getsignal(signal.SIGALRM),handler)
            with self.assertRaisesRegex(RuntimeError,'fixture'):
                with module.request_deadline(): raise RuntimeError('fixture')
            self.assertIs(signal.getsignal(signal.SIGALRM),handler)
            self.assertEqual(signal.getitimer(signal.ITIMER_REAL),(0.0,0.0))
        finally: signal.signal(signal.SIGALRM,previous)

if __name__ == '__main__':
    unittest.main()
