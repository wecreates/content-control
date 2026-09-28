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

    def test_primary_provider_is_eleven_v3_for_offline_video(self):
        plan=build_provider_plan(self.lock,{"ELEVENLABS_API_KEY":"x","ELEVENLABS_VOICE_NARRATOR":"n","ELEVENLABS_VOICE_DAVE":"d","ELEVENLABS_VOICE_POINTS_MONK":"m","ELEVENLABS_VOICE_CASHBACK_GOBLIN":"g"})
        self.assertEqual(plan["primary"]["provider"],"elevenlabs")
        self.assertEqual(plan["primary"]["model_id"],"eleven_v3")
        self.assertEqual(plan["primary"]["mode"],"offline_cinematic")

    def test_voice_ids_are_locked_per_character(self):
        env={"ELEVENLABS_API_KEY":"x","ELEVENLABS_VOICE_NARRATOR":"n","ELEVENLABS_VOICE_DAVE":"d","ELEVENLABS_VOICE_POINTS_MONK":"m","ELEVENLABS_VOICE_CASHBACK_GOBLIN":"g"}
        plan=build_provider_plan(self.lock,env)
        self.assertEqual(plan["voices"]["dave"]["voice_id"],"d")
        self.assertEqual(plan["voices"]["points_monk"]["voice_id"],"m")
        self.assertNotEqual(plan["voices"]["dave"]["voice_id"],plan["voices"]["points_monk"]["voice_id"])

    def test_missing_credentials_fail_over_without_breaking_pipeline(self):
        plan=build_provider_plan(self.lock,{})
        self.assertFalse(plan["primary"]["ready"])
        self.assertEqual(plan["selected_provider"],"fallback")
        self.assertTrue(plan["fallback"]["enabled"])

    def test_audio_tags_encode_character_acting(self):
        self.assertIn("[anxious]",add_v3_tags("dave","I get money back.",{"tone":"anxious_excited"}))
        self.assertIn("[deadpan]",add_v3_tags("points_monk","Would you buy it anyway?",{"tone":"calm_deadpan"}))
        self.assertNotIn("SFX",add_v3_tags("narrator","The math changed.",{"tone":"dry_confident"}))

if __name__=="__main__":
    unittest.main()
