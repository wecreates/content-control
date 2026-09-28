import json, tempfile, unittest
from pathlib import Path
from scripts.reference_clone_compiler import compile_clone

class ReferenceCloneCompilerTests(unittest.TestCase):
    def setUp(self):
        self.ref={
            "schema_version":1,
            "source":{"id":"sample","type":"chat_upload","duration_seconds":6.0},
            "hook_first_second":{"mechanism":"physical_conflict"},
            "shot_timeline":[
                {"start":0.0,"end":1.5,"shot_scale":"close","camera":"punch_in","character_action":"recoil","prop_action":"coin burst","state_change":True,"why_it_retains":"instant consequence"},
                {"start":1.5,"end":3.0,"shot_scale":"wide","camera":"whip_pan","character_action":"run","prop_action":"price tag chase","state_change":True,"why_it_retains":"escalation"},
                {"start":3.0,"end":4.5,"shot_scale":"medium","camera":"impact_close","character_action":"deadpan point","prop_action":"calculator slam","state_change":True,"why_it_retains":"reversal"},
                {"start":4.5,"end":6.0,"shot_scale":"close","camera":"snap_wide","character_action":"freeze","prop_action":"coin drop","state_change":True,"why_it_retains":"payoff"}
            ],
            "motion_verbs":["recoil","run","slam","freeze"],
            "camera_verbs":["punch_in","whip_pan","impact_close","snap_wide"],
            "comedy_engine":"escalation then reversal",
            "payoff_timestamp":4.5,
            "audio_punctuation":[{"time":0.3,"type":"impact"},{"time":3.2,"type":"clack"}],
            "transferable_mechanics":["fast escalation","physical metaphor"],
            "distinctive_creator_elements_not_to_copy":["exact character face","signature joke wording"]
        }

    def test_preserves_timing_and_motion_grammar(self):
        out=compile_clone(self.ref,["dave","points_monk"])
        self.assertEqual(out["duration_seconds"],6.0)
        self.assertEqual([(b["start"],b["end"]) for b in out["beats"]],[(0.0,1.5),(1.5,3.0),(3.0,4.5),(4.5,6.0)])
        self.assertEqual(out["beats"][1]["camera"],"whip_pan")
        self.assertEqual(out["beats"][2]["shot_scale"],"medium")

    def test_uses_locked_content_control_characters(self):
        out=compile_clone(self.ref,["dave","points_monk"])
        self.assertEqual(out["character_source"],"control/character-bible-v1.json")
        self.assertEqual(out["renderer"],"remotion/CharacterSystem.jsx")
        self.assertEqual(out["selected_characters"],["dave","points_monk"])

    def test_never_copies_creator_identity_or_dialogue(self):
        out=compile_clone(self.ref,["dave"])
        self.assertTrue(out["originality"]["reference_mechanics_only"])
        self.assertFalse(out["originality"]["exact_reference_character_copy"])
        self.assertNotIn("dialogue",json.dumps(out).lower())

if __name__=="__main__":
    unittest.main()
