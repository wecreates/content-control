import unittest
from scripts.cartesia_sonic_generate import build_payload, map_emotion, split_segments

class CartesiaSonicTests(unittest.TestCase):
    def test_payload_uses_sonic_3_6(self):
        p=build_payload("Hello","voice-1",1.0,"curiosity:high")
        self.assertEqual(p["model_id"],"sonic-3.6")
        self.assertEqual(p["voice"],"voice-1")
        self.assertEqual(p["output_format"]["sample_rate"],44100)

    def test_emotion_mapping_preserves_character_intent(self):
        self.assertEqual(map_emotion("anxious_excited"),"surprise:high")
        self.assertEqual(map_emotion("calm_deadpan"),"curiosity:low")

    def test_splits_segments_without_mixing_speakers(self):
        segs=[{"speaker":"dave","text":"A"},{"speaker":"points_monk","text":"B"}]
        out=split_segments(segs)
        self.assertEqual([x["speaker"] for x in out],["dave","points_monk"])

if __name__=="__main__":
    unittest.main()
