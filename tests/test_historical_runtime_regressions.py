import unittest
from pathlib import Path
class HistoricalRegression(unittest.TestCase):
 def test_free_studio_voice_preserves_render_handoff(self):
  t=Path(".github/workflows/studio-pipeline.yml").read_text()
  for x in ["Build free local production voice","v2_free_voice.py","v2_audio_assemble.py","voice_candidate_qa.py","reference-clone-voice.mp3","inject_voiceover_path.py"]:self.assertIn(x,t)
  self.assertNotIn("cartesia_sonic_generate.py",t)
  self.assertNotIn("secrets.CARTESIA",t)
 def test_clone_composition_voiceover_single_declaration(self):
  t=Path("remotion/ReferenceCloneComposition.jsx").read_text()
  self.assertEqual(t.count("const voiceover="),1)
  self.assertNotIn("const voiceover=scenePlan?.voiceover_path||null;\\n",t)
if __name__=="__main__":unittest.main()
