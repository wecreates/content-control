import unittest
from scripts.ccsd_voice_manifest import build
class VoiceManifestTests(unittest.TestCase):
 def test_maps_speaker_to_locked_provider(self):
  c={"scenes":[{"start":0,"end":2,"audio":{"dialogue":[{"speaker":"dave","text":"No way."}]}}]}
  l={"narrator":{"voice_profile":"n","provider":"cartesia","model_id":"sonic-3.6","voice_id_env":"N"},"characters":{"dave":{"voice_profile":"d","provider":"cartesia","model_id":"sonic-3.6","voice_id_env":"D"}}}
  r=build(c,l)
  self.assertEqual(r["segments"][0]["provider"],"cartesia")
  self.assertEqual(r["segments"][0]["model_id"],"sonic-3.6")
if __name__=="__main__":unittest.main()
