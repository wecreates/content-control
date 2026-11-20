import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('episode_sync', ROOT/'scripts/verify_episode1_sync.py')
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


class SyncTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for relative in ['state/episode1-sync-contract.json','state/episode1-factual-contract.json',
                         'remotion/V9ArticulatedVisual.jsx','remotion/episode1-picture-timeline.mjs',
                         'public/audio/episode1-narration.mp3']:
            target = self.root/relative
            target.parent.mkdir(parents=True,exist_ok=True)
            shutil.copyfile(ROOT/relative,target)

    def edit_json(self, relative, mutate):
        path=self.root/relative
        data=json.loads(path.read_text())
        mutate(data)
        path.write_text(json.dumps(data))

    def test_imported_timeline_aligns_but_real_retention_failure_remains(self):
        report=sync.verify(self.root)
        self.assertEqual(report['source_sync_status'],'PASS')
        self.assertEqual(report['status'],'FAIL')
        self.assertEqual(report['retention_status'],'FAIL')
        self.assertEqual(report['failed_checks'],['max_scene_duration_ok'])
        self.assertEqual(report['retention_budget_seconds'],2.5)
        self.assertEqual([x['beat'] for x in report['retention_violations']],
                         ['credit-purchase','compare-value','value-wins','fee-wins','closing-rule'])
        self.assertEqual(report['cut_frames'][-2:],[581,720])
        self.assertEqual(report['max_scene_duration_seconds'],5.791667)
        self.assertFalse(report['publication_enabled'])

    def test_bare_arithmetic_matches_actual_speech_but_wrong_arithmetic_fails(self):
        self.assertTrue(sync.verify(self.root)['checks']['narration_semantics_present_and_ordered'])
        self.edit_json('state/episode1-factual-contract.json',
            lambda d: d.update(narration_text=d['narration_text'].replace('80 minus 20 is 60','80 minus 20 is 70')))
        self.assertFalse(sync.verify(self.root)['checks']['narration_semantics_present_and_ordered'])

    def test_replaced_audio_cannot_reuse_timing(self):
        with (self.root/'public/audio/episode1-narration.mp3').open('ab') as file:
            file.write(b'changed')
        self.assertFalse(sync.verify(self.root)['checks']['narration_hash_matches'])

    def test_changed_cue_detected_independently_of_cut_contract(self):
        self.edit_json('state/episode1-factual-contract.json',
            lambda d: d['caption_cues'][3].update(start=10))
        report=sync.verify(self.root)
        self.assertTrue(report['checks']['cuts_match_contract'])
        self.assertFalse(report['checks']['caption_cue_scene_anchors_match'])

    def test_reordered_scenes_fail_even_with_same_cut_times(self):
        path=self.root/'remotion/episode1-picture-timeline.mjs'
        path.write_text(path.read_text().replace("start: 9.6, scene: 6", "start: 9.6, scene: 5"))
        report=sync.verify(self.root)
        self.assertTrue(report['checks']['cuts_match_contract'])
        self.assertFalse(report['checks']['playback_scene_order_matches'])
        self.assertFalse(report['checks']['caption_cue_scene_anchors_match'])

    def test_missing_import_cannot_claim_renderer_uses_timing(self):
        path=self.root/'remotion/V9ArticulatedVisual.jsx'
        path.write_text(path.read_text().replace('./episode1-picture-timeline.mjs','./other.mjs'))
        self.assertFalse(sync.verify(self.root)['checks']['renderer_uses_imported_timeline'])


if __name__=='__main__': unittest.main()
