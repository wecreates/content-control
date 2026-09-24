import pathlib, unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]

class InstagramReelBridgeContractTests(unittest.TestCase):
    def test_bridge_files_exist(self):
        self.assertTrue((ROOT/'tools/instagram_reel_bridge.mjs').is_file())
        self.assertTrue((ROOT/'tools/instagram_reel_bridge.ps1').is_file())

    def test_bridge_uses_persistent_logged_in_browser_and_actual_media(self):
        src=(ROOT/'tools/instagram_reel_bridge.mjs').read_text()
        self.assertIn('launchPersistentContext',src)
        self.assertIn('video.currentSrc',src)
        self.assertIn("resourceType() === 'media'",src)
        self.assertIn('instagram.com/reel/',src)
        self.assertIn('ffprobe',src)
        self.assertIn('actual_media_verified',src)

    def test_fails_closed_without_real_av(self):
        src=(ROOT/'tools/instagram_reel_bridge.mjs').read_text()
        self.assertIn('throw new Error',src)
        self.assertIn('No playable Reel media',src)
        self.assertIn('audio_stream_present',src)
        self.assertIn('video_stream_present',src)

if __name__=='__main__':
    unittest.main()
