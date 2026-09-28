import unittest
from scripts.story_room_v2 import build_room
from scripts.story_room_critic import critique
from scripts.apply_story_strategy import apply as apply_story
from scripts.rig_motion_pass import apply as rig
from scripts.acting_director import apply as acting
from scripts.typography_pass import apply as typography
from scripts.composition_director import apply as composition
from scripts.visual_choreography import apply as choreography
from scripts.contact_physics_pass import apply as contacts
from scripts.soundscape_director import apply as sound
from scripts.adaptive_score_v2 import apply as score
from scripts.production_scheduler import schedule
from scripts.analytics_learning_v2 import learn

class QualityDepthIntegrationTests(unittest.TestCase):
    def test_core_depth_pipeline_preserves_one_shared_scene(self):
        ccsd={
          "schema_version":1,"project_id":"fixture","publication_enabled":False,
          "scenes":[{
            "id":"scene-000","start":0.0,"end":2.0,
            "story":{"beat":"annual fee reveal","purpose":"consequence"},
            "camera":{"shot_scale":"medium","move":"punch_in","screen_direction":"ltr"},
            "characters":[{"id":"dave","pose":"recoil","emotion":"shock"}],
            "environment":{"id":"bank_counter"},
            "props":[{"id":"card","state":"active"},{"id":"fee_meter","state":"active"}],
            "lighting":{"key":"soft","fill":"minimal","rim":"none"},
            "audio":{"dialogue":[{"speaker":"dave","text":"That fee is huge."}],"sfx":[],"music":{}},
            "text":{"zone":"upper_third","content":"$695 ANNUAL FEE"},
            "fx":[],"continuity":{"callbacks":[]},
            "reference_mechanics":{"character_action":"recoil","prop_action":"fee meter slam","motion_intensity":.08,"flow_direction":"right","flow_speed":.4,"structure":{"contact_count":1,"text_region_count":1.4}}
          }]
        }
        room=build_room("annual fee",12)
        crit=critique(room)
        x=apply_story(ccsd,room,crit)
        x=rig(x);x=acting(x);x=typography(x);x=composition(x);x=choreography(x);x=contacts(x);x=sound(x);x=score(x)
        scene=x["scenes"][0]
        self.assertEqual(scene["id"],"scene-000")
        self.assertTrue(scene["characters"][0]["rig"])
        self.assertIn("acting",scene["characters"][0])
        self.assertIn("design",scene["text"])
        self.assertIn("choreography",scene)
        self.assertTrue(scene["choreography"]["contact_events"][0]["constraint"])
        self.assertIn("environment_bed",scene["audio"])
        self.assertIn("tempo_bpm",scene["audio"]["music"])
        sched=schedule(x)
        self.assertEqual(sched["blocked_scene_ids"],[])
        learned=learn(x,{"retention_points":[{"time":1.0,"retention":.81}]})
        self.assertEqual(learned["rules"][0]["direction"],"reinforce_similar")

if __name__=="__main__":
    unittest.main()
