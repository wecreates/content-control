import unittest
from pathlib import Path
class HistoricalRegression(unittest.TestCase):
 def test_voice_v3_studio_path(self):
  t=Path(".github/workflows/studio-pipeline.yml").read_text()
  for x in ["Build Cartesia Sonic 3.6 production voice","cartesia_sonic_generate.py","required_provider_missing","reference-clone-voice.mp3","inject_voiceover_path.py"]:self.assertIn(x,t)
 def test_clone_composition_voiceover_single_declaration(self):
  t=Path("remotion/ReferenceCloneComposition.jsx").read_text()
  self.assertEqual(t.count("const voiceover="),1)
  self.assertNotIn("const voiceover=scenePlan?.voiceover_path||null;\\n",t)
if __name__=="__main__":unittest.main()
