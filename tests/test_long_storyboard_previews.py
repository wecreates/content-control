"""Exercise the preview orchestration without spending renderer time."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('long_previews', Path(__file__).parents[1] / 'scripts/render_long_storyboard_previews.py')
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

class PreviewOrchestrationTests(unittest.TestCase):
    def test_stream_metadata_does_not_shadow_encoded_media_analyzer(self):
        metrics = {'complete_video_decode': True, 'complete_av_decode': True, 'audio_audible': True,
                   'black_samples': 0, 'max_duplicate_run_seconds': .125, 'max_border': .01}
        called = []
        fake_qa = types.SimpleNamespace(probe=lambda path: (called.append(path) or metrics),
                                       audio_covers_video=lambda _metrics, _duration: True)
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root/'retained').mkdir()
            (root/'retained/ccsd.json').write_text('{}')
            (root/'retained/captions.json').write_text('{}')
            for name in ('ffmpeg', 'ffprobe'):
                p=root/'node_modules/@remotion/compositor-linux-x64-gnu'/name
                p.parent.mkdir(parents=True, exist_ok=True);p.write_text('test');p.chmod(0o700)
            metadata={'streams':[{'codec_type':'video','nb_frames':'24','width':1280,'height':720,
                                  'r_frame_rate':'24/1','duration':'1'}, {'codec_type':'audio','duration':'1'}]}
            import os
            previous=os.getcwd()
            try:
                os.chdir(root)
                with patch.object(MODULE,'SOURCE_SHA','fixture'), patch.object(MODULE,'CAPTION_SHA','fixture'), \
                     patch.object(MODULE,'sha',return_value='fixture'), patch.object(MODULE,'SEGMENTS',[('test',0,23)]), \
                     patch.object(MODULE.subprocess,'run'), patch.object(MODULE.subprocess,'check_output',return_value=json.dumps(metadata).encode()), \
                     patch.dict(sys.modules,{'production_reality_media_qa':fake_qa}):
                    MODULE.main()
                receipt=json.loads((root/'storyboard-preview/preview-receipt.json').read_text())
                self.assertEqual(len(called),1)
                self.assertTrue(all(receipt['segments'][0]['checks'].values()))
                self.assertEqual(receipt['status'],'PREVIEWS_PENDING_CREATIVE_REVIEW')
                self.assertFalse(receipt['production_approved'])
            finally:
                os.chdir(previous)

if __name__ == '__main__':
    unittest.main()
