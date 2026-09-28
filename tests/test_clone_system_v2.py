import json,tempfile,unittest
from pathlib import Path
from scripts.generate_concept_selection import build
from scripts.voice_lock_qa import validate
from scripts.generate_clone_scene_plan import build as build_scene
class CloneSystemV2Tests(unittest.TestCase):
    def test_concept_selection_generates_at_least_five_distinct_engines(self):
        r=build("cashback")
        self.assertEqual(r["status"],"PASS")
        self.assertGreaterEqual(len(r["concepts"]),5)
        self.assertGreaterEqual(len({x["engine"] for x in r["concepts"]}),5)
    def test_voice_lock_rejects_character_voice_leak(self):
        lock={"narrator":{"voice_profile":"deep-neutral"},"characters":{"dave":{"voice_profile":"dave"},"points_monk":{"voice_profile":"monk"},"cashback_goblin":{"voice_profile":"goblin"}}}
        m={"publication_enabled":False,"segments":[{"speaker":"dave","voice_profile":"monk","text":"hello"}]}
        self.assertIn("voice_profiles_match",validate(m,lock)["failed_checks"])
    def test_scene_plan_uses_locked_renderer(self):
        bp={"duration_seconds":2,"source_reference_id":"x","selected_characters":["dave"],"audio_punctuation":[],"beats":[{"start":0,"end":2,"content_control_character":"dave","camera":"punch_in","shot_scale":"close"}]}
        r=build_scene(bp)
        self.assertEqual(r["renderer"],"remotion/ReferenceCloneComposition.jsx")
        self.assertEqual(r["character_source"],"control/character-bible-v1.json")
if __name__=="__main__":unittest.main()
