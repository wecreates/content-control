import json,unittest
from scripts.voice_provider import build_provider_plan, add_v3_tags

class VoiceProviderTests(unittest.TestCase):
    def setUp(self):
        self.lock={
          "narrator":{"voice_profile":"deep-neutral"},
          "characters":{
            "dave":{"voice_profile":"medium-fast-anxious"},
            "points_monk":{"voice_profile":"low-calm-deadpan"},
            "cashback_goblin":{"voice_profile":"chirps_or_nonverbal"}
          }
        }

    def test_primary_quality_provider_is_cartesia_sonic_3_6(self):
        plan=build_provider_plan(self.lock,{"CARTESIA_API_KEY":"x","CARTESIA_VOICE_NARRATOR":"n","CARTESIA_VOICE_DAVE":"d","CARTESIA_VOICE_POINTS_MONK":"m","CARTESIA_VOICE_CASHBACK_GOBLIN":"g"})
        self.assertEqual(plan["primary"]["provider"],"cartesia")
        self.assertEqual(plan["primary"]["model_id"],"sonic-3.6")
        self.assertEqual(plan["primary"]["mode"],"offline_quality")

    def test_voice_ids_are_locked_per_character(self):
        env={"CARTESIA_API_KEY":"x","CARTESIA_VOICE_NARRATOR":"n","CARTESIA_VOICE_DAVE":"d","CARTESIA_VOICE_POINTS_MONK":"m","CARTESIA_VOICE_CASHBACK_GOBLIN":"g"}
        plan=build_provider_plan(self.lock,env)
        self.assertEqual(plan["voices"]["dave"]["cartesia_voice_id"],"d")
        self.assertEqual(plan["voices"]["points_monk"]["cartesia_voice_id"],"m")
        self.assertNotEqual(plan["voices"]["dave"]["cartesia_voice_id"],plan["voices"]["points_monk"]["cartesia_voice_id"])

    def test_missing_cartesia_blocks_dialogue_production(self):
        plan=build_provider_plan(self.lock,{})
        self.assertFalse(plan["primary"]["ready"])
        self.assertEqual(plan["selected_strategy"],"required_provider_missing")
        self.assertFalse(plan["fallback"]["enabled"])
        self.assertIsNone(plan["fallback"]["provider"])

    def test_cartesia_api_key_is_enough_when_locked_default_voice_ids_exist(self):
        plan=build_provider_plan(self.lock,{"CARTESIA_API_KEY":"x"})
        self.assertTrue(plan["primary"]["ready"])
        self.assertEqual(plan["selected_strategy"],"cartesia")

    def test_audio_tags_encode_character_acting(self):
        self.assertIn("[anxious]",add_v3_tags("dave","I get money back.",{"tone":"anxious_excited"}))
        self.assertIn("[deadpan]",add_v3_tags("points_monk","Would you buy it anyway?",{"tone":"calm_deadpan"}))
        self.assertNotIn("SFX",add_v3_tags("narrator","The math changed.",{"tone":"dry_confident"}))

if __name__=="__main__":
    unittest.main()
