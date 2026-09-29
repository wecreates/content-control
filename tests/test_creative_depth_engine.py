import unittest
from scripts.creative_depth_engine import apply

class CreativeDepthTests(unittest.TestCase):
    def test_integrates_performance_camera_assets_audio_and_candidates(self):
        src={"publication_enabled":False,"scenes":[{"id":"s1","start":0,"end":2,"story":{"beat":"danger trap"},"camera":{},"characters":[{"id":"dave"}],"props":[{"id":"card"}],"environment":{"id":"bank"},"audio":{"dialogue":[{"speaker":"dave","text":"Wait."}]},"fx":[]}]}
        out=apply(src); s=out["scenes"][0]; ch=s["characters"][0]
        self.assertFalse(out["publication_enabled"])
        self.assertEqual(s["story"]["intent"],"pressure")
        self.assertEqual(s["camera"]["motivation"],"compress_space")
        self.assertTrue(ch["performance_engine"]["lip_sync"]["coarticulation"])
        self.assertTrue(ch["motion_engine"]["foot_lock"])
        self.assertTrue(s["props"][0]["behavior"]["collision"])
        self.assertTrue(s["environment"]["depth_system"]["parallax"])
        self.assertTrue(s["compositing"]["contact_shadows"])
        self.assertTrue(s["audio"]["direction"]["spatial_mix"])
        self.assertEqual(len(s["creative_candidates"]),3)
        self.assertEqual(s["candidate_selection"]["winner"],"auto_at_dailies")
        self.assertIn("dave",s["continuity"]["character_state"])
if __name__=="__main__": unittest.main()
