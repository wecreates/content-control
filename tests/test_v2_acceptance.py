import unittest
from scripts.v2_acceptance import evaluate
from scripts.v2_orchestrator import (
    build_plan, creative_gate, parse_news_rss, parse_youtube_search,
    select_format_dna, build_boss_fight_ccsd, measure_creative,
    repair_ccsd, fact_pack
)

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

    def test_plan_is_entertainment_first(self):
        job={"niche":"finance","creative_directive":{"concept":"anime boss fight","lecture_format_forbidden":True,"target_seconds":50}}
        plan=build_plan(job,{"transferable_mechanics":["cold open","escalation","payoff"],"beats":[1,2,3]})
        self.assertEqual(plan["sequence"][0],"entertainment_mechanics")
        self.assertFalse(plan["publication_enabled"])
        self.assertIn("facts_change_action",plan["rules"])

    def test_live_discovery_parsers(self):
        rss="<rss><channel><item><title>Points transfer showdown</title><link>https://news.example/a</link></item></channel></rss>"
        self.assertEqual(parse_news_rss(rss)[0]["title"],"Points transfer showdown")
        html='{"videoRenderer":{"videoId":"abc123","title":{"runs":[{"text":"Anime Boss Fight Short"}]},"viewCountText":{"simpleText":"2M views"}}}'
        rows=parse_youtube_search(html)
        self.assertEqual(rows[0]["video_id"],"abc123")
        self.assertIn("Boss Fight",rows[0]["title"])

    def test_cross_niche_format_dna(self):
        dna=select_format_dna([
          {"video_id":"x","title":"Anime Boss Fight - Final Card Standing","views_text":"3M views"},
          {"video_id":"y","title":"Heist gone wrong","views_text":"1M views"}
        ])
        self.assertEqual(dna["engine"],"boss_fight")
        self.assertEqual(dna["reference_video_id"],"x")
        self.assertIn("counter_attack",dna["mechanics"])

    def test_boss_fight_story_is_original_dense_and_multi_voice(self):
        ccsd=build_boss_fight_ccsd(
          {"title":"Travel rewards showdown"},
          {"engine":"boss_fight","mechanics":["cold_open","counter_attack","power_up","payoff"]},
          fact_pack()
        )
        self.assertGreaterEqual(len(ccsd["scenes"]),14)
        self.assertFalse(ccsd["publication_enabled"])
        roles={s["story"]["role"] for s in ccsd["scenes"]}
        self.assertTrue({"conflict","escalation","payoff"}.issubset(roles))
        speakers={d["speaker"] for s in ccsd["scenes"] for d in s["audio"]["dialogue"]}
        self.assertGreaterEqual(len(speakers),4)
        self.assertIn("amex",speakers)
        self.assertIn("chase",speakers)
        self.assertTrue(all((s["end"]-s["start"])<=3.5 for s in ccsd["scenes"]))

    def test_measured_creative_gate_rejects_lecture_and_accepts_boss_fight(self):
        candidate={"duration_seconds":50,"scene_count":4,"max_static_seconds":7,"narrator_share":0.85,
                   "has_conflict":False,"has_escalation":False,"has_payoff":False,"pattern_interrupt_max_seconds":7}
        self.assertFalse(creative_gate(candidate)["pass"])
        ccsd=build_boss_fight_ccsd({"title":"x"},{"engine":"boss_fight","mechanics":[]},fact_pack())
        metrics=measure_creative(ccsd)
        self.assertTrue(creative_gate(metrics)["pass"],metrics)

    def test_auto_repair_fixes_slow_or_narrator_heavy_candidate(self):
        ccsd=build_boss_fight_ccsd({"title":"x"},{"engine":"boss_fight","mechanics":[]},fact_pack())
        broken={"schema_version":1,"publication_enabled":False,"scenes":ccsd["scenes"][:4]}
        for scene in broken["scenes"]:
            scene["end"]=scene["start"]+7
            for d in scene["audio"]["dialogue"]: d["speaker"]="narrator"
        repaired=repair_ccsd(broken,creative_gate(measure_creative(broken)))
        self.assertTrue(creative_gate(measure_creative(repaired))["pass"])

    def test_fact_pack_uses_official_sources(self):
        facts=fact_pack()
        self.assertGreaterEqual(len(facts),2)
        self.assertTrue(all("source" in x and x["source"].startswith("https://") for x in facts))
        self.assertTrue(any(x["brand"]=="AMEX" for x in facts))
        self.assertTrue(any(x["brand"]=="CHASE" for x in facts))

if __name__=="__main__":
    unittest.main()
