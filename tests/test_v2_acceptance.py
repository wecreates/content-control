import unittest
from scripts.v2_acceptance import evaluate
from scripts.v2_orchestrator import build_plan, creative_gate, derive_metrics

class V2AcceptanceTests(unittest.TestCase):
    def test_ready_requires_every_gate_and_stream(self):
        state={"story_locked":True,"fact_locked":True,"audio_locked":True,"rendered":True,
               "technical_qa":True,"creative_qa":True,"visual_parity_qa":True,"stream_url":"https://preview.example/video.mp4",
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
               "technical_qa":True,"creative_qa":False,"visual_parity_qa":True,"stream_url":"https://preview.example/video.mp4",
               "stream_verified":True}
        self.assertEqual(evaluate(state)["status"],"BLOCKED")

    def test_visual_parity_failure_blocks_ready(self):
        state={"story_locked":True,"fact_locked":True,"audio_locked":True,"rendered":True,
               "technical_qa":True,"creative_qa":True,"visual_parity_qa":False,
               "stream_url":"https://preview.example/video.mp4","stream_verified":True}
        result=evaluate(state)
        self.assertEqual(result["status"],"BLOCKED")
        self.assertIn("visual_parity_qa",result["missing"])

    def test_plan_is_entertainment_first(self):
        job={"niche":"finance","creative_directive":{"concept":"anime boss fight","lecture_format_forbidden":True,"target_seconds":50}}
        plan=build_plan(job,{"transferable_mechanics":["cold open","escalation","payoff"],"beats":[1,2,3]})
        self.assertEqual(plan["sequence"][0],"entertainment_mechanics")
        self.assertTrue(plan["publication_enabled"] is False)
        self.assertIn("facts_change_action",plan["rules"])

    def test_lecture_like_candidate_fails_creative_gate(self):
        candidate={"duration_seconds":50,"scene_count":4,"max_static_seconds":7,"narrator_share":0.85,
                   "has_conflict":False,"has_escalation":False,"has_payoff":False,"pattern_interrupt_max_seconds":7}
        result=creative_gate(candidate)
        self.assertFalse(result["pass"])
        self.assertIn("no_conflict",result["reasons"])

    def test_entertainment_candidate_passes_gate(self):
        candidate={"duration_seconds":50,"scene_count":12,"max_static_seconds":2.4,"narrator_share":0.45,
                   "has_conflict":True,"has_escalation":True,"has_payoff":True,"pattern_interrupt_max_seconds":2.8}
        self.assertTrue(creative_gate(candidate)["pass"])

    def test_metrics_are_derived_from_ccsd_not_claimed(self):
        ccsd={"scenes":[
          {"start":0,"end":2,"story":{"intent":"conflict attack"},"characters":[{"id":"dave"}],"audio":{"dialogue":[{"speaker":"dave","text":"Attack."}]}},
          {"start":2,"end":5,"story":{"intent":"escalation counter"},"characters":[{"id":"points_monk"}],"audio":{"dialogue":[{"speaker":"points_monk","text":"Counter."}]}},
          {"start":5,"end":8,"story":{"intent":"payoff victory"},"characters":[{"id":"dave"}],"audio":{"dialogue":[{"speaker":"dave","text":"Done."}]}}
        ]}
        m=derive_metrics(ccsd)
        self.assertEqual(m["scene_count"],3)
        self.assertTrue(m["has_conflict"])
        self.assertTrue(m["has_escalation"])
        self.assertTrue(m["has_payoff"])

if __name__=="__main__":
    unittest.main()
