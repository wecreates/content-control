import unittest
from scripts.voice_take_selector import score_take, choose_take

class VoiceTakeSelectorTests(unittest.TestCase):
    def test_prefers_faithful_clean_take(self):
        a={"path":"a.mp3","transcript_similarity":.96,"semantic_recall":.94,"duration_error_ratio":.03,"audio_pass":True}
        b={"path":"b.mp3","transcript_similarity":.80,"semantic_recall":.85,"duration_error_ratio":.01,"audio_pass":True}
        self.assertEqual(choose_take([a,b])["path"],"a.mp3")

    def test_rejects_audio_failure_even_with_high_similarity(self):
        good={"path":"good.mp3","transcript_similarity":.90,"semantic_recall":.90,"duration_error_ratio":.05,"audio_pass":True}
        bad={"path":"bad.mp3","transcript_similarity":.99,"semantic_recall":.99,"duration_error_ratio":.0,"audio_pass":False}
        self.assertGreater(score_take(good),score_take(bad))

if __name__=="__main__":
    unittest.main()
