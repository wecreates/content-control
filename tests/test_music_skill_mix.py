import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from scripts.music_skill_mix import handoff, REQUIRED

class MusicHandoffTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.kw = {'out_dir': self.root/'out', 'ccsd': {'publication_enabled': False}, 'sfx': []}
        for name, data in [('project', b'{}'), ('music', b'audio'), ('voice', b'voice'), ('fx1', b'x'), ('fx2', b'y')]:
            path = self.root/name; path.write_bytes(data)
            if name.startswith('fx'): self.kw['sfx'].append(path)
            else: self.kw[name] = path
            if name in ('project', 'music'): self.kw[name+'_sha256'] = hashlib.sha256(data).hexdigest()
        self.record = {'status': 'TECHNICAL_PASS_AUDITION_PENDING', 'project_sha256': self.kw['project_sha256'], 'checks': dict.fromkeys(REQUIRED, True)}
        self.save_report()
    def save_report(self):
        data = json.dumps(self.record).encode(); p = self.root/'report'; p.write_bytes(data)
        self.kw.update(report=p, report_sha256=hashlib.sha256(data).hexdigest())
    def fake_mix(self, voice, ccsd, music, effects, out):
        self.assertEqual(Path(music).read_bytes(), b'audio'); out.mkdir()
        return {'status': 'PASS', 'publication_enabled': False, 'outputs': {}}
    def test_snapshot_and_no_promotion(self):
        with patch('scripts.music_skill_mix.mix', side_effect=self.fake_mix): result = handoff(**self.kw)
        self.assertFalse(result['production_approved']); self.assertFalse(result['creative_approved'])
        self.assertEqual(result['status'], 'TECHNICAL_PASS_AUDITION_PENDING')
    def test_changed_music_rejected(self):
        self.kw['music'].write_bytes(b'new')
        with self.assertRaises(ValueError): handoff(**self.kw)
    def test_existing_output_rejected(self):
        self.kw['out_dir'].mkdir()
        with self.assertRaises(ValueError): handoff(**self.kw)
    def test_project_mismatch(self):
        self.record['project_sha256'] = '0'*64; self.save_report()
        with self.assertRaises(ValueError): handoff(**self.kw)
    def test_failed_check(self):
        self.record['checks']['finite'] = False; self.save_report()
        with self.assertRaises(ValueError): handoff(**self.kw)
    def test_bad_hash(self):
        self.kw['music_sha256'] = 'x'
        with self.assertRaises(ValueError): handoff(**self.kw)
    def test_wrong_status(self):
        self.record['status'] = 'PASS'; self.save_report()
        with self.assertRaises(ValueError): handoff(**self.kw)
if __name__ == '__main__': unittest.main()
