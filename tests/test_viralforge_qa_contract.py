import json
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
from qa_contract import validate_handoff


class ViralForgeQAContractTests(unittest.TestCase):
    def _fixture(self, root):
        root = Path(root)
        (root / "research.json").write_text(json.dumps({"topic": "test"}))
        (root / "script.json").write_text(json.dumps({"sections": [{"narration": "test"}]}))
        (root / "audio_manifest.json").write_text(json.dumps({"files": ["a.mp3"]}))
        video = root / "candidate.mp4"
        video.write_bytes(b"0" * 2048)
        (root / "handoff.json").write_text(json.dumps({
            "video": str(video),
            "publication": False,
            "youtubePrivacy": "private",
        }))
        return video

    def test_valid_handoff_passes(self):
        with tempfile.TemporaryDirectory() as tmp,              patch.object(config, "PUBLICATION_ENABLED", False),              patch.object(config, "VIDEO_PRIVACY", "private"):
            self._fixture(tmp)
            self.assertTrue(validate_handoff(tmp)["ok"])

    def test_handoff_publication_flag_fails(self):
        with tempfile.TemporaryDirectory() as tmp,              patch.object(config, "PUBLICATION_ENABLED", False),              patch.object(config, "VIDEO_PRIVACY", "private"):
            self._fixture(tmp)
            p = Path(tmp) / "handoff.json"
            data = json.loads(p.read_text())
            data["publication"] = True
            p.write_text(json.dumps(data))
            self.assertFalse(validate_handoff(tmp)["ok"])

    def test_non_private_handoff_fails(self):
        with tempfile.TemporaryDirectory() as tmp,              patch.object(config, "PUBLICATION_ENABLED", False),              patch.object(config, "VIDEO_PRIVACY", "private"):
            self._fixture(tmp)
            p = Path(tmp) / "handoff.json"
            data = json.loads(p.read_text())
            data["youtubePrivacy"] = "public"
            p.write_text(json.dumps(data))
            self.assertFalse(validate_handoff(tmp)["ok"])


if __name__ == "__main__":
    unittest.main()
