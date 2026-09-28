import unittest
from scripts.eleven_v3_generate import chunk_turns, build_dialogue_payload

class ElevenV3PayloadTests(unittest.TestCase):
    def test_chunks_dialogue_under_reliable_character_limit(self):
        turns=[{"speaker":"dave","voice_id":"d","text":"x"*1200},{"speaker":"points_monk","voice_id":"m","text":"y"*1200}]
        chunks=chunk_turns(turns,1900)
        self.assertEqual(len(chunks),2)
        self.assertTrue(all(sum(len(x["text"]) for x in chunk)<=1900 for chunk in chunks))

    def test_payload_uses_v3_and_locked_seed(self):
        turns=[{"speaker":"dave","voice_id":"d","text":"[anxious] hello"}]
        p=build_dialogue_payload(turns,12345)
        self.assertEqual(p["model_id"],"eleven_v3")
        self.assertEqual(p["seed"],12345)
        self.assertEqual(p["inputs"][0]["voice_id"],"d")

    def test_payload_never_places_speaker_name_in_spoken_text(self):
        turns=[{"speaker":"points_monk","voice_id":"m","text":"[deadpan] No."}]
        p=build_dialogue_payload(turns,1)
        self.assertNotIn("points_monk",p["inputs"][0]["text"])

if __name__=="__main__":
    unittest.main()
