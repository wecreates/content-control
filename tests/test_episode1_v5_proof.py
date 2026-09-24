import pathlib, unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]

class V5ProofTests(unittest.TestCase):
    def test_v5_proof_has_shot_language_and_separate_audio(self):
        src=(ROOT/"remotion/Episode1V5Proof.jsx").read_text()
        for name in ["ShotPaid","ShotBetrayal","ShotReaction","ShotQuestion","ShotMath","ShotImpulse","ShotPunchline"]:
            self.assertIn(name,src)
        self.assertIn('v5-proof-voice.mp3',src)
        self.assertIn('v5-beat.wav',src)
        self.assertIn('v5-slam.wav',src)
        self.assertNotIn('[SFX',src)
        self.assertNotIn('SFX:',src)
        self.assertNotIn('sound effect',src.lower())

if __name__=="__main__":
    unittest.main()
