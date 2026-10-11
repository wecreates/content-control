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

    def test_primary_is_local_kokoro_despite_paid_credentials(self):
        plan=build_provider_plan(self.lock,{"CARTESIA_API_KEY":"x","CARTESIA_VOICE_NARRATOR":"n","CARTESIA_VOICE_DAVE":"d","CARTESIA_VOICE_POINTS_MONK":"m","CARTESIA_VOICE_CASHBACK_GOBLIN":"g"})
        self.assertEqual(plan["primary"]["provider"],"kokoro")
        self.assertEqual(plan["primary"]["model_id"],"Kokoro-82M")
        self.assertEqual(plan["primary"]["mode"],"local_cpu")

    def test_voice_ids_are_locked_per_character(self):
        env={"CARTESIA_API_KEY":"x","CARTESIA_VOICE_NARRATOR":"n","CARTESIA_VOICE_DAVE":"d","CARTESIA_VOICE_POINTS_MONK":"m","CARTESIA_VOICE_CASHBACK_GOBLIN":"g"}
        plan=build_provider_plan(self.lock,env)
        self.assertEqual(plan["voices"]["dave"]["voice_id"],"am_fenrir")
        self.assertEqual(plan["voices"]["points_monk"]["voice_id"],"am_michael")
        self.assertNotEqual(plan["voices"]["dave"]["voice_id"],plan["voices"]["points_monk"]["voice_id"])

    def test_local_runtime_is_not_assumed_ready(self):
        plan=build_provider_plan(self.lock,{})
        self.assertFalse(plan["primary"]["ready"])
        self.assertEqual(plan["selected_strategy"],"kokoro_local_cpu")
        self.assertFalse(plan["fallback"]["enabled"])
        self.assertIsNone(plan["fallback"]["provider"])

    def test_paid_credentials_do_not_grant_readiness_or_spending(self):
        plan=build_provider_plan(self.lock,{"CARTESIA_API_KEY":"x"})
        self.assertFalse(plan["primary"]["ready"])
        self.assertFalse(plan["paid_providers_enabled"])
        self.assertEqual(plan["selected_strategy"],"kokoro_local_cpu")

    def test_audio_tags_encode_character_acting(self):
        self.assertIn("[anxious]",add_v3_tags("dave","I get money back.",{"tone":"anxious_excited"}))
        self.assertIn("[deadpan]",add_v3_tags("points_monk","Would you buy it anyway?",{"tone":"calm_deadpan"}))
        self.assertNotIn("SFX",add_v3_tags("narrator","The math changed.",{"tone":"dry_confident"}))

if __name__=="__main__":
    unittest.main()
