import json, unittest
from pathlib import Path
from scripts.validate_creative_blueprint import validate_blueprint

class CreativeBlueprintContractTests(unittest.TestCase):
    def setUp(self):
        self.blueprint={
            "hook":{"starts_with_action":True,"seconds_to_conflict":0.6},
            "characters":[
                {"id":"dave","role":"victim","signature_pose":"recoil"},
                {"id":"points_monk","role":"truth_teller","signature_pose":"deadpan_point"}
            ],
            "beats":[
                {"start":0.0,"end":1.4,"type":"physical_gag","state_change":True,"camera":"punch_in","visual_payoff":True},
                {"start":1.4,"end":2.8,"type":"reaction","state_change":True,"camera":"snap_wide","visual_payoff":True},
                {"start":2.8,"end":4.2,"type":"metaphor","state_change":True,"camera":"whip_pan","visual_payoff":True},
                {"start":4.2,"end":5.7,"type":"math_reveal","state_change":True,"camera":"impact_close","visual_payoff":True}
            ],
            "ending":{"cut_after_payoff":True,"rule_recalled":True},
            "style":{"background":"#FFFFFF","line_art":"#111111","max_simultaneous_accents":3},
            "originality":{"exact_reference_character_copy":False,"reference_mechanics_only":True}
        }

    def test_accepts_action_first_character_driven_blueprint(self):
        result=validate_blueprint(self.blueprint)
        self.assertEqual(result["status"],"PASS")
        self.assertEqual(result["failed_checks"],[])

    def test_rejects_slide_lecture_pacing(self):
        bad=json.loads(json.dumps(self.blueprint))
        bad["beats"]=[{"start":0,"end":5.5,"type":"caption_card","state_change":False,"camera":"static","visual_payoff":False}]
        result=validate_blueprint(bad)
        self.assertIn("beat_duration",result["failed_checks"])
        self.assertIn("state_change_each_beat",result["failed_checks"])
        self.assertIn("camera_motion_each_beat",result["failed_checks"])

    def test_rejects_exact_reference_character_copy(self):
        bad=json.loads(json.dumps(self.blueprint))
        bad["originality"]["exact_reference_character_copy"]=True
        result=validate_blueprint(bad)
        self.assertIn("original_character_identity",result["failed_checks"])

if __name__=="__main__":
    unittest.main()
