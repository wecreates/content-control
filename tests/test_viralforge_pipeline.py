import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
STUDIO = ROOT / "agentic-studio"
if str(STUDIO) not in sys.path:
    sys.path.insert(0, str(STUDIO))

import config
import pipeline_cloud


class ViralForgePipelineTests(unittest.TestCase):
    def test_configuration_requires_gemini_but_not_pexels(self):
        old_gemini, old_pexels = config.GEMINI_API_KEY, config.PEXELS_API_KEY
        old_pub = config.PUBLICATION_ENABLED
        try:
            config.GEMINI_API_KEY = "test-key"
            config.PEXELS_API_KEY = ""
            config.PUBLICATION_ENABLED = False
            self.assertEqual(pipeline_cloud.require_configuration(), [])
        finally:
            config.GEMINI_API_KEY = old_gemini
            config.PEXELS_API_KEY = old_pexels
            config.PUBLICATION_ENABLED = old_pub

    def test_pipeline_writes_handoff_and_qa(self):
        research = {
            "topic": "Credit card annual fees",
            "video_title": "When a Fee Is Actually Worth It",
            "hook_question": "Would you pay $695 to save more?",
            "key_points": ["one", "two", "three", "four", "five"],
            "tags": ["cards", "fees"],
        }
        script = {
            "title": "When a Fee Is Actually Worth It",
            "video_type": "shorts",
            "sections": [
                {"id": i, "narration": f"Line {i}", "on_screen_text": f"Beat {i}"}
                for i in range(1, 7)
            ],
        }
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp)
            video = out / "viralforge.mp4"
            video.write_bytes(b"0" * 2048)
            audio_paths = [str(out / f"{i}.mp3") for i in range(6)]
            for p in audio_paths:
                Path(p).write_bytes(b"audio")

            with patch.object(config, "GEMINI_API_KEY", "test-key"),                  patch.object(config, "PUBLICATION_ENABLED", False),                  patch.object(config, "VIDEO_PRIVACY", "private"),                  patch.object(pipeline_cloud, "research_topic", return_value=research),                  patch.object(pipeline_cloud, "write_script", return_value=script),                  patch.object(pipeline_cloud, "synthesize_sections", return_value=audio_paths),                  patch.object(pipeline_cloud, "render", return_value=str(video)):
                result = pipeline_cloud.run(
                    topic_override="annual fee math",
                    video_type="shorts",
                    output_dir=out,
                )

            self.assertTrue(result["ok"])
            self.assertFalse(result["publication"])
            self.assertEqual(result["youtubePrivacy"], "private")
            for name in ("research.json", "script.json", "audio_manifest.json", "handoff.json", "qa.json"):
                self.assertTrue((out / name).exists(), name)
            qa = json.loads((out / "qa.json").read_text())
            self.assertTrue(qa["ok"])


if __name__ == "__main__":
    unittest.main()
