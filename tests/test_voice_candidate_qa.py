import unittest
from scripts.voice_candidate_qa import expected_text, token_recall

class VoiceCandidateQATests(unittest.TestCase):
    def test_expected_text_concatenates_spoken_segments_only(self):
        m={"segments":[{"speaker":"narrator","text":"Hello."},{"speaker":"dave","text":"Wait!"}]}
        self.assertEqual(expected_text(m),"Hello. Wait!")

    def test_token_recall_is_high_for_faithful_transcript(self):
        self.assertGreater(token_recall("buy first reward second","buy first reward second"),.99)

if __name__=="__main__":
    unittest.main()
