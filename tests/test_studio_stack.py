import json, tempfile, unittest
from pathlib import Path
from scripts.ccsd_validate import validate_ccsd
from scripts.story_room import build_story_room
from scripts.animatic_plan import build_animatic
from scripts.dailies_review import review_dailies
from scripts.asset_memory import build_asset_index
from scripts.audience_panel import run_panel
from scripts.render_level_gate import gate as render_gate
from scripts.shot_approval import advance as approve_shot
from scripts.analytics_feedback import map_feedback
from scripts.rd_quarantine import evaluate as evaluate_rd

class StudioStackTests(unittest.TestCase):
    def test_ccsd_requires_shared_scene_layers(self):
        doc={
          "schema_version":1,"project_id":"x","publication_enabled":False,
          "scenes":[{"id":"s1","start":0,"end":2,
            "story":{"beat":"hook","purpose":"conflict"},
            "camera":{"shot_scale":"close","move":"punch_in","screen_direction":"ltr"},
            "characters":[{"id":"dave","pose":"recoil","emotion":"shock"}],
            "environment":{"id":"white_stage"},
            "props":[{"id":"card","state":"active"}],
            "lighting":{"key":"soft","fill":"minimal","rim":"none"},
            "audio":{"dialogue":[],"sfx":[],"music":{"energy":.4}},
            "text":{"zone":"upper_third","content":"HOOK"},
            "fx":[],"continuity":{"callbacks":[]}
          }]
        }
        self.assertEqual(validate_ccsd(doc)["status"],"PASS")

    def test_story_room_generates_multiple_pitches(self):
        r=build_story_room("credit card annual fees")
        self.assertGreaterEqual(len(r["pitches"]),10)
        self.assertEqual(r["status"],"PASS")

    def test_animatic_is_derived_from_ccsd(self):
        ccsd={"schema_version":1,"project_id":"x","publication_enabled":False,"scenes":[{"id":"s1","start":0,"end":2,"story":{"beat":"hook"},"camera":{"shot_scale":"close","move":"punch_in"},"characters":[],"environment":{"id":"white_stage"},"props":[],"lighting":{},"audio":{"dialogue":[],"sfx":[],"music":{}},"text":{},"fx":[],"continuity":{}}]}
        a=build_animatic(ccsd)
        self.assertEqual(a["shots"][0]["scene_id"],"s1")
        self.assertEqual(a["status"],"PASS")

    def test_dailies_produces_department_notes(self):
        r=review_dailies({"shots":[{"scene_id":"s1","duration":2,"motion":True,"dialogue_words":4}]})
        self.assertIn("story",r["departments"])
        self.assertIn("editorial",r["departments"])
        self.assertIn("sound",r["departments"])

    def test_asset_memory_indexes_reusable_assets(self):
        r=build_asset_index([{"id":"dave","type":"character"},{"id":"wallet","type":"prop"}])
        self.assertEqual(r["counts"]["character"],1)
        self.assertEqual(r["counts"]["prop"],1)

    def test_audience_panel_has_multiple_personas(self):
        r=run_panel({"hook_strength":.8,"clarity":.9,"humor":.7,"pace":.8})
        self.assertGreaterEqual(len(r["personas"]),6)

    def test_render_level_and_shot_approval_progress(self):
        r=render_gate({"level":"blocking"},{"checks":{"layout":True,"timing":True}})
        self.assertEqual(r["level"],"preview")
        a=approve_shot({"stage":"BLOCKING"},{"notes":[]})
        self.assertEqual(a["stage"],"SPLINE")

    def test_analytics_maps_retention_to_scene(self):
        ccsd={"scenes":[{"id":"s1","start":0,"end":5,"camera":{"move":"punch_in"},"characters":[{"id":"dave"}],"story":{"beat":"hook"}}]}
        r=map_feedback(ccsd,{"retention_points":[{"time":2,"retention":.4}]})
        self.assertEqual(r["retention_dips"][0]["scene_id"],"s1")

    def test_rd_candidate_stays_quarantined_when_consistency_is_weak(self):
        r=evaluate_rd({"quality":.9,"character_consistency":.7,"latency_ms":900,"cost":0},{"quality":.82,"character_consistency":.95,"latency_ms":1000,"cost":0})
        self.assertEqual(r["status"],"QUARANTINE")
        self.assertFalse(r["production_allowed"])

if __name__=="__main__":
    unittest.main()
