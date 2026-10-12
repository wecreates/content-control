import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from scripts.production_memory import ROOT, snapshot, sha


class ProductionMemoryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.doc = {'publication_enabled': False, 'project_id': 'test', 'scenes': [{'id': 'one', 'start': 0, 'end': 1, 'characters': [{'id': 'dave'}], 'props': [{'id': 'wallet'}], 'environment': {'id': 'white_stage'}, 'audio': {'dialogue': [{'speaker': 'dave', 'text': 'Original line'}]}}]}
        (self.root / 'voice.wav').write_bytes(b'hashed existing clip fixture')
        (self.root / 'candidate.mp4').write_bytes(b'candidate fixture; QA externally verified')
        self.manifest = {'publication_enabled': False, 'provider': 'kokoro', 'model_id': 'Kokoro-82M', 'voice_assignments': {'dave': 'am_fenrir'}, 'clips': [{'file': 'voice.wav', 'scene_id': 'one', 'speaker': 'dave', 'voice_id': 'am_fenrir', 'text_sha256': hashlib.sha256(b'Original line').hexdigest(), 'audio_sha256': sha(self.root / 'voice.wav')}]}
        self.qa = {'publication_enabled': False, 'status': 'PASS', 'candidate_sha256': sha(self.root / 'candidate.mp4'), 'checks': dict.fromkeys(('decodes', 'complete_av_decode', 'audio_present', 'audio_audible', 'audio_covers_video', 'duration_match', 'no_black', 'no_duplicate_run', 'motion_alive', 'safe_border', 'publication_disabled'), True)}

    def run_snapshot(self, **kwargs):
        for name, value in [('ccsd', self.doc), ('manifest', self.manifest), ('qa', self.qa)]:
            (self.root / (name + '.json')).write_text(json.dumps(value))
        return snapshot(self.root / 'ccsd.json', self.root / 'manifest.json', self.root / 'candidate.mp4', self.root / 'qa.json', **kwargs)

    def test_hash_bound_existing_continuity_shape_without_creative_promotion(self):
        result = self.run_snapshot()
        self.assertEqual(result['scene_count'], 1)
        self.assertEqual(result['entries'][0]['characters'], ['dave'])
        self.assertEqual(result['candidate_sha256'], self.qa['candidate_sha256'])
        self.assertEqual(result['successful_hooks'], [])
        self.assertFalse(result['production_approved'])
        self.assertEqual(result['visual_identity_review'], 'PENDING')
        self.assertIn('remotion/CharacterSystem.jsx', result['identity_sources'])

    def test_identity_source_drift_rejected_against_explicit_baseline(self):
        baseline = self.run_snapshot()
        baseline['identity_sources']['remotion/CharacterSystem.jsx'] = 'changed'
        with self.assertRaisesRegex(ValueError, 'identity or voice policy drift'):
            self.run_snapshot(baseline=baseline)

    def test_unknown_character_and_altered_silhouette_rejected(self):
        character = self.doc['scenes'][0]['characters'][0]
        character['id'] = 'unlocked'
        with self.assertRaisesRegex(ValueError, 'Unknown locked'):self.run_snapshot()
        character.update(id='dave', silhouette='unapproved replacement')
        with self.assertRaisesRegex(ValueError, 'identity drift'):self.run_snapshot()

    def test_voice_identity_and_nonverbal_speaker_rejected(self):
        self.manifest['voice_assignments']['dave'] = 'am_adam'
        with self.assertRaisesRegex(ValueError, 'Voice assignment drift'):self.run_snapshot()
        self.manifest['voice_assignments']['dave'] = 'am_fenrir'
        self.doc['scenes'][0]['audio']['dialogue'][0]['speaker'] = 'cashback_goblin'
        with self.assertRaisesRegex(ValueError, 'nonverbal'):self.run_snapshot()

    def test_candidate_or_voice_tampering_rejected(self):
        self.qa['candidate_sha256'] = 'wrong'
        with self.assertRaisesRegex(ValueError, 'candidate hash'):self.run_snapshot()
        self.qa['candidate_sha256'] = sha(self.root / 'candidate.mp4')
        (self.root / 'voice.wav').write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError, 'clip hash'):self.run_snapshot()

    def test_failed_or_incomplete_qa_never_enters_memory(self):
        self.qa['checks']['audio_audible'] = False
        with self.assertRaisesRegex(ValueError, 'technical media QA'):self.run_snapshot()
        del self.qa['checks']['audio_audible']
        with self.assertRaisesRegex(ValueError, 'technical media QA'):self.run_snapshot()


if __name__ == '__main__':unittest.main()
