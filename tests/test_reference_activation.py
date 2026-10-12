import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from scripts.activate_reference_clone import activate, REQUIRED
from scripts.reference_clone_compiler import compile_clone
from scripts.generate_clone_scene_plan import build


class ReferenceActivationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.src = Path(self.temp.name) / 'source'
        self.dst = Path(self.temp.name) / 'active'
        self.src.mkdir()
        self.dst.mkdir()
        (self.dst / 'activation.json').write_text('existing')
        self.ref = {'source': {'id': 'fixture', 'type': 'synthetic_test', 'duration_seconds': 2},
                    'hook_first_second': {}, 'shot_timeline': [
                        {'start': 0, 'end': 1, 'camera': 'static', 'shot_scale': 'wide', 'state_change': True},
                        {'start': 1, 'end': 2, 'camera': 'static', 'shot_scale': 'wide', 'state_change': True}],
                    'motion_verbs': [], 'camera_verbs': [], 'comedy_engine': None,
                    'payoff_timestamp': None, 'audio_punctuation': [], 'transferable_mechanics': [],
                    'distinctive_creator_elements_not_to_copy': [], 'publication_enabled': False}
        self.blueprint = compile_clone(self.ref, ['dave'])
        self.write('reference.json', self.ref)
        self.write('clone-blueprint.json', self.blueprint)
        self.write('scene-plan.json', build(self.blueprint))

    def write(self, name, obj):
        (self.src / name).write_text(json.dumps(obj))

    def receipt(self, status='COMPLETED'):
        self.write('intake-status.json', {'status': status, 'publication_enabled': False,
                   'artifacts_sha256': {name: hashlib.sha256((self.src / name).read_bytes()).hexdigest() for name in REQUIRED}})

    def assert_rejected(self):
        with self.assertRaises(ValueError):
            activate(self.src, self.dst)
        self.assertEqual((self.dst / 'activation.json').read_text(), 'existing')
        self.assertFalse((self.dst / 'reference.json').exists())

    def test_valid_draft_activation_is_not_production_approval(self):
        self.receipt()
        result = activate(self.src, self.dst)
        self.assertFalse(result['production_approved'])
        self.assertFalse(result['publication_enabled'])

    def test_unknown_camera_rejected_before_existing_data_changes(self):
        self.ref['shot_timeline'][0]['camera'] = None
        self.write('reference.json', self.ref)
        self.assert_rejected()

    def test_publication_enabled_input_rejected(self):
        self.blueprint['publication_enabled'] = True
        self.write('clone-blueprint.json', self.blueprint)
        self.assert_rejected()

    def test_failed_retry_cannot_activate_old_artifacts(self):
        self.receipt('BLOCKED')
        self.assert_rejected()

    def test_modified_artifact_cannot_reuse_success_receipt(self):
        self.receipt()
        self.ref['source']['type'] = 'changed'
        self.write('reference.json', self.ref)
        self.assert_rejected()

    def test_mixed_reference_artifacts_rejected(self):
        self.blueprint['source_reference_id'] = 'different'
        self.write('clone-blueprint.json', self.blueprint)
        self.assert_rejected()


if __name__ == '__main__':
    unittest.main()
