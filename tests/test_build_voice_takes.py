import json,tempfile,unittest
from pathlib import Path
from scripts.build_voice_takes import collect_takes

class BuildVoiceTakesTests(unittest.TestCase):
    def test_collects_existing_candidate_reports(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td)
            (root/"cartesia.json").write_text(json.dumps({"status":"PASS","transcript_similarity":.9,"semantic_recall":.9,"audio_pass":True}))
            r=collect_takes([
              ("cartesia",root/"cartesia.json","cartesia.wav"),
              ("elevenlabs",root/"eleven.json","eleven.mp3")
            ])
            self.assertEqual(len(r["takes"]),1)
            self.assertEqual(r["takes"][0]["provider"],"cartesia")
            self.assertEqual(r["takes"][0]["path"],"cartesia.wav")

if __name__=="__main__":
    unittest.main()
