import unittest
from scripts.v2_acceptance import evaluate

class V2AcceptanceTests(unittest.TestCase):
    def test_ready_requires_every_gate_and_stream(self):
        state={"story_locked":True,"fact_locked":True,"audio_locked":True,"rendered":True,
               "technical_qa":True,"creative_qa":True,"stream_url":"https://preview.example/video.mp4",
               "stream_verified":True}
        self.assertEqual(evaluate(state)["status"],"READY")

    def test_render_without_verified_stream_is_not_ready(self):
        state={"story_locked":True,"fact_locked":True,"audio_locked":True,"rendered":True,
               "technical_qa":True,"creative_qa":True,"stream_url":None,"stream_verified":False}
        result=evaluate(state)
        self.assertNotEqual(result["status"],"READY")
        self.assertIn("stream_verified",result["missing"])

    def test_creative_failure_blocks_ready(self):
        state={"story_locked":True,"fact_locked":True,"audio_locked":True,"rendered":True,
               "technical_qa":True,"creative_qa":False,"stream_url":"https://preview.example/video.mp4",
               "stream_verified":True}
        self.assertEqual(evaluate(state)["status"],"BLOCKED")

if __name__=="__main__":
    unittest.main()
