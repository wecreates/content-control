import pathlib,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]

class VoiceRenderWiringTests(unittest.TestCase):
    def test_short_renderer_accepts_optional_voiceover(self):
        src=(ROOT/"remotion/ReferenceCloneComposition.jsx").read_text()
        self.assertIn("voiceover_path",src)
        self.assertIn("staticFile",src)

    def test_long_renderer_accepts_optional_voiceover(self):
        src=(ROOT/"remotion/ReferenceCloneLongComposition.jsx").read_text()
        self.assertIn("voiceover_path",src)
        self.assertIn("staticFile",src)

if __name__=="__main__":
    unittest.main()
