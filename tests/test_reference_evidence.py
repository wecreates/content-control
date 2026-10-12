import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts import decompose_reference_video as decomposition
from scripts.reference_clone_compiler import compile_clone
from scripts.reference_clone_enrich import merge
from scripts.validate_reference_clone import validate_reference


class ReferenceEvidenceTests(unittest.TestCase):
    def decompose(self):
        with tempfile.TemporaryDirectory() as folder:
            out = Path(folder) / 'reference.json'
            argv = ['decompose', '--video', 'fixture.mp4', '--id', 'fixture', '--out', str(out)]
            with patch('sys.argv', argv), patch.object(decomposition, 'probe', return_value={'format': {'duration': '4'}}), patch.object(decomposition, 'sha256', return_value='a' * 64), patch.object(decomposition, 'scene_cuts', return_value=[2]), patch.object(decomposition, 'motion_samples', return_value=[{'time': .5, 'activity': .2}, {'time': 2.5, 'activity': .1}]), patch.object(decomposition, 'silence_events', return_value=[]), patch.object(decomposition, 'visual_fingerprint', return_value={}), patch('builtins.print'):
                decomposition.main()
            return json.loads(out.read_text())

    def test_pixel_activity_does_not_invent_semantics(self):
        ref = self.decompose()
        for shot in ref['shot_timeline']:
            for key in ('shot_scale', 'camera', 'character_action', 'prop_action', 'why_it_retains'):
                self.assertIsNone(shot[key])
        self.assertEqual(ref['motion_verbs'], [])
        self.assertEqual(ref['camera_verbs'], [])
        self.assertIsNone(ref['payoff_timestamp'])
        self.assertIsNone(ref['hook_first_second']['mechanism'])
        self.assertIsNone(ref['comedy_engine'])
        self.assertEqual(ref['shot_timeline'][0]['motion_activity'], .2)

    def test_missing_engagement_is_unknown_not_zero(self):
        self.assertEqual(self.decompose()['performance'], {'views': None, 'likes': None, 'comments': None})

    def test_sampled_analysis_cannot_validate_as_measured_camera(self):
        ref = self.decompose()
        self.assertFalse(ref['analysis_evidence']['full_audiovisual_review'])
        self.assertFalse(ref['analysis_evidence']['complete_media_decode_verified'])
        self.assertIn('camera_measured', validate_reference(ref)['failed_checks'])

    def test_provenance_survives_enrichment_and_direct_compilation(self):
        ref = self.decompose()
        enriched = merge(ref, {}, {}, {})
        compiled = compile_clone(enriched, ['dave'])
        self.assertEqual(compiled['analysis_evidence'], ref['analysis_evidence'])
        self.assertFalse(compiled['production_approved'])
        self.assertFalse(compiled['publication_enabled'])
        self.assertIsNone(compiled['beats'][0]['camera'])

    def test_legacy_compilation_does_not_claim_verified_analysis(self):
        compiled = compile_clone({'shot_timeline': []}, ['dave'])
        self.assertEqual(compiled['analysis_evidence']['status'], 'unverified')
        self.assertFalse(compiled['production_approved'])


if __name__ == '__main__':
    unittest.main()
