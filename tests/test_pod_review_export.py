import hashlib
import importlib.util
import json
from pathlib import Path
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

class ExportTests(unittest.TestCase):
    def fixture(self, name='art.png'):
        body = b'fixture bytes'
        manifest = {'schema_version': 1, 'publication_enabled': False, 'platform': 'redbubble',
                    'files': {name: hashlib.sha256(body).hexdigest()}}
        manifest['package_sha256'] = hashlib.sha256(json.dumps(manifest, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
        record = json.dumps({'id': 'job', 'platform': 'redbubble', 'manifest': manifest}).encode()
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


class ExportDeadlineTests(unittest.TestCase):
    @contextlib.contextmanager
    def server(self, slow):
        first,second=b'first fixture',b'second fixture'*32
        sha1,sha2=[hashlib.sha256(b).hexdigest() for b in (first,second)]
        manifest={'schema_version':1,'publication_enabled':False,'platform':'redbubble',
                  'files':{'first.bin':sha1,'second.bin':sha2}}
        manifest['package_sha256']=hashlib.sha256(json.dumps(manifest,sort_keys=True,separators=(',',':')).encode()).hexdigest()
        record=json.dumps({'id':'job','platform':'redbubble','manifest':manifest}).encode()
        class Handler(http.server.BaseHTTPRequestHandler):
            def log_message(self,*args): pass
            def do_GET(self):
                package=self.path.endswith('/package')
                body=record if package else first if self.path.endswith(sha1) else second
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
            self.assertEqual((root/'first.bin').read_bytes(),b'first fixture')
            self.assertEqual((root/'second.bin').read_bytes(),b'second fixture'*32)

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
