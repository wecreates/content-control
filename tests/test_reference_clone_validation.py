import unittest
from scripts.validate_reference_clone import validate_reference,validate_clone

class ReferenceCloneValidationTests(unittest.TestCase):
    def test_valid_reference_passes(self):
        ref={"source":{"id":"x","type":"chat_upload","duration_seconds":4},"hook_first_second":{},"shot_timeline":[{"start":0,"end":2,"shot_scale":"close","camera":"punch_in","state_change":True},{"start":2,"end":4,"shot_scale":"wide","camera":"whip_pan","state_change":True}],"motion_verbs":[],"camera_verbs":[],"comedy_engine":"reversal","payoff_timestamp":3.5,"audio_punctuation":[],"transferable_mechanics":[],"distinctive_creator_elements_not_to_copy":[]}
        self.assertEqual(validate_reference(ref)["status"],"PASS")
    def test_clone_requires_locked_character_renderer(self):
        clone={"beats":[{"start":0,"end":1},{"start":1,"end":2}],"character_source":"wrong","renderer":"wrong","style_source":"control/style-dna-v3.json","selected_characters":["dave"],"originality":{"exact_reference_character_copy":False,"reference_mechanics_only":True},"publication_enabled":False}
        self.assertIn("character_lock",validate_clone(clone)["failed_checks"])
if __name__=="__main__":
    unittest.main()
