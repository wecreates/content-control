import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
STUDIO = ROOT / "agentic-studio"
if str(STUDIO) not in sys.path:
    sys.path.insert(0, str(STUDIO))

import audio_engine
import video_renderer

class ViralForgeMediaRuntimeTests(unittest.TestCase):
    def test_media_modules_are_callable(self):
        self.assertTrue(callable(audio_engine.synthesize_sections))
        self.assertTrue(callable(video_renderer.render))

    def test_voice_rejects_empty_narration_before_network(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError):
                audio_engine.synthesize_sections([{"narration": ""}], tmp)

    def test_renderer_rejects_audio_count_mismatch(self):
        script = {"video_type": "shorts", "sections": [{"narration": "hello"}]}
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError):
                video_renderer.render(script, [], tmp)

if __name__ == "__main__":
    unittest.main()
