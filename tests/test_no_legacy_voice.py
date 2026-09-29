import tempfile,unittest
from pathlib import Path
from scripts.verify_no_legacy_voice import scan

class NoLegacyVoiceTests(unittest.TestCase):
    def test_clean_tree_passes(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);(root/"control").mkdir()
            (root/"control"/"voice.json").write_text('{"provider":"cartesia","model":"sonic-3.6","fallback":{"enabled":false}}')
            self.assertEqual(scan(root)["status"],"PASS")

    def test_legacy_preview_marker_fails(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);(root/".github"/"workflows").mkdir(parents=True)
            (root/".github"/"workflows"/"x.yml").write_text("mcp-preview")
            r=scan(root)
            self.assertEqual(r["status"],"FAIL")
            self.assertEqual(r["forbidden_hits"][0]["marker"],"mcp-preview")

if __name__=="__main__":
    unittest.main()
