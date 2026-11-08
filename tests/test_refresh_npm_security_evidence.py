"""Synthetic only: all Git/npm invocations mocked, no registry requests."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'scripts'))
import refresh_npm_security_evidence as evidence
from test_npm_security_audit import fixture

class RefreshTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)/'checkout'; self.root.mkdir()
        for name in ('package.json','package-lock.json'):
            (self.root/name).write_text('{}')
        self.output = Path(self.tmp.name)/'evidence.json'
        self.sha = 'a'*40; self.dirty = ''; self.calls = []
        self.raw = fixture(); self.code = 0; self.mutate = False
    def runner(self, command, **kwargs):
        self.calls.append(command)
        if command[0]=='git':
            stdout = str(self.root) if command[-1]=='--show-toplevel' else self.sha if command[-1]=='HEAD' else self.dirty
            return SimpleNamespace(returncode=0,stdout=stdout)
        if self.mutate:
            (self.root/'package-lock.json').write_text('{"changed":true}')
        return SimpleNamespace(returncode=self.code,stdout=json.dumps(self.raw))
    def refresh(self):
        return evidence.refresh(self.root,'a'*40,self.output,self.runner)
    def test_fresh_clean_mock_scan_publishes_bound_local_bundle(self):
        bundle = self.refresh()
        self.assertFalse(bundle['provenance']['github_attested'])
        self.assertEqual(bundle['provenance']['origin'],'local_scan')
        self.assertEqual(bundle['provenance']['report_sha256'],evidence.digest(evidence.encoded(bundle['report'])))
        self.assertEqual(bundle['provenance']['raw_sha256'],evidence.digest(evidence.encoded(bundle['raw_audit'])))
        self.assertEqual(json.loads(self.output.read_text()),bundle)
        commands=[c for c in self.calls if c[0]=='npm']
        self.assertEqual(len(commands),1)
        self.assertIn('--ignore-scripts',commands[0])
        self.assertIn('--registry=https://registry.npmjs.org',commands[0])
    def test_dirty_or_wrong_source_refuses_before_scan(self):
        for sha,dirty in [('b'*40,''),('a'*40,' M package.json')]:
            self.sha,self.dirty=sha,dirty; self.calls=[]
            with self.assertRaises(ValueError):self.refresh()
            self.assertFalse(any(c[0]=='npm' for c in self.calls))
    def test_lock_changed_during_scan_refuses(self):
        self.mutate=True
        with self.assertRaises(ValueError):self.refresh()
        self.assertFalse(self.output.exists())
    def test_failure_findings_and_malformed_evidence_refuse(self):
        for raw,code in [(fixture('high'),1),(fixture(),1),(fixture(),2),({},0),(None,0)]:
            self.raw,self.code=raw,code
            with self.assertRaises(ValueError):self.refresh()
            self.assertFalse(self.output.exists())
    def test_existing_evidence_not_overwritten(self):
        self.output.write_text('existing')
        with self.assertRaises(ValueError):self.refresh()
        self.assertEqual(self.output.read_text(),'existing')
        self.assertEqual(self.calls,[])
    def test_symlink_manifest_refused(self):
        manifest=self.root/'package.json'; manifest.unlink()
        manifest.symlink_to(self.root/'package-lock.json')
        with self.assertRaises(ValueError):self.refresh()
        self.assertFalse(self.output.exists())
    def test_verification_uses_current_checkout(self):
        self.refresh()
        result=evidence.verify_local_bundle(self.output,self.root,'a'*40,self.runner)
        self.assertEqual(result['status'],'PASS')
        (self.root/'package.json').write_text('{"changed":true}')
        with self.assertRaises(ValueError):
            evidence.verify_local_bundle(self.output,self.root,'a'*40,self.runner)
    def test_verification_rejects_tampering_and_scope_changes(self):
        import copy
        bundle=self.refresh(); expected=evidence.identity(self.root,self.runner)
        for field,value in [('origin','github'),('source_sha','b'*40),('exit_code',True),('raw_sha256','bad'),('report_sha256','bad'),('command',[]),('started_at',None)]:
            changed=copy.deepcopy(bundle); changed['provenance'][field]=value
            with self.subTest(field=field),self.assertRaises(ValueError):evidence.verify_bundle(changed,expected)
        changed=copy.deepcopy(bundle); changed['raw_audit']=fixture('high')
        changed['provenance']['raw_sha256']=evidence.digest(evidence.encoded(changed['raw_audit']))
        with self.assertRaises(ValueError):evidence.verify_bundle(changed,expected)
    def test_scan_isolated_from_checkout_configs_and_environment(self):
        import os
        from unittest.mock import patch
        original = self.runner
        def inspect(command, **kwargs):
            if command[0] == 'npm':
                cwd = kwargs['cwd']; env = kwargs['env']
                self.assertNotEqual(cwd,self.root)
                for name in ('package.json','package-lock.json'):
                    self.assertEqual((cwd/name).read_bytes(),(self.root/name).read_bytes())
                self.assertNotIn('NODE_OPTIONS',env)
                self.assertNotIn('npm_config_registry',env)
                self.assertNotIn('SECRET_TEST_TOKEN',env)
                self.assertNotEqual(env['NPM_CONFIG_USERCONFIG'],env['NPM_CONFIG_GLOBALCONFIG'])
                self.assertEqual(Path(env['NPM_CONFIG_USERCONFIG']).read_text(),'')
                self.assertEqual(Path(env['NPM_CONFIG_GLOBALCONFIG']).read_text(),'')
                self.assertFalse(Path(env['NPM_CONFIG_CACHE']).exists())
                self.assertIn('--fetch-retries=0',command)
                self.assertIn('--fetch-timeout=20000',command)
            return original(command,**kwargs)
        with patch.dict(os.environ,{'NODE_OPTIONS':'bad','npm_config_registry':'https://invalid.example','SECRET_TEST_TOKEN':'synthetic'}):
            evidence.refresh(self.root,'a'*40,self.output,inspect)
    def test_isolated_manifest_modification_refused(self):
        original=self.runner
        def modify(command,**kwargs):
            result=original(command,**kwargs)
            if command[0]=='npm':
                (kwargs['cwd']/'package-lock.json').write_text('changed')
            return result
        with self.assertRaises(ValueError):
            evidence.refresh(self.root,'a'*40,self.output,modify)
        self.assertFalse(self.output.exists())
    def test_entrypoint_import_does_not_create_bytecode(self):
        import shutil, subprocess
        with tempfile.TemporaryDirectory() as tmp:
            scripts=Path(tmp)/'scripts'; scripts.mkdir()
            for name in ('refresh_npm_security_evidence.py','normalize_npm_security_audit.py'):
                shutil.copyfile(ROOT/'scripts'/name,scripts/name)
            # --help loads local modules but performs no Git or npm operations.
            run=subprocess.run([sys.executable,str(scripts/'refresh_npm_security_evidence.py'),'--help'],capture_output=True)
            self.assertEqual(run.returncode,0)
            self.assertFalse((scripts/'__pycache__').exists())
    def test_failure_diagnostics_only_allowlisted_error_code(self):
        self.raw={'error':{'code':'ENOTFOUND','summary':'secret-value-not-for-output'}}; self.code=1
        with self.assertRaisesRegex(ValueError,'exit=1 status=ERROR npm_error=ENOTFOUND') as caught:
            self.refresh()
        self.assertNotIn('secret-value',str(caught.exception))
        self.raw={'error':{'code':'secret-value-not-for-output'}}
        with self.assertRaisesRegex(ValueError,'npm_error=UNRECOGNIZED') as caught:
            self.refresh()
        self.assertNotIn('secret-value',str(caught.exception))
        self.assertFalse(self.output.exists())
    def test_nonjson_diagnostics_do_not_echo_payload(self):
        original=self.runner
        def malformed(command,**kwargs):
            result=original(command,**kwargs)
            if command[0]=='npm':
                result.stdout='secret-value-invalid-json'; result.returncode=127
            return result
        with self.assertRaisesRegex(ValueError,'exit=127 status=ERROR npm_error=INVALID_JSON') as caught:
            evidence.refresh(self.root,'a'*40,self.output,malformed)
        self.assertNotIn('secret-value',str(caught.exception))
        self.assertFalse(self.output.exists())
    def test_existing_platform_routing_preserved_without_recording_values(self):
        import os
        from unittest.mock import patch
        keys=('HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY','http_proxy','https_proxy','all_proxy','no_proxy')
        # Synthetic routing markers only. Never inspect actual platform values.
        synthetic={key:'synthetic-routing-marker-'+key for key in keys}
        original=self.runner
        def inspect(command,**kwargs):
            if command[0]=='npm':
                self.assertTrue(all(kwargs['env'].get(key)==value for key,value in synthetic.items()))
            return original(command,**kwargs)
        with patch.dict(os.environ,synthetic):
            bundle=evidence.refresh(self.root,'a'*40,self.output,inspect)
        serialized=json.dumps(bundle)
        self.assertNotIn('synthetic-routing-marker',serialized)
        self.assertIn('platform_transport',bundle['provenance']['scan_scope'])
    def test_schema_and_http_diagnostics_do_not_expose_response(self):
        self.raw={'message':'HTTP error 403 secret-route-value','statusCode':403,'private-secret-key':'private-value'}
        self.code=1
        with self.assertRaises(ValueError) as caught:self.refresh()
        text=str(caught.exception)
        self.assertIn('"http_status": 403',text)
        self.assertIn('missing vulnerability inventory',text)
        self.assertIn('"recognized_keys_present": ["message", "statusCode"]',text)
        for forbidden in ('secret-route-value','private-secret-key','private-value'):
            self.assertNotIn(forbidden,text)
        self.assertFalse(self.output.exists())
    def test_existing_tls_trust_preserved_but_verification_bypass_excluded(self):
        import os
        from unittest.mock import patch
        original=self.runner
        synthetic={'NODE_EXTRA_CA_CERTS':'synthetic-ca-path','SSL_CERT_FILE':'synthetic-cert-path','NODE_TLS_REJECT_UNAUTHORIZED':'0'}
        def inspect(command,**kwargs):
            if command[0]=='npm':
                self.assertTrue(kwargs['env'].get('NODE_EXTRA_CA_CERTS')==synthetic['NODE_EXTRA_CA_CERTS'])
                self.assertTrue(kwargs['env'].get('SSL_CERT_FILE')==synthetic['SSL_CERT_FILE'])
                self.assertNotIn('NODE_TLS_REJECT_UNAUTHORIZED',kwargs['env'])
                self.assertNotIn('--strict-ssl=false',command)
            return original(command,**kwargs)
        with patch.dict(os.environ,synthetic):
            bundle=evidence.refresh(self.root,'a'*40,self.output,inspect)
        serialized=json.dumps(bundle)
        self.assertNotIn('synthetic-ca-path',serialized)
        self.assertNotIn('synthetic-cert-path',serialized)
        self.assertIn('existing_tls_trust',bundle['provenance']['scan_scope'])
