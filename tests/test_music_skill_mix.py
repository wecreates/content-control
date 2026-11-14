import io
import wave
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
        buf = io.BytesIO()
        with wave.open(buf, 'wb') as w:
            w.setparams((1, 2, 44100, 0, 'NONE', '')); w.writeframes(b'\x01\x00' * 100)
        self.audio = buf.getvalue()
        for name, data in [('project', b'{}'), *[(n, self.audio) for n in ('music', 'voice', 'fx1', 'fx2')]]:
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
        self.assertEqual(Path(music).read_bytes(), self.audio); self.assertTrue(out.is_dir())
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
    def test_atomic_output_reservation(self):
        original = Path.mkdir
        def raced(path, *args, **kwargs):
            if path == self.kw['out_dir']:
                original(path)
                (path/'keep').write_text('preserve')
            return original(path, *args, **kwargs)
        with patch.object(Path, 'mkdir', raced), patch('scripts.music_skill_mix.mix') as mixer:
            with self.assertRaises(FileExistsError): handoff(**self.kw)
            mixer.assert_not_called()
        self.assertEqual((self.kw['out_dir']/'keep').read_text(), 'preserve')
    def test_malformed_checks(self):
        self.record['checks'] = []; self.save_report()
        with self.assertRaises(ValueError): handoff(**self.kw)
    def test_project_mismatch(self):
        self.record['project_sha256'] = '0'*64; self.save_report()
        with self.assertRaises(ValueError): handoff(**self.kw)
    def test_failed_check(self):
        self.record['checks']['finite'] = False; self.save_report()
        with self.assertRaises(ValueError): handoff(**self.kw)
    def test_playlist_rejected(self):
        self.kw['voice'].write_bytes(b'#EXTM3U\nhttp://example.com/audio')
        with self.assertRaises(ValueError): handoff(**self.kw)
        self.assertFalse(self.kw['out_dir'].exists())
    def test_bad_hash(self):
        self.kw['music_sha256'] = 'x'
        with self.assertRaises(ValueError): handoff(**self.kw)
    def test_wrong_status(self):
        self.record['status'] = 'PASS'; self.save_report()
        with self.assertRaises(ValueError): handoff(**self.kw)
if __name__ == '__main__': unittest.main()
