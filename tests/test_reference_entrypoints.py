import unittest
import subprocess
import sys
from scripts.ccsd_to_scene_plan import build

class ReferenceEntrypointTests(unittest.TestCase):
    def test_intake_cli_loads_before_requiring_media(self):
        result=subprocess.run([sys.executable,'scripts/ingest_reference_video.py','--help'],capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertIn('--video',result.stdout)

    def test_studio_scene_conversion_preserves_creative_and_audio_fields(self):
        scene={'id':'scene-000','longform':{'chapter':1},'creative_candidates':[{'id':'a'}],
               'candidate_selection':{'id':'a'},'continuity':{'character':'dave'},
               'audio':{'direction':{'delivery':'urgent'},'foley':['step']}}
        original={'scenes':[{'index':0,'preserved':'yes'}],'publication_enabled':True}
        out=build({'scenes':[scene]},original)
        self.assertEqual(out['scenes'][0]['creative_candidates'],scene['creative_candidates'])
        self.assertEqual(out['scenes'][0]['audio_direction'],scene['audio']['direction'])
        self.assertEqual(out['scenes'][0]['longform'],scene['longform'])
        self.assertEqual(out['scenes'][0]['preserved'],'yes')
        self.assertIs(out['publication_enabled'],False)
        self.assertIs(original['publication_enabled'],True)

if __name__=='__main__':unittest.main()
