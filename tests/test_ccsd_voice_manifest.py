import unittest
from scripts.ccsd_voice_manifest import build_manifest

class CCSDVoiceManifestTests(unittest.TestCase):
    def test_extracts_ordered_speaker_turns(self):
        ccsd={"publication_enabled":False,"scenes":[
          {"start":0,"audio":{"dialogue":[{"speaker":"narrator","text":"Start."},{"speaker":"dave","text":"Wait."}]}},
          {"start":2,"audio":{"dialogue":[{"speaker":"points_monk","text":"No."}]}}
        ]}
        r=build_manifest(ccsd)
        self.assertEqual([x["speaker"] for x in r["segments"]],["narrator","dave","points_monk"])
        self.assertEqual(r["status"],"PASS")

    def test_empty_dialogue_is_ready_noop_not_failure(self):
        r=build_manifest({"publication_enabled":False,"scenes":[]})
        self.assertEqual(r["status"],"EMPTY")
        self.assertEqual(r["segments"],[])

if __name__=="__main__":
    unittest.main()
