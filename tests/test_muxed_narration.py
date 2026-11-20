import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from scripts.verify_muxed_narration import REQUIRED, verify


class MuxedNarrationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.video = self.root / 'video.mp4'
        self.video.write_bytes(b'explicit synthetic candidate fixture')
        self.contract_path, self.transcription_path = self.root / 'contract.json', self.root / 'transcript.json'
        self.contract = {'publication_enabled': False, 'narration_text': 'Spend $80 and receive $20. Keep sixty dollars.'}
        self.transcription = {'publication_enabled': False, 'engine': 'faster-whisper', 'status': 'PASS',
            'audio_sha256': hashlib.sha256(self.video.read_bytes()).hexdigest(),
            'expected_text': self.contract['narration_text'],
            'actual_transcript': 'Spend eighty dollars and receive twenty dollars. Keep sixty dollars.',
            'checks': {k: True for k in REQUIRED}}

    def run_gate(self):
        self.contract_path.write_text(json.dumps(self.contract))
        self.transcription_path.write_text(json.dumps(self.transcription))
        return verify(self.video, self.contract_path, self.transcription_path)

    def test_exact_words_and_encoded_candidate_pass_without_creative_approval(self):
        result = self.run_gate()
        self.assertEqual(result['status'], 'PASS')
        self.assertFalse(result['production_approved'])
        self.assertFalse(result['publication_enabled'])

    def test_wrong_words_amounts_units_and_order_fail(self):
        for text in ('Spend eighty and receive twenty. Keep sixty.',
                     'Spend ninety dollars and receive twenty dollars. Keep sixty dollars.',
                     'Receive twenty dollars and spend eighty dollars. Keep sixty dollars.'):
            with self.subTest(text=text):
                self.transcription['actual_transcript'] = text
                self.assertIn('exact_spoken_words_match', self.run_gate()['failed_checks'])

    def test_stale_candidate_or_source_mp3_receipt_cannot_pass(self):
        for digest in (None, 'a' * 64, ''):
            self.transcription['audio_sha256'] = digest
            self.assertIn('candidate_identity_bound', self.run_gate()['failed_checks'])

    def test_video_changed_after_transcription_fails(self):
        self.video.write_bytes(self.video.read_bytes() + b'changed')
        self.assertIn('candidate_identity_bound', self.run_gate()['failed_checks'])

    def test_changed_contract_cannot_reuse_old_approval(self):
        self.contract['narration_text'] = 'Different script.'
        self.assertIn('approved_script_bound', self.run_gate()['failed_checks'])

    def test_failed_incomplete_or_enabled_transcription_fails(self):
        original = copy.deepcopy(self.transcription)
        for changes in ({'status': 'FAIL'}, {'checks': {}}, {'checks': []},
                        {'publication_enabled': True}, {'engine': 'manual'}, {'actual_transcript': ''}):
            with self.subTest(changes=changes):
                self.transcription = {**original, **changes}
                self.assertEqual(self.run_gate()['status'], 'FAIL')
        self.transcription = original
        for key in REQUIRED:
            self.transcription['checks'] = {k: k != key for k in REQUIRED}
            self.assertEqual(self.run_gate()['status'], 'FAIL')

    def test_missing_empty_or_non_speech_contract_and_text_cannot_pass(self):
        for text in (None, '', '   ', '...'):
            with self.subTest(text=text):
                self.contract['narration_text'] = text
                self.transcription['expected_text'] = text
                self.transcription['actual_transcript'] = text
                self.assertEqual(self.run_gate()['status'], 'FAIL')
        self.contract.pop('narration_text')
        self.transcription.pop('expected_text')
        self.transcription.pop('actual_transcript')
        self.assertEqual(self.run_gate()['status'], 'FAIL')

    def test_timing_jitter_does_not_change_word_acceptance(self):
        self.transcription['segments'] = [{'start': .14, 'end': 25.64}]
        self.assertEqual(self.run_gate()['status'], 'PASS')

    def test_missing_or_malformed_input_fails(self):
        self.run_gate()
        for contents in ('null', '{bad'):
            self.transcription_path.write_text(contents)
            self.assertEqual(verify(self.video, self.contract_path, self.transcription_path)['status'], 'FAIL')
        self.video.unlink()
        self.assertEqual(verify(self.video, self.contract_path, self.transcription_path)['status'], 'FAIL')
