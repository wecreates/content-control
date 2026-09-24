import unittest
from scripts.video_playback_resolver import classify_url, route_for

class VideoPlaybackResolverTests(unittest.TestCase):
    def test_youtube_uses_native_public_video_input(self):
        c=classify_url("https://www.youtube.com/watch?v=x7X9w_GIm1s")
        self.assertEqual(c["platform"],"youtube")
        self.assertEqual(route_for(c)["primary"],"gemini_public_video_url")

    def test_instagram_requires_browser_or_social_resolver(self):
        c=classify_url("https://www.instagram.com/reel/DTVaGsojYnI/")
        r=route_for(c)
        self.assertEqual(c["platform"],"instagram")
        self.assertEqual(r["primary"],"authenticated_browser")
        self.assertIn("social_media_resolver",r["fallbacks"])

    def test_direct_mp4_is_direct_media(self):
        c=classify_url("https://cdn.example.com/video.mp4")
        self.assertEqual(c["platform"],"direct_media")
        self.assertEqual(route_for(c)["primary"],"direct_media_av")

    def test_unknown_web_page_never_counts_as_watched(self):
        c=classify_url("https://example.com/page")
        r=route_for(c)
        self.assertFalse(r["metadata_only_counts_as_watched"])
        self.assertTrue(r["fail_closed"])

if __name__=="__main__":
    unittest.main()
